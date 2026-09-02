import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.get("/", async (req, res) => {
  try {
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
