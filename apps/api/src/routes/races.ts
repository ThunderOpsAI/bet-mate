import { Router } from "express";
import { PrismaClient, type Prediction } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

const SAMPLE_RACE = {
  id: "sample-race-1",
  raceNumber: 1,
  venue: "Sample Park",
  raceDate: new Date().toISOString().slice(0, 10),
  distanceMeters: 1400,
  trackCondition: "Good",
  topPicks: [
    { horseName: "Golden Star", winProbability: 0.29, confidence: "high" },
    { horseName: "Rapid Queen", winProbability: 0.23, confidence: "medium" },
    { horseName: "Night Runner", winProbability: 0.19, confidence: "medium" },
  ],
};

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
        meetings: [
          {
            venueName: "Sample Park",
            raceDate: start.toISOString().slice(0, 10),
            races: [
              {
                id: "sample-race-1",
                raceNumber: 1,
                postTime: new Date(start.getTime() + 3600000).toISOString(),
                distance: 1400,
                topPicks: SAMPLE_RACE.topPicks,
              },
            ],
          },
        ],
        source: "fallback",
      });
    }

    const byVenue = new Map<string, { venueName: string; raceDate: string; races: unknown[] }>();
    for (const race of races) {
      const key = `${race.venue}-${race.raceDate.toISOString().slice(0, 10)}`;
      const topPicks = race.predictions
        .sort((a: Prediction, b: Prediction) => b.winProbability - a.winProbability)
        .slice(0, 3)
        .map((p: Prediction) => ({ horseName: p.horseName, winProbability: p.winProbability, confidence: p.confidence }));

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
    return res.json({
      meetings: [
        {
          venueName: "Sample Park",
          raceDate: new Date().toISOString().slice(0, 10),
          races: [
            {
              id: "sample-race-1",
              raceNumber: 1,
              postTime: new Date().toISOString(),
              distance: 1400,
              topPicks: SAMPLE_RACE.topPicks,
            },
          ],
        },
      ],
      source: "fallback",
    });
  }
});

// GET /api/races/:raceId
router.get("/:raceId", async (req, res) => {
  const { raceId } = req.params;

  // Fallback for sample race
  if (raceId === "sample-race-1") {
    return res.json({
      race: {
        ...SAMPLE_RACE,
        predictions: [
          { horseName: "Golden Star", barrier: 3, winProbability: 0.29, placeProbability: 0.52, confidence: "high", valueRating: "strong", factors: ["Good form last 3 runs", "Preferred distance"] },
          { horseName: "Rapid Queen", barrier: 7, winProbability: 0.23, placeProbability: 0.45, confidence: "medium", valueRating: "fair", factors: ["Consistent runner", "Draws wide"] },
          { horseName: "Night Runner", barrier: 1, winProbability: 0.19, placeProbability: 0.40, confidence: "medium", valueRating: "fair", factors: ["Inside barrier advantage", "Wet track specialist"] },
          { horseName: "Thunder Bolt", barrier: 5, winProbability: 0.14, placeProbability: 0.32, confidence: "low", valueRating: "poor", factors: ["Class drop", "First time blinkers"] },
          { horseName: "Silver Lining", barrier: 2, winProbability: 0.10, placeProbability: 0.25, confidence: "low", valueRating: "poor", factors: ["Returning from spell", "Untested distance"] },
          { horseName: "Lucky Charm", barrier: 4, winProbability: 0.05, placeProbability: 0.15, confidence: "low", valueRating: "avoid", factors: ["Poor recent form", "Not suited to track"] },
        ],
      },
      source: "fallback",
    });
  }

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
