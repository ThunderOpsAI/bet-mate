import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

const router = Router();
const prisma: any = new PrismaClient();

router.use(requireAuth);

/**
 * Generate a random 6-character uppercase invite code.
 */
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST /api/syndicates - Create a new paper syndicate
const createSyndicateSchema = z.object({
  name: z.string().min(2, "Syndicate name must be at least 2 characters").max(50),
  buyInTier: z.number().refine((val) => [20, 50, 100].includes(val), {
    message: "Buy-in tier must be $20, $50, or $100 paper currency",
  }),
});

router.post("/", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const parsed = createSyndicateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request payload", details: parsed.error.flatten() });
  }

  const { name, buyInTier } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User profile not found" });
    }

    // Generate unique 6-character code
    let code = generateInviteCode();
    let existing = await prisma.syndicate.findUnique({ where: { code } });
    let attempts = 0;
    while (existing && attempts < 10) {
      code = generateInviteCode();
      existing = await prisma.syndicate.findUnique({ where: { code } });
      attempts++;
    }

    const syndicate = await prisma.$transaction(async (tx: any) => {
      // 1. Create syndicate record
      const newSyndicate = await tx.syndicate.create({
        data: {
          name,
          code,
          ownerId: userId,
          buyInTier,
          paperBalance: buyInTier,
          maxStakeLimit: Math.min(buyInTier, 50.0),
        },
      });

      // 2. Add creator as OWNER member
      await tx.syndicateMember.create({
        data: {
          syndicateId: newSyndicate.id,
          userId,
          username: user.username || "Mate",
          role: "OWNER",
          buyInAmount: buyInTier,
        },
      });

      // 3. Log initial ledger entry
      await tx.syndicateLedger.create({
        data: {
          syndicateId: newSyndicate.id,
          userId,
          type: "BUY_IN",
          amount: buyInTier,
          description: `Initial buy-in of $${buyInTier} paper currency by ${user.username || "Owner"}`,
        },
      });

      // 4. Record user paper bankroll transaction if sufficient balance
      if (Number(user.currentBankroll) >= buyInTier) {
        await tx.user.update({
          where: { id: userId },
          data: { currentBankroll: Number(user.currentBankroll) - buyInTier },
        });
        await tx.bankrollHistory.create({
          data: {
            userId,
            amount: -buyInTier,
            reason: `syndicate_buyin_${newSyndicate.id}`,
          },
        });
      }

      return newSyndicate;
    });

    const fullSyndicate = await prisma.syndicate.findUnique({
      where: { id: syndicate.id },
      include: {
        members: true,
        ledgers: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    return res.status(201).json({ syndicate: fullSyndicate });
  } catch (error: any) {
    console.error("Failed to create syndicate:", error);
    return res.status(500).json({ error: "Failed to create paper syndicate" });
  }
});

// POST /api/syndicates/join - Join a syndicate using a 6-digit invite code
const joinSyndicateSchema = z.object({
  code: z.string().min(1, "Invite code is required").transform((c) => c.trim().toUpperCase()),
});

router.post("/join", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const parsed = joinSyndicateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid invite code", details: parsed.error.flatten() });
  }

  const { code } = parsed.data;

  try {
    const syndicate = await prisma.syndicate.findUnique({
      where: { code },
      include: { members: true },
    });

    if (!syndicate) {
      return res.status(404).json({ error: `Syndicate with code "${code}" not found.` });
    }

    const existingMember = syndicate.members.find((m: any) => m.userId === userId);
    if (existingMember) {
      return res.status(400).json({ error: "You are already a member of this syndicate." });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const buyIn = Number(syndicate.buyInTier);

    await prisma.$transaction(async (tx: any) => {
      // 1. Add member
      await tx.syndicateMember.create({
        data: {
          syndicateId: syndicate.id,
          userId,
          username: user.username || "Mate",
          role: "MEMBER",
          buyInAmount: buyIn,
        },
      });

      // 2. Increase syndicate paper balance
      await tx.syndicate.update({
        where: { id: syndicate.id },
        data: { paperBalance: Number(syndicate.paperBalance) + buyIn },
      });

      // 3. Add ledger entry
      await tx.syndicateLedger.create({
        data: {
          syndicateId: syndicate.id,
          userId,
          type: "BUY_IN",
          amount: buyIn,
          description: `${user.username || "Member"} joined with $${buyIn} paper buy-in`,
        },
      });

      // 4. Update user bankroll
      if (Number(user.currentBankroll) >= buyIn) {
        await tx.user.update({
          where: { id: userId },
          data: { currentBankroll: Number(user.currentBankroll) - buyIn },
        });
        await tx.bankrollHistory.create({
          data: {
            userId,
            amount: -buyIn,
            reason: `syndicate_buyin_${syndicate.id}`,
          },
        });
      }
    });

    const updatedSyndicate = await prisma.syndicate.findUnique({
      where: { id: syndicate.id },
      include: {
        members: true,
        ledgers: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    return res.json({ message: "Successfully joined syndicate!", syndicate: updatedSyndicate });
  } catch (error: any) {
    console.error("Failed to join syndicate:", error);
    return res.status(500).json({ error: "Failed to join syndicate." });
  }
});

// GET /api/syndicates - List all paper syndicates for current user
router.get("/", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const syndicates = await prisma.syndicate.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: true,
        ledgers: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = syndicates.map((syn: any) => ({
      ...syn,
      buyInTier: Number(syn.buyInTier),
      paperBalance: Number(syn.paperBalance),
      maxStakeLimit: Number(syn.maxStakeLimit),
      userRole: syn.members.find((m: any) => m.userId === userId)?.role || "MEMBER",
    }));

    return res.json({ syndicates: formatted });
  } catch (error: any) {
    console.error("Failed to list syndicates:", error);
    return res.status(500).json({ error: "Failed to fetch syndicates." });
  }
});

// GET /api/syndicates/:id - Get syndicate details, member roster, ledgers
router.get("/:id", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  try {
    const syndicate = await prisma.syndicate.findUnique({
      where: { id },
      include: {
        members: { orderBy: { joinedAt: "asc" } },
        ledgers: { orderBy: { createdAt: "desc" }, take: 50 },
        messages: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });

    if (!syndicate) {
      return res.status(404).json({ error: "Syndicate not found" });
    }

    const isMember = syndicate.members.some((m: any) => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: "Access denied. You are not a member of this syndicate." });
    }

    return res.json({
      syndicate: {
        ...syndicate,
        buyInTier: Number(syndicate.buyInTier),
        paperBalance: Number(syndicate.paperBalance),
        maxStakeLimit: Number(syndicate.maxStakeLimit),
        members: syndicate.members.map((m: any) => ({
          ...m,
          buyInAmount: Number(m.buyInAmount),
        })),
        ledgers: syndicate.ledgers.map((l: any) => ({
          ...l,
          amount: Number(l.amount),
        })),
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch syndicate details:", error);
    return res.status(500).json({ error: "Failed to fetch syndicate details" });
  }
});

// POST /api/syndicates/:id/dividend - Distribute paper dividends equally to active members
const dividendSchema = z.object({
  amount: z.number().positive().optional(),
});

router.post("/:id/dividend", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const parsed = dividendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const syndicate = await prisma.syndicate.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!syndicate) {
      return res.status(404).json({ error: "Syndicate not found" });
    }

    const memberRecord = syndicate.members.find((m: any) => m.userId === userId);
    if (!memberRecord) {
      return res.status(403).json({ error: "Only members can trigger dividend payouts" });
    }

    const currentBalance = Number(syndicate.paperBalance);
    if (currentBalance <= 0) {
      return res.status(400).json({ error: "Syndicate virtual group wallet has no balance to distribute." });
    }

    const requestedAmount = parsed.data.amount;
    const totalDistribution = requestedAmount && requestedAmount > 0
      ? Math.min(requestedAmount, currentBalance)
      : currentBalance;

    const activeMembersCount = syndicate.members.length;
    if (activeMembersCount === 0) {
      return res.status(400).json({ error: "No members found in syndicate" });
    }

    const perMemberShare = Math.floor((totalDistribution / activeMembersCount) * 100) / 100;
    if (perMemberShare <= 0) {
      return res.status(400).json({ error: "Dividend amount is too low to split evenly." });
    }

    const actualDistributedTotal = perMemberShare * activeMembersCount;

    await prisma.$transaction(async (tx: any) => {
      // 1. Deduct total from syndicate paper balance
      await tx.syndicate.update({
        where: { id },
        data: { paperBalance: currentBalance - actualDistributedTotal },
      });

      // 2. Credit each active member's personal bankroll
      for (const member of syndicate.members) {
        const memberUser = await tx.user.findUnique({ where: { id: member.userId } });
        if (memberUser) {
          await tx.user.update({
            where: { id: member.userId },
            data: { currentBankroll: Number(memberUser.currentBankroll) + perMemberShare },
          });

          await tx.bankrollHistory.create({
            data: {
              userId: member.userId,
              amount: perMemberShare,
              reason: `syndicate_dividend_${id}`,
            },
          });
        }
      }

      // 3. Log ledger entry
      await tx.syndicateLedger.create({
        data: {
          syndicateId: id,
          userId,
          type: "DIVIDEND",
          amount: -actualDistributedTotal,
          description: `Paper dividend payout of $${actualDistributedTotal.toFixed(2)} ($${perMemberShare.toFixed(2)} per member)`,
        },
      });
    });

    const updatedSyndicate = await prisma.syndicate.findUnique({
      where: { id },
      include: {
        members: true,
        ledgers: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    return res.json({
      message: `Successfully distributed $${actualDistributedTotal.toFixed(2)} paper dividend among ${activeMembersCount} members!`,
      perMemberShare,
      totalDistributed: actualDistributedTotal,
      syndicate: updatedSyndicate,
    });
  } catch (error: any) {
    console.error("Failed to distribute dividend:", error);
    return res.status(500).json({ error: "Failed to process dividend distribution." });
  }
});

// PATCH /api/syndicates/:id/governance - Update max stake limit per bet
const governanceSchema = z.object({
  maxStakeLimit: z.number().positive("Max stake limit must be positive").max(10000),
});

router.patch("/:id/governance", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const parsed = governanceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { maxStakeLimit } = parsed.data;

  try {
    const syndicate = await prisma.syndicate.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!syndicate) {
      return res.status(404).json({ error: "Syndicate not found" });
    }

    const memberRecord = syndicate.members.find((m: any) => m.userId === userId);
    if (!memberRecord || !["OWNER", "ADMIN"].includes(memberRecord.role)) {
      return res.status(403).json({ error: "Only syndicate owners or admins can update governance settings." });
    }

    const updatedSyndicate = await prisma.$transaction(async (tx: any) => {
      const syn = await tx.syndicate.update({
        where: { id },
        data: { maxStakeLimit },
      });

      await tx.syndicateLedger.create({
        data: {
          syndicateId: id,
          userId,
          type: "GOVERNANCE",
          amount: 0,
          description: `Updated max stake limit to $${maxStakeLimit.toFixed(2)} per bet`,
        },
      });

      return syn;
    });

    return res.json({
      message: "Governance policy updated successfully",
      syndicate: updatedSyndicate,
    });
  } catch (error: any) {
    console.error("Failed to update governance:", error);
    return res.status(500).json({ error: "Failed to update governance policy." });
  }
});

export default router;
