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
    let race = null;
    try {
      race = await prisma.race.findUnique({
        where: { id: raceId },
        include: { predictions: { orderBy: { winProbability: "desc" } } },
      });
    } catch (dbError: any) {
      console.error("Prisma lookup failed, falling back to ML API:", dbError.message);
    }

    if (race) {
      return res.json({ race, source: "database" });
    }

    // Fallback: Check ML prediction engine live races
    try {
      const mlApi = process.env.ML_API_URL || "http://127.0.0.1:8000";
      // Fetch today and tomorrow's races to ensure we cover all live dashboard scenarios
      const [todayRes, tomorrowRes] = await Promise.all([
        fetch(`${mlApi}/api/races/today`).catch(() => null),
        fetch(`${mlApi}/api/races/today?date=${new Date(Date.now() + 86400000).toISOString().split('T')[0]}`).catch(() => null)
      ]);
      
      let allRaces: any[] = [];
      if (todayRes && todayRes.ok) {
        const data = await todayRes.json();
        allRaces = allRaces.concat(data.races || []);
      }
      if (tomorrowRes && tomorrowRes.ok) {
        const data = await tomorrowRes.json();
        allRaces = allRaces.concat(data.races || []);
      }

      const liveRace = allRaces.find((r: any) => r.race_id === raceId);
      if (liveRace) {
        const transformed = {
          id: liveRace.race_id,
          raceNumber: liveRace.race_number,
          venue: liveRace.venue,
          raceDate: liveRace.start_time,
          distanceMeters: liveRace.distance,
          trackCondition: "Good",
          predictions: (liveRace.horses || []).map((h: any) => ({
            horseName: h.name,
            barrier: h.barrier,
            winProbability: h.prediction?.win_probability ? h.prediction.win_probability / 100 : 0.05,
            placeProbability: h.prediction?.place_probability ? h.prediction.place_probability / 100 : undefined,
            confidence: (h.prediction?.win_probability || 0) > 30 ? "high" : (h.prediction?.win_probability || 0) > 10 ? "medium" : "low",
            valueRating: (h.prediction?.win_probability || 0) > 20 ? "strong" : "fair",
            factors: []
          })).sort((a: any, b: any) => b.winProbability - a.winProbability)
        };
        return res.json({ race: transformed, source: "ml_engine" });
      }
    } catch (mlError) {
      console.error("ML API Fallback Error:", mlError);
      return res.status(502).json({ error: "Upstream prediction engine unavailable" });
    }

    return res.status(404).json({ error: "Race not found" });
  } catch (error: any) {
    console.error(error); return res.status(500).json({ error: "Failed to fetch race", details: error.message, stack: error.stack });
  }
});

export default router;
