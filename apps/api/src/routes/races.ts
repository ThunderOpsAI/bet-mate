import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma: any = new PrismaClient();

// GET /api/races/today
router.get("/today", async (_req, res) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const races = await prisma.race.findMany({
      where: { raceDate: { gte: start, lt: end } },
      orderBy: [{ venue: "asc" }, { raceNumber: "asc" }],
      include: { predictions: true },
    });

    if (races.length === 0) {
      return res.json({
        meetings: [],
        source: "database",
        message: "No races currently",
      });
    }

    const byVenue = new Map<string, { venueName: string; raceDate: string; races: unknown[] }>();
    for (const race of races) {
      const key = `${race.venue}-${race.raceDate.toISOString().slice(0, 10)}`;
      const topPicks = race.predictions
        .sort((a: any, b: any) => b.winProbability - a.winProbability)
        .slice(0, 3)
        .map((p: any) => ({ horseName: p.horseName, winProbability: p.winProbability, confidence: p.confidence }));

      if (!byVenue.has(key)) {
        byVenue.set(key, { venueName: race.venue, raceDate: race.raceDate.toISOString().slice(0, 10), races: [] });
      }
      byVenue.get(key)?.races.push({
        id: race.id,
        raceNumber: race.raceNumber,
        postTime: race.raceDate.toISOString(),
        distance: race.distanceMeters,
        topPicks,
      });
    }

    return res.json({ meetings: [...byVenue.values()], source: "database" });
  } catch {
    return res.status(503).json({
      meetings: [],
      source: "error",
      message: "Failed to fetch races",
    });
  }
});

// GET /api/races/:raceId
router.get("/:raceId", async (req, res) => {
  const { raceId } = req.params;

  try {
    const race = await prisma.race.findUnique({
      where: { id: raceId },
      include: { predictions: { orderBy: { winProbability: "desc" } } },
    });

    if (!race) {
      return res.status(404).json({ error: "Race not found" });
    }

    return res.json({ race, source: "database" });
  } catch {
    return res.status(500).json({ error: "Failed to fetch race" });
  }
});

export default router;
