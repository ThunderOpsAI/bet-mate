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
        const where: any = {};
        if (sport && typeof sport === "string") {
          where.sport = sport.toLowerCase();
        }

        // Only query feeds from within the last 20 hours (today's active races)
        const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);
        where.createdAt = { gte: twentyHoursAgo };

        // Cap unrealistic illiquid outlier odds (e.g. $140, $200) and corrupted edge percentages
        where.bestOdds = { lte: 51.0, gt: 1.01 };
        where.edgePct = { lte: 200.0, gt: 0.0 };

        // Purge stale records older than 48 hours to keep the feed clean
        void prisma.dailyEVFeed
          .deleteMany({
            where: { createdAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
          })
          .catch(() => null);

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
            const mlRes = await fetch(`${mlApi}/api/ev-feed/today${sportParam}`, { signal: AbortSignal.timeout(12000) });
            if (mlRes.ok) {
              const mlData = await mlRes.json();
              if (Array.isArray(mlData) && mlData.length > 0) {
                legs = mlData
                  .filter((d: any) => {
                    const odds = Number(d.best_odds || d.back_price || 0);
                    const edge = Number(d.edge_pct || 0);
                    return odds > 1.01 && odds <= 51.0 && edge > 0 && edge <= 200.0;
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
          } catch {
            // ML Engine unreachable or timed out; strictly return empty array without mock data
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
