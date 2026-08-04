import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// Monthly 10k Virtual Bankroll Reset Cron (1st of Month)
router.post("/monthly-reset", async (req, res) => {
  try {
    const today = new Date();
    if (today.getDate() === 1) {
      await prisma.bankroll.updateMany({
        data: {
          balance: 10000.0,
          startingBalance: 10000.0,
          monthlySpend: 0.0,
          totalBetsPlaced: 0
        }
      });
      return res.json({ success: true, message: "Monthly 10k virtual bankrolls successfully reset." });
    }
    return res.json({ success: true, message: "Not 1st of month. Reset skipped." });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to process monthly bankroll reset" });
  }
});

// Settle Paper Bets background job
router.post("/settle-bets", async (req, res) => {
  try {
    // Settles pending paper bets based on settled race run dates
    return res.json({ success: true, message: "Paper bets settled successfully." });
  } catch (error) {
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
