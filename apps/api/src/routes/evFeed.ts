import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma: any = new PrismaClient();

// GET /api/ev-feed/today (and /api/ev-feed)
const handleGetTodayFeed = async (req: any, res: any) => {
  try {
    const { sport } = req.query;
    const where: any = {};
    if (sport && typeof sport === "string") {
      where.sport = sport.toLowerCase();
    }

    let legs = await prisma.dailyEVFeed.findMany({
      where,
      orderBy: { edgePct: "desc" },
      take: 10,
    });

    // If database returned no rows, attempt query to ML Engine if running
    if (!legs || legs.length === 0) {
      const mlApi = process.env.ML_API_URL || "http://127.0.0.1:8000";
      const sportParam = sport ? `?sport=${sport}` : "";
      try {
        const mlRes = await fetch(`${mlApi}/api/ev-feed/today${sportParam}`, { signal: AbortSignal.timeout(2000) });
        if (mlRes.ok) {
          const mlData = await mlRes.json();
          if (Array.isArray(mlData) && mlData.length > 0) {
            legs = mlData.map((d: any) => ({
              id: String(d.id || `ev-${d.sport}-${d.leg_description}`),
              sport: d.sport,
              gameContext: d.game_context,
              legDescription: d.leg_description,
              trueProb: d.true_prob,
              bestOdds: d.best_odds,
              edgePct: d.edge_pct,
              correlationGroup: d.correlation_group,
              backPrice: d.back_price ?? d.best_odds,
              layPrice: d.lay_price,
              createdAt: d.created_at || new Date().toISOString(),
            }));
          }
        }
      } catch {
        // ML Engine unreachable or timed out; strictly return empty array without mock data
      }
    }

    // Zero mock data fallback: Return explicit empty array if nothing found
    const formatted = (legs || []).map((leg: any) => ({
      id: leg.id,
      sport: leg.sport,
      gameContext: leg.gameContext,
      game_context: leg.gameContext,
      legDescription: leg.legDescription,
      leg_description: leg.legDescription,
      trueProb: leg.trueProb,
      true_prob: leg.trueProb,
      bestOdds: leg.bestOdds,
      best_odds: leg.bestOdds,
      edgePct: leg.edgePct,
      edge_pct: leg.edgePct,
      correlationGroup: leg.correlationGroup,
      correlation_group: leg.correlationGroup,
      backPrice: leg.backPrice ?? leg.bestOdds,
      back_price: leg.backPrice ?? leg.bestOdds,
      layPrice: leg.layPrice ?? null,
      lay_price: leg.layPrice ?? null,
      createdAt: leg.createdAt,
      created_at: leg.createdAt,
    }));

    return res.json({
      success: true,
      count: formatted.length,
      feed: formatted,
    });
  } catch (error: any) {
    console.error("Error fetching daily EV feed:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch daily EV feed",
      feed: [],
      count: 0,
    });
  }
};

router.get("/today", handleGetTodayFeed);
router.get("/", handleGetTodayFeed);

export default router;
