import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

const router = Router();
const prisma: any = new PrismaClient();

router.get("/search", async (req, res) => {
  try {
    const q = req.query.q as string || "";
    const mlApi = process.env.ML_API_URL || "http://127.0.0.1:8000";
    const response = await fetch(`${mlApi}/blackbook/search?q=${encodeURIComponent(q)}`);
    if (!response.ok) {
      throw new Error(`ML API returned ${response.status}`);
    }
    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error("Failed to fetch blackbook search:", error);
    return res.status(503).json({ horses: [], jockeys: [], trainers: [] });
  }
});

router.use(requireAuth);

const ENTITY_TYPES = ["RUNNER", "JOCKEY", "TRAINER", "COMBINATION"] as const;

const createRuleSchema = z.object({
  triggerType: z.enum(["TRACK_CONDITION", "BARRIER_BOX", "JOCKEY_TRAINER", "ODDS_THRESHOLD", "ML_CONFIDENCE"]),
  operator: z.string().default("EQUALS"),
  triggerValue: z.string().min(1),
  stakeAmount: z.number().positive().default(10.0),
  stakeType: z.string().default("WIN"),
  isActive: z.boolean().default(true),
});

const createBlackbookItemSchema = z.object({
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  targetName: z.string().min(1),
  entityType: z.enum(ENTITY_TYPES).default("RUNNER"),
  notes: z.string().nullable().optional(),
  alertPreferences: z.record(z.any()).optional().default({}),
  jockeyName: z.string().nullable().optional(),
  trainerName: z.string().nullable().optional(),
  horseName: z.string().nullable().optional(),
  trackName: z.string().nullable().optional(),
  rules: z.array(createRuleSchema).optional().default([]),
});

const updateBlackbookItemSchema = z.object({
  targetType: z.string().min(1).optional(),
  targetId: z.string().min(1).optional(),
  targetName: z.string().min(1).optional(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  notes: z.string().nullable().optional(),
  alertPreferences: z.record(z.any()).optional(),
  jockeyName: z.string().nullable().optional(),
  trainerName: z.string().nullable().optional(),
  horseName: z.string().nullable().optional(),
  trackName: z.string().nullable().optional(),
});

// GET /api/blackbook — List all blackbook items for current user
router.get("/", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { entityType, targetType } = req.query;

  try {
    const where: any = { userId };
    if (typeof entityType === "string" && entityType) {
      where.entityType = entityType;
    }
    if (typeof targetType === "string" && targetType) {
      where.targetType = targetType;
    }

    const items = await prisma.blackbookItem.findMany({
      where,
      include: { rules: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, data: items });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to fetch blackbook items" });
  }
});

// GET /api/blackbook/:id — Get a single blackbook item
router.get("/:id", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  try {
    const item = await prisma.blackbookItem.findFirst({
      where: { id, userId },
      include: { rules: true },
    });

    if (!item) {
      return res.status(404).json({ success: false, error: "Blackbook item not found" });
    }

    return res.json({ success: true, data: item });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to fetch blackbook item" });
  }
});

// POST /api/blackbook — Create or upsert a blackbook item
router.post("/", async (req: AuthRequest, res) => {
  const parsed = createBlackbookItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Invalid payload", details: parsed.error.flatten() });
  }

  const userId = req.userId!;
  const {
    targetType,
    targetId,
    targetName,
    entityType,
    notes,
    alertPreferences,
    jockeyName,
    trainerName,
    horseName,
    trackName,
    rules,
  } = parsed.data;

  try {
    const existing = await prisma.blackbookItem.findUnique({
      where: {
        userId_targetId_targetType: {
          userId,
          targetId,
          targetType,
        },
      },
    });

    if (existing) {
      const updated = await prisma.blackbookItem.update({
        where: { id: existing.id },
        data: {
          targetName,
          entityType,
          notes,
          alertPreferences,
          jockeyName,
          trainerName,
          horseName,
          trackName,
          ...(rules.length > 0
            ? {
                rules: {
                  createMany: {
                    data: rules,
                  },
                },
              }
            : {}),
        },
        include: { rules: true },
      });
      return res.json({ success: true, data: updated });
    }

    const item = await prisma.blackbookItem.create({
      data: {
        userId,
        targetType,
        targetId,
        targetName,
        entityType,
        notes,
        alertPreferences,
        jockeyName,
        trainerName,
        horseName,
        trackName,
        rules: rules.length > 0 ? { create: rules } : undefined,
      },
      include: { rules: true },
    });

    return res.status(201).json({ success: true, data: item });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to create blackbook item" });
  }
});

// PATCH /api/blackbook/:id — Update a blackbook item
router.patch("/:id", async (req: AuthRequest, res) => {
  const parsed = updateBlackbookItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Invalid payload", details: parsed.error.flatten() });
  }

  const userId = req.userId!;
  const { id } = req.params;

  try {
    const existing = await prisma.blackbookItem.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Blackbook item not found" });
    }

    const updated = await prisma.blackbookItem.update({
      where: { id: existing.id },
      data: parsed.data,
      include: { rules: true },
    });

    return res.json({ success: true, data: updated });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to update blackbook item" });
  }
});

// PUT /api/blackbook/:id — Full/partial update alternative route
router.put("/:id", async (req: AuthRequest, res) => {
  const parsed = updateBlackbookItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Invalid payload", details: parsed.error.flatten() });
  }

  const userId = req.userId!;
  const { id } = req.params;

  try {
    const existing = await prisma.blackbookItem.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Blackbook item not found" });
    }

    const updated = await prisma.blackbookItem.update({
      where: { id: existing.id },
      data: parsed.data,
      include: { rules: true },
    });

    return res.json({ success: true, data: updated });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to update blackbook item" });
  }
});

// DELETE /api/blackbook/:id — Delete a blackbook item
router.delete("/:id", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  try {
    const existing = await prisma.blackbookItem.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Blackbook item not found" });
    }

    await prisma.blackbookItem.delete({
      where: { id: existing.id },
    });

    return res.json({ success: true, message: "Blackbook item deleted successfully" });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to delete blackbook item" });
  }
});

// POST /api/blackbook/:id/rules — Add a rule to a blackbook item
router.post("/:id/rules", async (req: AuthRequest, res) => {
  const parsed = createRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Invalid rule payload", details: parsed.error.flatten() });
  }

  const userId = req.userId!;
  const { id } = req.params;

  try {
    const item = await prisma.blackbookItem.findFirst({
      where: { id, userId },
    });

    if (!item) {
      return res.status(404).json({ success: false, error: "Blackbook item not found" });
    }

    const rule = await prisma.blackbookRule.create({
      data: {
        blackbookItemId: item.id,
        ...parsed.data,
      },
    });

    return res.status(201).json({ success: true, data: rule });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to create rule" });
  }
});

// DELETE /api/blackbook/rules/:ruleId — Remove a rule from a blackbook item
router.delete("/rules/:ruleId", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { ruleId } = req.params;

  try {
    const rule = await prisma.blackbookRule.findUnique({
      where: { id: ruleId },
      include: { blackbookItem: true },
    });

    if (!rule || (rule.blackbookItem && rule.blackbookItem.userId !== userId)) {
      return res.status(404).json({ success: false, error: "Rule not found" });
    }

    await prisma.blackbookRule.delete({
      where: { id: ruleId },
    });

    return res.json({ success: true, message: "Rule deleted successfully" });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to delete rule" });
  }
});

// POST /api/blackbook/admin/rule-request — Request a new rule condition
router.post("/admin/rule-request", async (req: AuthRequest, res) => {
  const { requestedCondition, notes } = req.body;
  if (!requestedCondition) {
    return res.status(400).json({ success: false, error: "Missing requestedCondition" });
  }

  console.log(`[Blackbook] Rule Request from user ${req.userId}:`, { requestedCondition, notes });

  return res.json({ success: true, message: "Request received" });
});

export default router;
