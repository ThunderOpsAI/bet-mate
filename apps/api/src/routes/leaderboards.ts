import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.get("/", async (req, res) => {
  try {
    const category = (req.query.category as string) || "highest_roi";

    if (category === "high_rollers") {
      const leaderboard = await prisma.bankroll.findMany({
        orderBy: { monthlySpend: "desc" },
        take: 20,
        select: { userId: true, username: true, monthlySpend: true, totalBetsPlaced: true, balance: true }
      });
      return res.json({ success: true, category, leaderboard });
    }

    if (category === "grinders") {
      const leaderboard = await prisma.bankroll.findMany({
        orderBy: { totalBetsPlaced: "desc" },
        take: 20,
        select: { userId: true, username: true, totalBetsPlaced: true, monthlySpend: true, balance: true }
      });
      return res.json({ success: true, category, leaderboard });
    }

    if (category === "tight_ass") {
      const leaderboard = await prisma.bankroll.findMany({
        where: { totalBetsPlaced: { gt: 0 } },
        orderBy: { monthlySpend: "asc" },
        take: 20,
        select: { userId: true, username: true, monthlySpend: true, totalBetsPlaced: true, balance: true }
      });
      return res.json({ success: true, category, leaderboard });
    }

    // Default: highest_roi (Net ROI %)
    const leaderboard = await prisma.bankroll.findMany({
      where: { totalBetsPlaced: { gte: 5 } },
      orderBy: { balance: "desc" },
      take: 20,
      select: { userId: true, username: true, balance: true, startingBalance: true, totalBetsPlaced: true, monthlySpend: true }
    });

    const formattedLeaderboard = leaderboard.map((item) => {
      const netProfit = item.balance - item.startingBalance;
      const roiPct = item.monthlySpend > 0 ? (netProfit / item.monthlySpend) * 100 : 0;
      return { ...item, roiPct: Math.round(roiPct * 100) / 100 };
    });

    return res.json({ success: true, category: "highest_roi", leaderboard: formattedLeaderboard });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to fetch leaderboards" });
  }
});

export default router;
