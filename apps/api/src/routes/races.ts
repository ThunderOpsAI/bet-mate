import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma: any = new PrismaClient();

// GET /api/races/today
router.get("/today", async (req, res) => {
  try {
    const mlApi = process.env.ML_API_URL || "http://127.0.0.1:8000";
    const dateQuery = req.query.date ? `?date=${req.query.date}` : "";
    const response = await fetch(`${mlApi}/api/races/today${dateQuery}`);
    
    if (!response.ok) {
      throw new Error(`ML API returned ${response.status}`);
    }
    
    const data = await response.json();
    return res.json({ races: data.races || [], source: "ml_engine" });
  } catch (error: any) {
    console.error("Failed to fetch races for /today:", error);
    return res.status(503).json({
      races: [],
      source: "error",
      message: "Failed to fetch races from ML Engine",
    });
  }
});

// GET /api/races/blackbook-running-today
router.get("/blackbook-running-today", async (req, res) => {
  try {
    const mlApi = process.env.ML_API_URL || "http://127.0.0.1:8000";
    const authHeader = req.headers.authorization;
    const response = await fetch(`${mlApi}/blackbook/running-today`, {
      headers: authHeader ? { Authorization: authHeader } : undefined
    });
    
    if (!response.ok) {
      throw new Error(`ML API returned ${response.status}`);
    }
    
    const runners = await response.json();
    
    // Fallback mlFairOdds if not present
    const updatedRunners = (runners || []).map((runner: any) => ({
      ...runner,
      mlFairOdds: runner.mlFairOdds || (runner.winProbability ? parseFloat((1 / (runner.winProbability / 100)).toFixed(2)) : 999.0)
    }));
    
    return res.json(updatedRunners);
  } catch (error: any) {
    console.error("Failed to fetch blackbook running today:", error);
    return res.status(503).json([]);
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
        let predictions: any = {};
        try {
          const predRes = await fetch(`${mlApi}/api/predict/racing`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(liveRace)
          });
          if (predRes.ok) {
            predictions = await predRes.json();
          }
        } catch (e) {
          console.error("Failed to fetch predictions for single race fallback:", e);
        }

        const transformed = {
          id: liveRace.race_id,
          raceNumber: liveRace.race_number,
          venue: liveRace.venue,
          raceDate: liveRace.start_time,
          distanceMeters: liveRace.distance,
          trackCondition: "Good",
          predictions: (liveRace.horses || []).map((h: any) => {
            const predArray = Array.isArray(predictions?.predictions) ? predictions.predictions : [];
            const p = predArray.find((item: any) => item.name === h.name || item.horse_id === h.horse_id);
            const winProb = p?.win_probability ? p.win_probability / 100 : 0.05;
            const placeProb = p?.place_probability ? p.place_probability / 100 : undefined;
            return {
              horseName: h.name,
              barrier: h.barrier,
              odds: h.betfair_back_price,
              winProbability: winProb,
              placeProbability: placeProb,
              confidence: winProb > 0.3 ? "high" : winProb > 0.1 ? "medium" : "low",
              valueRating: winProb > 0.2 ? "strong" : "fair",
              factors: p?.key_factors || []
            };
          }).sort((a: any, b: any) => b.winProbability - a.winProbability)
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
