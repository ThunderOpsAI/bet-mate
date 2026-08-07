import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

const router = Router();
const prisma: any = new PrismaClient();

router.use(requireAuth);

const createBetSchema = z.object({
  eventType: z.enum([
    "race",
    "nba_game",
    "afl_game",
    "nrl_game",
    "soccer_game",
    "golf_event",
    "mma_fight",
  ]),
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

const EXOTIC_TYPES = [
  "QUINELLA",
  "EXACTA",
  "TRIFECTA",
  "FIRST4",
  "QUADDIE",
  "EARLY_QUADDIE",
  "TREBLE",
  "RUNNING_DOUBLE",
] as const;

const exoticLegSchema = z.object({
  raceId: z.string().min(1),
  legNumber: z.number().int().positive().default(1),
  position: z.number().int().positive().optional(),
  runnerId: z.string().min(1),
  runnerName: z.string().min(1),
  selectionMode: z
    .enum(["BOXED", "POSITIONAL", "WIN_LEG"])
    .default("POSITIONAL"),
});

const createExoticBetSchema = z.object({
  betType: z.enum(EXOTIC_TYPES),
  eventName: z.string().min(1),
  raceId: z.string().min(1).optional(),
  meetingId: z.string().min(1).optional(),
  stake: z.number().min(0.5),
  legs: z.array(exoticLegSchema).min(1),
  estimatedDividend: z.number().positive().optional(),
});

const multiLegSchema = z.object({
  marketType: z.string().min(1),
  selectionId: z.string().optional(),
  selectionLabel: z.string().min(1),
  odds: z.number().gt(1),
  probability: z.number().gt(0).lt(1).optional(),
  correlationGroup: z.string().optional(),
  line: z.number().optional(),
});

const createMultiBetSchema = z.object({
  multiType: z.enum(["SGM", "SRM"]),
  eventType: z.string().min(1),
  eventId: z.string().min(1),
  eventName: z.string().min(1),
  stake: z.number().positive(),
  legs: z.array(multiLegSchema).min(2),
});

function uniqueCount(values: string[]) {
  return new Set(values).size;
}

function product(values: number[]) {
  return values.reduce((acc, value) => acc * value, 1);
}

function positionalCombinationCount(
  legs: Array<z.infer<typeof exoticLegSchema>>,
) {
  const byPosition = new Map<number, Set<string>>();
  for (const leg of legs) {
    if (!leg.position) continue;
    const runners = byPosition.get(leg.position) ?? new Set<string>();
    runners.add(leg.runnerId);
    byPosition.set(leg.position, runners);
  }
  const positions = Array.from(byPosition.keys()).sort((a, b) => a - b);
  if (positions.length === 0) return 0;
  let combos = 0;
  const walk = (index: number, used: Set<string>) => {
    if (index === positions.length) {
      combos += 1;
      return;
    }
    for (const runnerId of byPosition.get(positions[index]) ?? []) {
      if (used.has(runnerId)) continue;
      used.add(runnerId);
      walk(index + 1, used);
      used.delete(runnerId);
    }
  };
  walk(0, new Set<string>());
  return combos;
}

function calculateExoticCombinations(
  betType: string,
  legs: Array<z.infer<typeof exoticLegSchema>>,
) {
  const boxed = legs.some((leg) => leg.selectionMode === "BOXED");
  const runnerCount = uniqueCount(legs.map((leg) => leg.runnerId));
  if (betType === "QUINELLA")
    return runnerCount >= 2 ? (runnerCount * (runnerCount - 1)) / 2 : 0;
  if (betType === "EXACTA")
    return boxed
      ? runnerCount * (runnerCount - 1)
      : positionalCombinationCount(legs);
  if (betType === "TRIFECTA")
    return boxed
      ? runnerCount * (runnerCount - 1) * (runnerCount - 2)
      : positionalCombinationCount(legs);
  if (betType === "FIRST4")
    return boxed
      ? runnerCount * (runnerCount - 1) * (runnerCount - 2) * (runnerCount - 3)
      : positionalCombinationCount(legs);

  const legCounts = new Map<number, Set<string>>();
  for (const leg of legs) {
    const runners = legCounts.get(leg.legNumber) ?? new Set<string>();
    runners.add(leg.runnerId);
    legCounts.set(leg.legNumber, runners);
  }
  return product(Array.from(legCounts.values()).map((runners) => runners.size));
}

function priceMulti(legs: Array<z.infer<typeof multiLegSchema>>) {
  const fairProbability = legs.reduce(
    (acc, leg) => acc * (leg.probability ?? 1 / leg.odds),
    1,
  );
  const correlationHaircut = Math.min(
    Math.max(0.12 + (legs.length - 2) * 0.03, 0.12),
    0.18,
  );
  const impliedProbability = Math.min(
    fairProbability / (1 - correlationHaircut),
    0.999999,
  );
  return {
    fairOdds: fairProbability > 0 ? 1 / fairProbability : 0,
    adjustedOdds: impliedProbability > 0 ? 1 / impliedProbability : 0,
    impliedProbability,
    correlationHaircut,
  };
}

// POST /api/bets/exotics — log an exotic racing bet with server-side flexi maths
router.post("/exotics", async (req: AuthRequest, res) => {
  const parsed = createExoticBetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const userId = req.userId!;
  const data = parsed.data;
  const combinations = calculateExoticCombinations(data.betType, data.legs);
  if (combinations <= 0) {
    return res
      .status(400)
      .json({
        error: "Invalid exotic selections",
        poolStatus: "AWAITING_EXOTIC_POOL",
      });
  }
  const flexiPercentage = data.stake / combinations;
  if (flexiPercentage < 0.01) {
    return res
      .status(400)
      .json({
        error: "Minimum flexi percentage is 1%",
        combinations,
        flexiPercentage,
      });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (Number(user.currentBankroll) < data.stake)
      return res.status(400).json({ error: "Insufficient bankroll" });

    const result = await prisma.$transaction(async (tx: any) => {
      const bet = await tx.exoticBet.create({
        data: {
          userId,
          betType: data.betType,
          eventName: data.eventName,
          raceId: data.raceId,
          meetingId: data.meetingId,
          stake: data.stake,
          combinations,
          flexiPercentage,
          estimatedDividend: data.estimatedDividend,
          estimatedCollect: data.estimatedDividend
            ? data.estimatedDividend * flexiPercentage
            : null,
          poolStatus: data.estimatedDividend
            ? "CALCULATED"
            : "AWAITING_EXOTIC_POOL",
          legs: { create: data.legs },
        },
        include: { legs: true },
      });
      await tx.user.update({
        where: { id: userId },
        data: { currentBankroll: { decrement: data.stake } },
      });
      await tx.bankrollHistory.create({
        data: {
          userId,
          amount: -data.stake,
          reason: `Exotic bet placed: ${data.betType} (${combinations} combos)`,
        },
      });
      return bet;
    });
    return res
      .status(201)
      .json({
        bet: result,
        combinations,
        flexiPercentage,
        poolStatus: result.poolStatus,
      });
  } catch (err: any) {
    console.error("Exotic bet creation error:", err);
    return res.status(500).json({ error: "Failed to create exotic bet" });
  }
});

// POST /api/bets/sgm — log same-game or same-race multi with correlation-adjusted odds
router.post("/sgm", async (req: AuthRequest, res) => {
  const parsed = createMultiBetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const userId = req.userId!;
  const data = parsed.data;
  const pricing = priceMulti(data.legs);

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (Number(user.currentBankroll) < data.stake)
      return res.status(400).json({ error: "Insufficient bankroll" });

    const result = await prisma.$transaction(async (tx: any) => {
      const bet = await tx.multiBet.create({
        data: {
          userId,
          multiType: data.multiType,
          eventType: data.eventType,
          eventId: data.eventId,
          eventName: data.eventName,
          stake: data.stake,
          ...pricing,
          legs: {
            create: data.legs.map((leg) => ({
              ...leg,
              probability: leg.probability ?? 1 / leg.odds,
            })),
          },
        },
        include: { legs: true },
      });
      await tx.user.update({
        where: { id: userId },
        data: { currentBankroll: { decrement: data.stake } },
      });
      await tx.bankrollHistory.create({
        data: {
          userId,
          amount: -data.stake,
          reason: `${data.multiType} placed: ${data.legs.length} legs @ ${pricing.adjustedOdds.toFixed(2)}`,
        },
      });
      return bet;
    });
    return res
      .status(201)
      .json({ bet: result, pricing, calculationStatus: "CALCULATED" });
  } catch (err: any) {
    console.error("Multi bet creation error:", err);
    return res.status(500).json({ error: "Failed to create multi bet" });
  }
});

// POST /api/bets — log a new bet
router.post("/", async (req: AuthRequest, res) => {
  const parsed = createBetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const userId = req.userId!;
  const {
    eventType,
    eventId,
    eventName,
    eventTime,
    betType,
    selection,
    odds,
    stake,
    wasAIRecommended,
    notes,
  } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.emailConfirmed) {
      return res.status(403).json({
        error: "Email confirmation required",
        message: "Please confirm your email address before placing paper bets.",
      });
    }

    if (Number(user.currentBankroll) < stake) {
      return res.status(400).json({ error: "Insufficient bankroll" });
    }

    const result = await prisma.$transaction(async (tx: any) => {
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
        data: {
          userId,
          amount: -stake,
          reason: `Bet placed: ${selection} @ ${odds}`,
        },
      });

      // Sync bet into paper_bet_log for ML feedback loop
      await tx.paper_bet_log
        .create({
          data: {
            sport: eventType,
            event_id: eventId,
            event_name: eventName,
            selection,
            bet_type: betType,
            odds,
            stake,
            status: "PENDING",
            notes,
            origin: "user",
            user_id: userId,
          },
        })
        .catch((e: any) =>
          console.warn(
            "Failed to sync paper_bet_log for ML engine:",
            e.message,
          ),
        );

      return bet;
    });

    return res.status(201).json({ bet: result });
  } catch (err: any) {
    console.error("Bet creation error:", err);
    return res.status(500).json({ error: "Failed to create bet" });
  }
});

// POST /api/bets/batch — log multiple bets at once (Betslip support)
router.post("/batch", async (req: AuthRequest, res) => {
  const batchBodySchema = z.union([
    z.object({ bets: z.array(createBetSchema) }),
    z.array(createBetSchema),
  ]);

  const parsed = batchBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const userId = req.userId!;
  const betsData = Array.isArray(parsed.data) ? parsed.data : parsed.data.bets;

  if (betsData.length === 0) {
    return res.status(200).json({ success: 0, count: 0, bets: [] });
  }

  const totalStake = betsData.reduce((sum, b) => sum + b.stake, 0);

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.emailConfirmed) {
      return res.status(403).json({
        error: "Email confirmation required",
        message: "Please confirm your email address before placing paper bets.",
      });
    }

    if (Number(user.currentBankroll) < totalStake) {
      return res.status(400).json({ error: "Insufficient bankroll" });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Create all bets
      const bets = await Promise.all(
        betsData.map((b) =>
          tx.bet.create({
            data: {
              userId,
              eventType: b.eventType,
              eventId: b.eventId,
              eventName: b.eventName,
              eventTime: b.eventTime ? new Date(b.eventTime) : new Date(),
              betType: b.betType,
              selection: b.selection,
              odds: b.odds,
              stake: b.stake,
              wasAIRecommended: b.wasAIRecommended,
              notes: b.notes,
            },
          }),
        ),
      );

      // Deduct total stake
      await tx.user.update({
        where: { id: userId },
        data: { currentBankroll: { decrement: totalStake } },
      });

      // Log bankroll history
      await tx.bankrollHistory.create({
        data: {
          userId,
          amount: -totalStake,
          reason: `Batch bet (Betslip): ${bets.length} bets placed. Total stake: $${totalStake.toFixed(2)}`,
        },
      });

      // Sync batch bets into paper_bet_log for ML engine training loop
      await Promise.all(
        betsData.map((b) =>
          tx.paper_bet_log
            .create({
              data: {
                sport: b.eventType,
                event_id: b.eventId,
                event_name: b.eventName,
                selection: b.selection,
                bet_type: b.betType,
                odds: b.odds,
                stake: b.stake,
                status: "PENDING",
                notes: b.notes,
                origin: "user",
                user_id: userId,
              },
            })
            .catch((e: any) =>
              console.warn("Batch paper_bet_log sync failed:", e.message),
            ),
        ),
      );

      return bets;
    });

    return res
      .status(201)
      .json({ success: result.length, count: result.length, bets: result });
  } catch (err: any) {
    console.error("Batch creation failed:", err);
    return res.status(500).json({ error: "Failed to create batch bets" });
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
      prisma.bet.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.bet.count({ where }),
    ]);

    return res.json({
      bets: bets.map((b: any) => ({
        ...b,
        stake: Number(b.stake),
        payout: b.payout ? Number(b.payout) : null,
      })),
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
    return res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const userId = req.userId!;
  const { betId } = req.params;
  const { status, payout } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const bet = await tx.bet.findFirst({ where: { id: betId, userId } });
      if (!bet) throw new Error("Bet not found");
      if (bet.status !== "PENDING") throw new Error("Bet already settled");

      const updateData: any = {
        status: status.toUpperCase(),
        settledAt: new Date(),
      };

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

      const updatedBet = await tx.bet.update({
        where: { id: betId },
        data: updateData,
      });

      if (bankrollChange > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { currentBankroll: { increment: bankrollChange } },
        });
        const reason =
          status === "won"
            ? `Bet won: ${bet.selection} — payout $${bankrollChange.toFixed(2)}`
            : `Bet voided: ${bet.selection} — refund`;
        await tx.bankrollHistory.create({
          data: { userId, amount: bankrollChange, reason },
        });
      } else {
        await tx.bankrollHistory.create({
          data: { userId, amount: 0, reason: `Bet lost: ${bet.selection}` },
        });
      }

      return updatedBet;
    });

    return res.json({
      bet: {
        ...result,
        stake: Number(result.stake),
        payout: result.payout ? Number(result.payout) : null,
      },
    });
  } catch (err: any) {
    if (err.message === "Bet not found")
      return res.status(404).json({ error: "Bet not found" });
    if (err.message === "Bet already settled")
      return res.status(400).json({ error: "Bet already settled" });
    return res.status(500).json({ error: "Failed to settle bet" });
  }
});

// DELETE /api/bets/:betId
router.delete("/:betId", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { betId } = req.params;

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const bet = await tx.bet.findFirst({ where: { id: betId, userId } });
      if (!bet) throw new Error("Bet not found");

      // Refund if pending
      if (bet.status === "PENDING") {
        await tx.user.update({
          where: { id: userId },
          data: { currentBankroll: { increment: Number(bet.stake) } },
        });
        await tx.bankrollHistory.create({
          data: {
            userId,
            amount: Number(bet.stake),
            reason: `Bet deleted (refund): ${bet.selection}`,
          },
        });
      }

      await tx.bet.delete({ where: { id: betId } });
      return bet;
    });

    return res.json({ deleted: true, refunded: result.status === "PENDING" });
  } catch (err: any) {
    if (err.message === "Bet not found")
      return res.status(404).json({ error: "Bet not found" });
    return res.status(500).json({ error: "Failed to delete bet" });
  }
});

export default router;
