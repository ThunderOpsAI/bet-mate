import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

function getMelbourneTime(): Date {
  const now = new Date();
  const melbourneString = now.toLocaleString("en-US", { timeZone: "Australia/Melbourne" });
  return new Date(melbourneString);
}

function getMelbourneWeekStart(): Date {
  const melNow = getMelbourneTime();
  const day = melNow.getDay();
  const diff = melNow.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(melNow.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function getMelbourneMonthStart(): Date {
  const melNow = getMelbourneTime();
  return new Date(melNow.getFullYear(), melNow.getMonth(), 1, 0, 0, 0, 0);
}

async function syncStrategyBankrolls() {
  try {
    const weekStart = getMelbourneWeekStart();
    const monthStart = getMelbourneMonthStart();
    const allStrategies = await prisma.strategy_profiles.findMany();
    if (allStrategies.length === 0) return;

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
  } catch (err) {
    console.warn("Failed to sync strategy bankrolls for leaderboard:", err);
  }
}

router.get("/", async (req, res) => {
  try {
    await syncStrategyBankrolls();

    const timeframe = ((req.query.timeframe as string) || "weekly").toLowerCase() === "monthly" ? "monthly" : "weekly";
    const category = (req.query.category as string) || "highest_roi";

    if (timeframe === "weekly") {
      if (category === "highest_roi_weekly") {
        const leaderboard = await prisma.weeklyChampion.findMany({
          orderBy: { weekStartDate: "desc" },
          take: 1,
        });
        return res.json({ success: true, timeframe, category, leaderboard });
      }

      if (category === "high_rollers") {
        const leaderboard = await prisma.bankroll.findMany({
          orderBy: { weeklySpend: "desc" },
          take: 20,
          select: { userId: true, username: true, weeklySpend: true, weeklyBetsPlaced: true, monthlySpend: true, totalBetsPlaced: true, balance: true },
        });
        return res.json({ success: true, timeframe, category, leaderboard });
      }

      if (category === "grinders") {
        const leaderboard = await prisma.bankroll.findMany({
          orderBy: { weeklyBetsPlaced: "desc" },
          take: 20,
          select: { userId: true, username: true, weeklyBetsPlaced: true, weeklySpend: true, monthlySpend: true, totalBetsPlaced: true, balance: true },
        });
        return res.json({ success: true, timeframe, category, leaderboard });
      }

      if (category === "tight_ass") {
        const leaderboard = await prisma.bankroll.findMany({
          where: { weeklyBetsPlaced: { gt: 0 } },
          orderBy: { weeklySpend: "asc" },
          take: 20,
          select: { userId: true, username: true, weeklySpend: true, weeklyBetsPlaced: true, monthlySpend: true, totalBetsPlaced: true, balance: true },
        });
        return res.json({ success: true, timeframe, category, leaderboard });
      }

      // Default: highest_roi (Weekly Net ROI %)
      const leaderboard = await prisma.bankroll.findMany({
        where: { weeklyBetsPlaced: { gte: 1 } },
        orderBy: { balance: "desc" },
        take: 20,
        select: { userId: true, username: true, balance: true, startingBalance: true, weeklyBetsPlaced: true, weeklySpend: true, monthlySpend: true, totalBetsPlaced: true },
      });

      const formattedLeaderboard = leaderboard.map((item) => {
        const netProfit = item.balance - item.startingBalance;
        const roiPct = item.weeklySpend > 0 ? (netProfit / item.weeklySpend) * 100 : 0;
        return { ...item, roiPct: Math.round(roiPct * 100) / 100 };
      });

      return res.json({ success: true, timeframe, category: "highest_roi", leaderboard: formattedLeaderboard });
    }

    // Monthly Timeframe
    if (category === "high_rollers") {
      const leaderboard = await prisma.bankroll.findMany({
        orderBy: { monthlySpend: "desc" },
        take: 20,
        select: { userId: true, username: true, monthlySpend: true, totalBetsPlaced: true, weeklySpend: true, weeklyBetsPlaced: true, balance: true },
      });
      return res.json({ success: true, timeframe, category, leaderboard });
    }

    if (category === "grinders") {
      const leaderboard = await prisma.bankroll.findMany({
        orderBy: { totalBetsPlaced: "desc" },
        take: 20,
        select: { userId: true, username: true, totalBetsPlaced: true, monthlySpend: true, weeklySpend: true, weeklyBetsPlaced: true, balance: true },
      });
      return res.json({ success: true, timeframe, category, leaderboard });
    }

    if (category === "tight_ass") {
      const leaderboard = await prisma.bankroll.findMany({
        where: { totalBetsPlaced: { gt: 0 } },
        orderBy: { monthlySpend: "asc" },
        take: 20,
        select: { userId: true, username: true, monthlySpend: true, totalBetsPlaced: true, weeklySpend: true, weeklyBetsPlaced: true, balance: true },
      });
      return res.json({ success: true, timeframe, category, leaderboard });
    }

    // Default: highest_roi (Monthly Net ROI %)
    const leaderboard = await prisma.bankroll.findMany({
      where: { totalBetsPlaced: { gte: 3 } },
      orderBy: { balance: "desc" },
      take: 20,
      select: { userId: true, username: true, balance: true, startingBalance: true, totalBetsPlaced: true, monthlySpend: true, weeklySpend: true, weeklyBetsPlaced: true },
    });

    const formattedLeaderboard = leaderboard.map((item) => {
      const netProfit = item.balance - item.startingBalance;
      const roiPct = item.monthlySpend > 0 ? (netProfit / item.monthlySpend) * 100 : 0;
      return { ...item, roiPct: Math.round(roiPct * 100) / 100 };
    });

    return res.json({ success: true, timeframe, category: "highest_roi", leaderboard: formattedLeaderboard });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to fetch leaderboards" });
  }
});

export default router;
