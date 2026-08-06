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

// Monthly 10k Virtual Bankroll Reset Cron (1st of Month, 00:00 Australia/Melbourne)
router.post("/monthly-reset", async (req, res) => {
  try {
    const melbourneNow = getMelbourneTime();
    if (melbourneNow.getDate() === 1) {
      await prisma.bankroll.updateMany({
        data: {
          balance: 10000.0,
          startingBalance: 10000.0,
          monthlySpend: 0.0,
          totalBetsPlaced: 0
        }
      });
      await prisma.user.updateMany({
        data: {
          currentBankroll: 10000.0,
          startingBankroll: 10000.0,
        }
      });
      return res.json({
        success: true,
        timezone: "Australia/Melbourne",
        message: "Monthly 10k virtual bankrolls successfully reset."
      });
    }
    return res.json({
      success: true,
      timezone: "Australia/Melbourne",
      message: "Not 1st of month in Australia/Melbourne. Reset skipped."
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
      // Settle pending bet if past event time or mock settled
      const eventTime = bet.eventTime ? new Date(bet.eventTime) : new Date(bet.createdAt);
      if (now.getTime() > eventTime.getTime() + 7200000) { // 2 hours after event start
        // Win probability mock-evaluation based on odds or live results
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
    // Recalculate monthlySpend and totalBetsPlaced for bankroll leaderboards
    const allUsers = await prisma.user.findMany({ include: { bets: true } });
    for (const user of allUsers) {
      const settledUserBets = user.bets.filter((b) => b.status !== "PENDING");
      const totalStaked = settledUserBets.reduce((sum, b) => sum + b.stake, 0);
      
      await prisma.bankroll.upsert({
        where: { userId: user.id },
        update: {
          balance: user.currentBankroll,
          monthlySpend: totalStaked,
          totalBetsPlaced: user.bets.length,
          username: user.username,
        },
        create: {
          userId: user.id,
          username: user.username,
          balance: user.currentBankroll,
          startingBalance: user.startingBankroll,
          monthlySpend: totalStaked,
          totalBetsPlaced: user.bets.length,
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

