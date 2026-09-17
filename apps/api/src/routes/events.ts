import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// GET /api/events/:eventId/probability-history
router.get("/:eventId/probability-history", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { selectionId } = req.query;

    const whereClause: any = { eventId };
    if (selectionId && typeof selectionId === "string") {
      whereClause.selectionId = selectionId;
    }

    const snapshots = await (prisma as any).predictionSnapshot.findMany({
      where: whereClause,
      orderBy: { capturedAt: "asc" },
      take: 100,
    });

    return res.json({
      eventId,
      selectionId: selectionId || null,
      count: snapshots.length,
      snapshots: snapshots.map((s: any) => ({
        id: s.id,
        selectionId: s.selectionId,
        selectionName: s.selectionName,
        sport: s.sport,
        winProbability: s.winProbability,
        fairOdds: s.fairOdds,
        marketOdds: s.marketOdds,
        capturedAt: s.capturedAt,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching probability history:", error);
    return res.status(500).json({ error: "Failed to fetch probability history" });
  }
});

// POST /api/events/probability-snapshot
router.post("/probability-snapshot", async (req, res) => {
  try {
    const {
      eventId,
      selectionId,
      selectionName,
      sport,
      winProbability,
      fairOdds,
      marketOdds,
    } = req.body;

    if (!eventId || !selectionId || !sport || winProbability === undefined || fairOdds === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const snapshot = await (prisma as any).predictionSnapshot.create({
      data: {
        eventId,
        selectionId,
        selectionName: selectionName || null,
        sport,
        winProbability: parseFloat(winProbability),
        fairOdds: parseFloat(fairOdds),
        marketOdds: marketOdds ? parseFloat(marketOdds) : null,
      },
    });

    return res.status(201).json({ ok: true, snapshot });
  } catch (error: any) {
    console.error("Error recording probability snapshot:", error);
    return res.status(500).json({ error: "Failed to record snapshot" });
  }
});

export default router;
