import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

const createBetSchema = z.object({
  eventType: z.enum(["race", "nba_game", "afl_game"]),
  eventId: z.string().min(1),
  eventName: z.string().min(1),
  eventTime: z.string().datetime().optional(),
  betType: z.string().min(1),
  selection: z.string().min(1),
  odds: z.number().positive(),
  stake: z.number().positive(),
  wasAIRecommended: z.boolean().default(false),
  notes: z.string().optional(),
});

const settleSchema = z.object({
  status: z.enum(["won", "lost", "void"]),
  payout: z.number().min(0).optional(),
});

// POST /api/bets — log a new bet
router.post("/", async (req: AuthRequest, res) => {
  const parsed = createBetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const userId = req.userId!;
  const { eventType, eventId, eventName, eventTime, betType, selection, odds, stake, wasAIRecommended, notes } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");

      if (Number(user.currentBankroll) < stake) {
        throw new Error("Insufficient bankroll");
      }

      const bet = await tx.bet.create({
        data: {
          userId,
          eventType,
          eventId,
          eventName,
          eventTime: eventTime ? new Date(eventTime) : new Date(),
          betType,
          selection,
          odds,
          stake,
          wasAIRecommended,
          notes,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { currentBankroll: { decrement: stake } },
      });

      await tx.bankrollHistory.create({
        data: { userId, amount: -stake, reason: `Bet placed: ${selection} @ ${odds}` },
      });

      return bet;
    });

    return res.status(201).json({ bet: result });
  } catch (err: any) {
    if (err.message === "Insufficient bankroll") {
      return res.status(400).json({ error: "Insufficient bankroll" });
    }
    if (err.message === "User not found") {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(500).json({ error: "Failed to create bet" });
  }
});

// GET /api/bets — list user bets
router.get("/", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { status, eventType, startDate, endDate, limit, offset } = req.query;

  const where: any = { userId };
  if (status) where.status = (status as string).toUpperCase();
  if (eventType) where.eventType = eventType;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate as string);
    if (endDate) where.createdAt.lte = new Date(endDate as string);
  }

  try {
    const take = Math.min(Number(limit) || 50, 100);
    const skip = Number(offset) || 0;

    const [bets, total] = await Promise.all([
      prisma.bet.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
      prisma.bet.count({ where }),
    ]);

    return res.json({
      bets: bets.map((b) => ({ ...b, stake: Number(b.stake), payout: b.payout ? Number(b.payout) : null })),
      pagination: { total, limit: take, offset: skip },
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch bets" });
  }
});

// PATCH /api/bets/:betId/settle
router.patch("/:betId/settle", async (req: AuthRequest, res) => {
  const parsed = settleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const userId = req.userId!;
  const { betId } = req.params;
  const { status, payout } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const bet = await tx.bet.findFirst({ where: { id: betId, userId } });
      if (!bet) throw new Error("Bet not found");
      if (bet.status !== "PENDING") throw new Error("Bet already settled");

      const updateData: any = { status: status.toUpperCase(), settledAt: new Date() };

      let bankrollChange = 0;
      if (status === "won") {
        const actualPayout = payout ?? Number(bet.stake) * bet.odds;
        updateData.payout = actualPayout;
        bankrollChange = actualPayout; // Stake was already deducted, add back payout
      } else if (status === "void") {
        bankrollChange = Number(bet.stake); // Refund stake
        updateData.payout = Number(bet.stake);
      }
      // lost: no bankroll change (stake already deducted)

      const updatedBet = await tx.bet.update({ where: { id: betId }, data: updateData });

      if (bankrollChange > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { currentBankroll: { increment: bankrollChange } },
        });
        const reason = status === "won" ? `Bet won: ${bet.selection} — payout $${bankrollChange.toFixed(2)}` : `Bet voided: ${bet.selection} — refund`;
        await tx.bankrollHistory.create({ data: { userId, amount: bankrollChange, reason } });
      } else {
        await tx.bankrollHistory.create({
          data: { userId, amount: 0, reason: `Bet lost: ${bet.selection}` },
        });
      }

      return updatedBet;
    });

    return res.json({ bet: { ...result, stake: Number(result.stake), payout: result.payout ? Number(result.payout) : null } });
  } catch (err: any) {
    if (err.message === "Bet not found") return res.status(404).json({ error: "Bet not found" });
    if (err.message === "Bet already settled") return res.status(400).json({ error: "Bet already settled" });
    return res.status(500).json({ error: "Failed to settle bet" });
  }
});

// DELETE /api/bets/:betId
router.delete("/:betId", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { betId } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const bet = await tx.bet.findFirst({ where: { id: betId, userId } });
      if (!bet) throw new Error("Bet not found");

      // Refund if pending
      if (bet.status === "PENDING") {
        await tx.user.update({
          where: { id: userId },
          data: { currentBankroll: { increment: Number(bet.stake) } },
        });
        await tx.bankrollHistory.create({
          data: { userId, amount: Number(bet.stake), reason: `Bet deleted (refund): ${bet.selection}` },
        });
      }

      await tx.bet.delete({ where: { id: betId } });
      return bet;
    });

    return res.json({ deleted: true, refunded: result.status === "PENDING" });
  } catch (err: any) {
    if (err.message === "Bet not found") return res.status(404).json({ error: "Bet not found" });
    return res.status(500).json({ error: "Failed to delete bet" });
  }
});

export default router;
