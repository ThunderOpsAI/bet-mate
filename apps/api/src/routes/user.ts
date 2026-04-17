import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

const router = Router();
const prisma: any = new PrismaClient();

router.use(requireAuth);

// GET /api/user/profile
router.get("/profile", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const [totalBets, wonBets] = await Promise.all([
      prisma.bet.count({ where: { userId } }),
      prisma.bet.count({ where: { userId, status: "WON" } }),
    ]);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        startingBankroll: Number(user.startingBankroll),
        currentBankroll: Number(user.currentBankroll),
        createdAt: user.createdAt,
        totalBets,
        winRate: totalBets > 0 ? Math.round((wonBets / totalBets) * 100) : 0,
      },
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PATCH /api/user/profile
const profileUpdateSchema = z.object({
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
}).refine((d) => d.username || d.email, { message: "At least one field required" });

router.patch("/profile", async (req: AuthRequest, res) => {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });

  try {
    const user = await prisma.user.update({ where: { id: req.userId! }, data: parsed.data });
    return res.json({
      user: { id: user.id, email: user.email, username: user.username, currentBankroll: Number(user.currentBankroll) },
    });
  } catch {
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

// GET /api/user/bankroll
router.get("/bankroll", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const history = await prisma.bankrollHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const [totalStaked, totalPayout, totalBets, wonBets] = await Promise.all([
      prisma.bet.aggregate({ where: { userId }, _sum: { stake: true } }),
      prisma.bet.aggregate({ where: { userId, status: "WON" }, _sum: { payout: true } }),
      prisma.bet.count({ where: { userId } }),
      prisma.bet.count({ where: { userId, status: "WON" } }),
    ]);

    const staked = Number(totalStaked._sum.stake ?? 0);
    const returned = Number(totalPayout._sum.payout ?? 0);
    const roi = staked > 0 ? ((returned - staked) / staked) * 100 : 0;

    return res.json({
      bankroll: {
        current: Number(user.currentBankroll),
        starting: Number(user.startingBankroll),
        netProfit: Number(user.currentBankroll) - Number(user.startingBankroll),
        totalStaked: staked,
        totalReturned: returned,
        roi: Math.round(roi * 100) / 100,
        totalBets,
        wonBets,
        winRate: totalBets > 0 ? Math.round((wonBets / totalBets) * 100) : 0,
      },
      history: history.map((h: any) => ({ ...h, amount: Number(h.amount) })),
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch bankroll" });
  }
});

// POST /api/user/bankroll/adjust
const adjustSchema = z.object({
  amount: z.number().refine((v) => v !== 0, { message: "Amount cannot be zero" }),
  reason: z.string().min(1),
});

router.post("/bankroll/adjust", async (req: AuthRequest, res) => {
  const parsed = adjustSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });

  const userId = req.userId!;
  const { amount, reason } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");

      const newBankroll = Number(user.currentBankroll) + amount;
      if (newBankroll < 0) throw new Error("Bankroll cannot go negative");

      await tx.user.update({ where: { id: userId }, data: { currentBankroll: newBankroll } });
      await tx.bankrollHistory.create({ data: { userId, amount, reason } });

      return newBankroll;
    });

    return res.json({ bankroll: result });
  } catch (err: any) {
    if (err.message === "Bankroll cannot go negative") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "Failed to adjust bankroll" });
  }
});

// POST /api/user/bankroll/reset
const resetSchema = z.object({
  newBaseline: z.number().optional(),
});

router.post("/bankroll/reset", async (req: AuthRequest, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });

  const userId = req.userId!;
  const { newBaseline } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");

      const targetBaseline = newBaseline !== undefined ? newBaseline : Number(user.currentBankroll);
      const difference = targetBaseline - Number(user.currentBankroll);

      await tx.user.update({
        where: { id: userId },
        data: {
          startingBankroll: targetBaseline,
          currentBankroll: targetBaseline,
        },
      });

      await tx.bankrollHistory.create({
        data: {
          userId,
          amount: difference,
          reason: "baseline_reset",
        },
      });

      return targetBaseline;
    });

    return res.json({ bankroll: result });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to reset bankroll baseline" });
  }
});

export default router;
