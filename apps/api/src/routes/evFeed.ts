import { Router } from "express";
import prismaClient from "../services/prisma";
import { getOrSetCache } from "../services/cache";

const router = Router();
const prisma: any = prismaClient;

// GET /api/ev-feed/today (and /api/ev-feed)
const handleGetTodayFeed = async (req: any, res: any) => {
  try {
    const { sport } = req.query;
    const bypassCache = req.headers["x-refresh"] === "true" || req.query.refresh === "true";
    const cacheKey = `ev_feed:${(sport as string) || "all"}`;

    const formatted = await getOrSetCache(
      cacheKey,
      25, // 25s TTL
      async () => {
        let legs: any[] = [];

        // 1. Attempt database query with resilience
        try {
          const where: any = {};
          if (sport && typeof sport === "string") {
            where.sport = sport.toLowerCase();
          }

          where.bestOdds = { gt: 1.01 };
          where.edgePct = { gt: 0.0 };

          legs = await prisma.dailyEVFeed.findMany({
            where,
            orderBy: { edgePct: "desc" },
            take: 10,
          });
        } catch (dbErr) {
          console.warn("[evFeed] Database query failed or unavailable, falling back to ML Engine:", dbErr);
          legs = [];
        }

        // 2. If database returned no rows, attempt query to ML Engine
        if (!legs || legs.length === 0) {
          const mlApi = process.env.ML_API_URL || "https://thunderops-ai--betmate-prediction-engine-web.modal.run";
          const sportParam = sport ? `?sport=${sport}` : "";
          try {
            const mlRes = await fetch(`${mlApi}/api/ev-feed/today${sportParam}`, { signal: AbortSignal.timeout(12000) });
            if (mlRes.ok) {
              const mlData = await mlRes.json();
              if (Array.isArray(mlData) && mlData.length > 0) {
                legs = mlData
                  .filter((d: any) => {
                    const odds = Number(d.best_odds || d.back_price || 0);
                    const edge = Number(d.edge_pct || 0);
                    return odds > 1.01 && edge > 0;
                  })
                  .map((d: any) => ({
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
          } catch (mlErr) {
            console.warn("[evFeed] ML Engine fetch failed:", mlErr);
          }
        }

        // Zero mock data fallback: Return explicit empty array if nothing found
        return (legs || []).map((leg: any) => ({
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
      },
      bypassCache
    );

    res.setHeader("Cache-Control", "public, s-maxage=25, stale-while-revalidate=59");

    return res.json({
      success: true,
      count: formatted.length,
      feed: formatted,
    });
  } catch (error: any) {
    console.error("Error fetching daily EV feed:", error);
    try {
      const mlApi = process.env.ML_API_URL || "https://thunderops-ai--betmate-prediction-engine-web.modal.run";
      const mlRes = await fetch(`${mlApi}/api/ev-feed/today`, { signal: AbortSignal.timeout(8000) });
      if (mlRes.ok) {
        const mlData = await mlRes.json();
        if (Array.isArray(mlData)) {
          return res.json({
            success: true,
            count: mlData.length,
            feed: mlData,
          });
        }
      }
    } catch {
      // Fall through to empty array
    }
    return res.json({
      success: true,
      error: null,
      feed: [],
      count: 0,
    });
  }
};

router.get("/today", handleGetTodayFeed);
router.get("/", handleGetTodayFeed);

export default router;
