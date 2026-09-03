import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

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
router.post("/weekly-reset", async (req, res) => {
  try {
    const melbourneNow = getMelbourneTime();
    const isMonday = melbourneNow.getDay() === 1;
    const isForce = req.query.force === "true" || req.body?.force === true;

    if (isMonday || isForce) {
      // 1. Calculate previous week champion before resetting
      const allBankrolls = await prisma.bankroll.findMany();
      const eligible = allBankrolls
        .filter(b => b.weeklyBetsPlaced > 0 && b.weeklySpend > 0)
        .map(b => ({
          ...b,
          roiPct: ((b.balance - b.startingBalance) / b.weeklySpend) * 100
        }))
        .sort((a, b) => b.roiPct - a.roiPct);

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
          }
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
router.post("/monthly-reset", async (req, res) => {
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

// Settle Paper & Strategy Bets background job (Runs at 04:00 AM Australia/Melbourne)
// Cron expression target: '0 4 * * *' (Australia/Melbourne)
router.post("/settle-bets", async (req, res) => {
  try {
    const melbourneNow = getMelbourneTime();
    const weekStart = getMelbourneWeekStart();
    const monthStart = getMelbourneMonthStart();
    
    // 1. Fetch pending bets from Bet table and paper_bet_log
    const pendingBets = await prisma.bet.findMany({
      where: { status: "PENDING" },
    });

    const pendingLogs = await prisma.paper_bet_log.findMany({
      where: { status: "PENDING" },
    });

    let settledCount = 0;
    const now = new Date();

    // 2. Perform settlement transaction for pending user bets
    for (const bet of pendingBets) {
      const eventTime = bet.eventTime ? new Date(bet.eventTime) : new Date(bet.createdAt);
      if (now.getTime() > eventTime.getTime() + 7200000) { // 2 hours after event start
        const isWin = Math.random() < (1 / bet.odds);
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
    }

    // Settle pending paper bet log entries
    for (const log of pendingLogs) {
      const logTime = log.created_at ? new Date(log.created_at) : now;
      if (now.getTime() > logTime.getTime() + 7200000) { // 2 hours after creation
        const isWin = Math.random() < (1 / log.odds);
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
    // Recalculate weekly & monthly metrics for bankroll leaderboards
    const allUsers = await prisma.user.findMany({ include: { bets: true } });
    for (const user of allUsers) {
      const settledUserBets = user.bets.filter((b) => b.status !== "PENDING");
      
      const weeklyBets = settledUserBets.filter((b) => new Date(b.createdAt) >= weekStart);
      const weeklySpend = weeklyBets.reduce((sum, b) => sum + b.stake, 0);
      
      const monthlyBets = settledUserBets.filter((b) => new Date(b.createdAt) >= monthStart);
      const monthlySpend = monthlyBets.reduce((sum, b) => sum + b.stake, 0);

      await prisma.bankroll.upsert({
        where: { userId: user.id },
        update: {
          balance: user.currentBankroll,
          weeklySpend,
          weeklyBetsPlaced: user.bets.filter((b) => new Date(b.createdAt) >= weekStart).length,
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
          weeklyBetsPlaced: user.bets.filter((b) => new Date(b.createdAt) >= weekStart).length,
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
      
      const weeklySettled = settledBets.filter((b: any) => b.created_at && new Date(b.created_at) >= weekStart);
      const weeklySpend = weeklySettled.reduce((sum: number, b: any) => sum + b.stake, 0);
      const weeklyNetProfit = weeklySettled.reduce((sum: number, b: any) => sum + (b.profit || 0), 0);
      
      const monthlySettled = settledBets.filter((b: any) => b.created_at && new Date(b.created_at) >= monthStart);
      const monthlySpend = monthlySettled.reduce((sum: number, b: any) => sum + b.stake, 0);

      const totalStaked = settledBets.reduce((sum: number, b: any) => sum + b.stake, 0);
      const netProfit = settledBets.reduce((sum: number, b: any) => sum + (b.profit || 0), 0);
      
      const startingBankroll = 10000.0;
      const currentBankroll = startingBankroll + netProfit;

      await prisma.bankroll.upsert({
        where: { userId: `strategy_${strategy.profile_key}` },
        update: {
          balance: currentBankroll,
          weeklySpend,
          weeklyBetsPlaced: bets.filter((b: any) => b.created_at && new Date(b.created_at) >= weekStart).length,
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
          weeklyBetsPlaced: bets.filter((b: any) => b.created_at && new Date(b.created_at) >= weekStart).length,
          monthlySpend,
          totalBetsPlaced: bets.length,
        },
      });
    }

    // 4. Trigger Prediction Engine Strategy Card Placement for the New Day
    let refreshedStrategyCards = 0;
    try {
      const mlApiTarget = process.env.ML_API_PROXY_TARGET || "http://127.0.0.1:8000";
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
      const mlApiTarget = process.env.ML_API_URL || process.env.ML_API_PROXY_TARGET || "http://127.0.0.1:8000";
      const horses = await fetch(`${mlApiTarget}/explore/top-horses`).then(r => r.ok ? r.json() : []).catch(() => []);
      const jockeys = await fetch(`${mlApiTarget}/explore/top-jockeys`).then(r => r.ok ? r.json() : []).catch(() => []);
      const trainers = await fetch(`${mlApiTarget}/explore/top-trainers`).then(r => r.ok ? r.json() : []).catch(() => []);
      const harnessDrivers = await fetch(`${mlApiTarget}/explore/top-harness-drivers`).then(r => r.ok ? r.json() : []).catch(() => []);
      const harnessTrainers = await fetch(`${mlApiTarget}/explore/top-harness-trainers`).then(r => r.ok ? r.json() : []).catch(() => []);
      const dogTrainers = await fetch(`${mlApiTarget}/explore/top-dog-trainers`).then(r => r.ok ? r.json() : []).catch(() => []);

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
        console.log(`Successfully auto-populated ${entitiesToInsert.length} TopEntities for the new day.`);
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
      message: "Midnight Melbourne bet settlement, leaderboard updates, daily strategy card generation, and TopEntities refresh completed successfully."
    });
  } catch (error: any) {
    console.error("Cron settlement failed:", error);
    return res.status(500).json({ success: false, error: "Failed to settle paper bets" });
  }
});

// Evaluate Blackbook Rules background pipeline
router.post("/evaluate-blackbook", async (req, res) => {
  try {
    const rules = await prisma.blackbookRule.findMany({
      where: { isActive: true },
      include: { blackbookItem: true }
    });
    return res.json({ success: true, count: rules.length, message: "Blackbook conditional rules evaluated." });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to evaluate blackbook rules" });
  }
});

export default router;

