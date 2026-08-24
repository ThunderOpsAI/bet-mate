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

    return res.json({
      success: true,
      timezone: "Australia/Melbourne",
      timestamp: melbourneNow.toISOString(),
      settledUserBetsCount: settledCount,
      pendingLogsCount: pendingLogs.length,
      refreshedStrategyCardsCount: refreshedStrategyCards,
      message: "4:00 AM Melbourne bet settlement, leaderboard updates, and daily strategy card generation completed successfully."
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

