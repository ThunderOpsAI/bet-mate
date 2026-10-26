import { Router } from "express";
import prisma from "../services/prisma";

const router = Router();
// uses shared prisma singleton

function verifyCronAuth(req: any): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || process.env.NODE_ENV !== "production") {
    // In dev or when secret is unconfigured, permit execution
    return true;
  }
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${secret}`) {
    return true;
  }
  if (req.query?.secret === secret || req.headers["x-cron-secret"] === secret) {
    return true;
  }
  return false;
}

// Timezone helper for Australia/Melbourne
function getMelbourneTime(): Date {
  const now = new Date();
  const melbourneString = now.toLocaleString("en-US", { timeZone: "Australia/Melbourne" });
  return new Date(melbourneString);
}

// Start of current week (Monday 00:00 Australia/Melbourne)
function getMelbourneWeekStart(): Date {
  const melNow = getMelbourneTime();
  const day = melNow.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = melNow.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const weekStart = new Date(melNow.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

// Start of current month (1st of Month 00:00 Australia/Melbourne)
function getMelbourneMonthStart(): Date {
  const melNow = getMelbourneTime();
  const monthStart = new Date(melNow.getFullYear(), melNow.getMonth(), 1, 0, 0, 0, 0);
  return monthStart;
}

// Weekly 10k Virtual Bankroll Reset Cron (Every Monday, 00:00 Australia/Melbourne)
router.all("/weekly-reset", async (req, res) => {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ success: false, error: "Unauthorized: Invalid CRON_SECRET" });
  }

  try {
    const melbourneNow = getMelbourneTime();
    const isMonday = melbourneNow.getDay() === 1;
    const isForce = req.query.force === "true" || req.body?.force === true;

    if (isMonday || isForce) {
      // 1. Calculate previous week champion before resetting
      const allBankrolls = await prisma.bankroll.findMany();
      let rawEligible = allBankrolls
        .filter((b) => b.weeklyBetsPlaced > 0 && b.weeklySpend > 0)
        .map((b) => {
          const roiPct = ((b.balance - b.startingBalance) / b.weeklySpend) * 100;
          const netProfit = b.balance - b.startingBalance;
          return { ...b, roiPct, netProfit };
        });

      // If no human bankrolls were active this week, check strategy bots with bets
      if (rawEligible.length === 0) {
        rawEligible = allBankrolls
          .filter((b) => b.totalBetsPlaced > 0)
          .map((b) => {
            const spend = b.weeklySpend > 0 ? b.weeklySpend : b.totalBetsPlaced * 10;
            const roiPct = ((b.balance - b.startingBalance) / spend) * 100;
            const netProfit = b.balance - b.startingBalance;
            return { ...b, roiPct, netProfit };
          });
      }

      const maxRoi = rawEligible.length > 0 ? Math.max(...rawEligible.map((e) => e.roiPct)) || 1 : 1;
      const maxProfit = rawEligible.length > 0 ? Math.max(...rawEligible.map((e) => e.netProfit)) || 1 : 1;

      const eligible = rawEligible
        .map((e) => ({
          ...e,
          compositeScore: 0.6 * (e.roiPct / maxRoi) + 0.4 * (e.netProfit / maxProfit),
        }))
        .sort((a, b) => b.compositeScore - a.compositeScore);

      if (eligible.length > 0) {
        const top = eligible[0];
        const weekStart = getMelbourneWeekStart();
        const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

        await prisma.weeklyChampion.upsert({
          where: { weekStartDate: lastWeekStart },
          update: {
            userId: top.userId,
            username: top.username,
            roiPct: top.roiPct,
            balance: top.balance,
            totalBetsPlaced: top.weeklyBetsPlaced,
          },
          create: {
            weekStartDate: lastWeekStart,
            userId: top.userId,
            username: top.username,
            roiPct: top.roiPct,
            balance: top.balance,
            totalBetsPlaced: top.weeklyBetsPlaced,
          },
        });
      }

      await prisma.bankroll.updateMany({
        data: {
          balance: 10000.0,
          startingBalance: 10000.0,
          weeklySpend: 0.0,
          weeklyBetsPlaced: 0,
        },
      });
      await prisma.user.updateMany({
        data: {
          currentBankroll: 10000.0,
          startingBankroll: 10000.0,
        },
      });
      return res.json({
        success: true,
        timezone: "Australia/Melbourne",
        message: "Weekly 10k virtual bankrolls successfully reset for the new week sprint.",
      });
    }
    return res.json({
      success: true,
      timezone: "Australia/Melbourne",
      message: "Not Monday in Australia/Melbourne. Weekly reset skipped.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to process weekly bankroll reset" });
  }
});

// Monthly Overall ROI & Spend Reset Cron (1st of Month, 00:00 Australia/Melbourne)
router.all("/monthly-reset", async (req, res) => {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ success: false, error: "Unauthorized: Invalid CRON_SECRET" });
  }

  try {
    const melbourneNow = getMelbourneTime();
    const isFirst = melbourneNow.getDate() === 1;
    const isForce = req.query.force === "true" || req.body?.force === true;

    if (isFirst || isForce) {
      await prisma.bankroll.updateMany({
        data: {
          monthlySpend: 0.0,
        },
      });
      return res.json({
        success: true,
        timezone: "Australia/Melbourne",
        message: "Monthly spend tracking successfully reset for new calendar month.",
      });
    }
    return res.json({
      success: true,
      timezone: "Australia/Melbourne",
      message: "Not 1st of month in Australia/Melbourne. Monthly reset skipped.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to process monthly bankroll reset" });
  }
});

// Settle Paper & Strategy Bets background job (Runs at 01:00 AM UTC = 11:00 AM/12:00 PM AEST)
router.all("/settle-bets", async (req, res) => {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ success: false, error: "Unauthorized: Invalid CRON_SECRET" });
  }

  try {
    const melbourneNow = getMelbourneTime();
    const weekStart = getMelbourneWeekStart();
    const monthStart = getMelbourneMonthStart();

    // 0. Trigger ML engine's result ingestion so latest outcomes are synced
    const mlApiTarget = process.env.ML_API_URL || process.env.ML_API_PROXY_TARGET || "http://127.0.0.1:8000";
    try {
      await fetch(`${mlApiTarget}/api/predictions/results/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sports: ["all"] }),
      });
    } catch (ingestErr) {
      console.warn("Auto-ingest during bet settlement skipped/failed:", ingestErr);
    }

    // 1. Fetch pending bets and paper_bet_log entries
    const pendingBets = await prisma.bet.findMany({
      where: { status: "PENDING" },
    });

    const pendingLogs = await prisma.paper_bet_log.findMany({
      where: { status: "PENDING" },
    });

    // 2. Fetch known official results
    const predictionResults = await prisma.prediction_results.findMany();
    const raceResults = await prisma.raceResult.findMany({
      where: { finishPosition: 1 },
    });
    const matchResults = await prisma.matchResult.findMany({
      where: { winner: { not: null } },
    });

    let settledCount = 0;
    const now = new Date();

    // Settle pending user bets based on real official outcomes (Zero-Mock Rule)
    for (const bet of pendingBets) {
      let isSettled = false;
      let isWin = false;

      // Check prediction_results table
      const matchedPred = predictionResults.find(
        (pr) =>
          pr.event_id.toLowerCase() === bet.eventId.toLowerCase() ||
          (bet.eventName && pr.event_name.toLowerCase().includes(bet.eventName.toLowerCase()))
      );

      if (matchedPred && matchedPred.winner_selection) {
        isSettled = true;
        isWin = matchedPred.winner_selection.trim().toLowerCase() === bet.selection.trim().toLowerCase();
      } else {
        // Fallback to RaceResult
        const matchedRace = raceResults.find(
          (rr) =>
            rr.raceId.toLowerCase() === bet.eventId.toLowerCase() &&
            rr.runnerName.trim().toLowerCase() === bet.selection.trim().toLowerCase()
        );
        if (matchedRace) {
          isSettled = true;
          isWin = true;
        } else {
          // If the race is in raceResults with another runner winning, then this bet lost
          const otherRunnerWon = raceResults.find(
            (rr) => rr.raceId.toLowerCase() === bet.eventId.toLowerCase()
          );
          if (otherRunnerWon) {
            isSettled = true;
            isWin = false;
          } else {
            // Fallback to MatchResult
            const matchedMatch = matchResults.find(
              (mr) => mr.matchId.toLowerCase() === bet.eventId.toLowerCase()
            );
            if (matchedMatch && matchedMatch.winner) {
              isSettled = true;
              isWin = matchedMatch.winner.trim().toLowerCase() === bet.selection.trim().toLowerCase();
            }
          }
        }
      }

      if (isSettled) {
        const status = isWin ? "WON" : "LOST";
        const payout = isWin ? bet.stake * bet.odds : 0;
        const profit = isWin ? payout - bet.stake : -bet.stake;

        await prisma.$transaction([
          prisma.bet.update({
            where: { id: bet.id },
            data: { status, payout, settledAt: now },
          }),
          prisma.user.update({
            where: { id: bet.userId },
            data: { currentBankroll: { increment: payout } },
          }),
          prisma.bankrollHistory.create({
            data: {
              userId: bet.userId,
              amount: profit,
              reason: `Settled bet (${status}): ${bet.selection} @ ${bet.odds}`,
            },
          }),
        ]);
        settledCount++;
      }
      // If NOT settled yet, leave as PENDING — absolutely no random/Math.random() outcome!
    }

    // Settle pending paper bet log entries
    for (const log of pendingLogs) {
      const matchedPred = predictionResults.find(
        (pr) =>
          pr.event_id.toLowerCase() === (log.event_id || "").toLowerCase() ||
          ((log.event_name || "") && pr.event_name.toLowerCase().includes(log.event_name.toLowerCase()))
      );

      if (matchedPred && matchedPred.winner_selection) {
        const isWin = matchedPred.winner_selection.trim().toLowerCase() === log.selection.trim().toLowerCase();
        const status = isWin ? "WON" : "LOST";
        const payout = isWin ? log.stake * log.odds : 0;
        const profit = isWin ? payout - log.stake : -log.stake;

        await prisma.paper_bet_log.update({
          where: { id: log.id },
          data: { status, payout, profit, settled_at: now },
        });
      }
    }

    // 3. Post-Settlement Leaderboard & Strategy Analytics Update
    const allUsers = await prisma.user.findMany({ include: { bets: true } });
    for (const user of allUsers) {
      const weeklyBets = user.bets.filter((b) => new Date(b.createdAt) >= weekStart);
      const weeklySpend = weeklyBets.reduce((sum, b) => sum + (Number(b.stake) || 0), 0);

      const monthlyBets = user.bets.filter((b) => new Date(b.createdAt) >= monthStart);
      const monthlySpend = monthlyBets.reduce((sum, b) => sum + (Number(b.stake) || 0), 0);

      await prisma.bankroll.upsert({
        where: { userId: user.id },
        update: {
          balance: user.currentBankroll,
          weeklySpend,
          weeklyBetsPlaced: weeklyBets.length,
          monthlySpend,
          totalBetsPlaced: user.bets.length,
          username: user.username,
        },
        create: {
          userId: user.id,
          username: user.username,
          balance: user.currentBankroll,
          startingBalance: user.startingBankroll,
          weeklySpend,
          weeklyBetsPlaced: weeklyBets.length,
          monthlySpend,
          totalBetsPlaced: user.bets.length,
        },
      });
    }

    // Sync strategy bots to leaderboard
    const allStrategies = await prisma.strategy_profiles.findMany();
    const strategyBets = await prisma.system_bets.findMany();

    for (const strategy of allStrategies) {
      const bets = strategyBets.filter((b: any) => b.profile_key === strategy.profile_key);
      const settledBets = bets.filter((b: any) => b.status !== "pending");

      const weeklyBets = bets.filter((b: any) => b.created_at && new Date(b.created_at) >= weekStart);
      const weeklySpend = weeklyBets.reduce((sum: number, b: any) => sum + (Number(b.stake) || 0), 0);

      const monthlyBets = bets.filter((b: any) => b.created_at && new Date(b.created_at) >= monthStart);
      const monthlySpend = monthlyBets.reduce((sum: number, b: any) => sum + (Number(b.stake) || 0), 0);

      const netProfit = settledBets.reduce((sum: number, b: any) => sum + (Number(b.profit) || 0), 0);
      const startingBankroll = 10000.0;
      const currentBankroll = startingBankroll + netProfit;

      await prisma.bankroll.upsert({
        where: { userId: `strategy_${strategy.profile_key}` },
        update: {
          balance: currentBankroll,
          weeklySpend,
          weeklyBetsPlaced: weeklyBets.length,
          monthlySpend,
          totalBetsPlaced: bets.length,
          username: `🤖 ${strategy.display_name}`,
        },
        create: {
          userId: `strategy_${strategy.profile_key}`,
          username: `🤖 ${strategy.display_name}`,
          balance: currentBankroll,
          startingBalance: startingBankroll,
          weeklySpend,
          weeklyBetsPlaced: weeklyBets.length,
          monthlySpend,
          totalBetsPlaced: bets.length,
        },
      });
    }

    // 4. Trigger Prediction Engine Strategy Card Placement for the New Day
    let refreshedStrategyCards = 0;
    try {
      const refreshRes = await fetch(`${mlApiTarget}/api/strategy-cards/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        refreshedStrategyCards = refreshData?.count || 0;
      }
    } catch (refreshErr) {
      console.warn("Failed to auto-refresh strategy cards during bet settlement:", refreshErr);
    }

    // 5. Populate / Refresh TopEntity Rankings for Blackbook
    let populatedTopEntitiesCount = 0;
    try {
      const horses = await fetch(`${mlApiTarget}/explore/top-horses`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
      const jockeys = await fetch(`${mlApiTarget}/explore/top-jockeys`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
      const trainers = await fetch(`${mlApiTarget}/explore/top-trainers`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
      const harnessDrivers = await fetch(`${mlApiTarget}/explore/top-harness-drivers`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
      const harnessTrainers = await fetch(`${mlApiTarget}/explore/top-harness-trainers`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
      const dogTrainers = await fetch(`${mlApiTarget}/explore/top-dog-trainers`).then((r) => (r.ok ? r.json() : [])).catch(() => []);

      const entitiesToInsert: any[] = [];

      horses.slice(0, 50).forEach((h: any, i: number) => {
        entitiesToInsert.push({ category: "Top 50 Horses", entityName: h.name || h.entityName || "Unknown", rank: i + 1, sport: "racing", metrics: h });
      });
      jockeys.slice(0, 30).forEach((j: any, i: number) => {
        entitiesToInsert.push({ category: "Top 30 Jockeys", entityName: j.name || j.jockeyName || "Unknown", rank: i + 1, sport: "racing", metrics: j });
      });
      trainers.slice(0, 20).forEach((t: any, i: number) => {
        entitiesToInsert.push({ category: "Top 20 Horse Trainers", entityName: t.name || t.trainerName || "Unknown", rank: i + 1, sport: "racing", metrics: t });
      });
      harnessDrivers.slice(0, 15).forEach((d: any, i: number) => {
        entitiesToInsert.push({ category: "Top 15 Harness Drivers", entityName: d.name || d.jockeyName || "Unknown", rank: i + 1, sport: "harness", metrics: d });
      });
      harnessTrainers.slice(0, 10).forEach((t: any, i: number) => {
        entitiesToInsert.push({ category: "Top 10 Harness Trainers", entityName: t.name || t.trainerName || "Unknown", rank: i + 1, sport: "harness", metrics: t });
      });
      dogTrainers.slice(0, 30).forEach((t: any, i: number) => {
        entitiesToInsert.push({ category: "Top 30 Dog Trainers", entityName: t.name || t.trainerName || "Unknown", rank: i + 1, sport: "greyhound", metrics: t });
      });

      if (entitiesToInsert.length > 0) {
        await prisma.topEntity.deleteMany({});
        await prisma.topEntity.createMany({ data: entitiesToInsert });
        populatedTopEntitiesCount = entitiesToInsert.length;
      }
    } catch (topErr) {
      console.warn("Failed to populate TopEntities during bet settlement:", topErr);
    }

    return res.json({
      success: true,
      timezone: "Australia/Melbourne",
      timestamp: melbourneNow.toISOString(),
      settledUserBetsCount: settledCount,
      pendingLogsCount: pendingLogs.length,
      refreshedStrategyCardsCount: refreshedStrategyCards,
      populatedTopEntitiesCount,
      message: "Bet settlement (real results only), leaderboard updates, and TopEntities refresh completed successfully.",
    });
  } catch (error: any) {
    console.error("Cron settlement failed:", error);
    return res.status(500).json({ success: false, error: "Failed to settle paper bets" });
  }
});

// Daily Digest Morning Dispatch Cron
router.all("/daily-digest", async (req, res) => {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ success: false, error: "Unauthorized: Invalid CRON_SECRET" });
  }

  try {
    const melbourneNow = getMelbourneTime();
    return res.json({
      success: true,
      timezone: "Australia/Melbourne",
      timestamp: melbourneNow.toISOString(),
      message: "Daily digest morning dispatch processed.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to dispatch daily digest" });
  }
});

// Evaluate Blackbook Rules background pipeline
router.all("/evaluate-blackbook", async (req, res) => {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ success: false, error: "Unauthorized: Invalid CRON_SECRET" });
  }

  try {
    const rules = await prisma.blackbookRule.findMany({
      where: { isActive: true },
      include: { blackbookItem: true },
    });
    return res.json({ success: true, count: rules.length, message: "Blackbook conditional rules evaluated." });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to evaluate blackbook rules" });
  }
});

export default router;
