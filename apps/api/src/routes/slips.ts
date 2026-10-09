import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const router = Router();
const prisma: any = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET ?? "change-me-in-production";

function getOptionalUserId(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, jwtSecret) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "BM-";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST /api/slips - Save or Share a slip
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = getOptionalUserId(req);
    const {
      name,
      slipType = "MULTI",
      riskProfile,
      healthScore,
      combinedOdds = 1.0,
      fairOdds,
      edgePct,
      kellyStake,
      actualStake,
      legs = [],
    } = req.body;

    // Resolve an owner userId (either authenticated user, or first user in db, or create anonymous placeholder)
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const firstUser = await prisma.user.findFirst({ select: { id: true } });
      if (firstUser) {
        effectiveUserId = firstUser.id;
      } else {
        // Fallback demo user if none exists
        const demoUser = await prisma.user.create({
          data: {
            email: `guest_${Date.now()}@betmate.internal`,
            username: `guest_${Date.now().toString().slice(-4)}`,
            passwordHash: "guest",
            currentBankroll: 10000,
          },
        });
        effectiveUserId = demoUser.id;
      }
    }

    const shareCode = generateShareCode();

    const slip = await prisma.slip.create({
      data: {
        userId: effectiveUserId,
        name: name || "My Saved Multi",
        slipType: String(slipType).toUpperCase(),
        riskProfile: riskProfile || "BALANCED",
        healthScore: healthScore || null,
        combinedOdds: Number(combinedOdds) || 1.0,
        fairOdds: fairOdds ? Number(fairOdds) : null,
        edgePct: edgePct ? Number(edgePct) : null,
        kellyStake: kellyStake ? Number(kellyStake) : null,
        actualStake: actualStake ? Number(actualStake) : null,
        isShared: true,
        shareCode,
        status: "DRAFT",
        legs: {
          create: legs.map((leg: any) => ({
            sport: leg.sport || "sport",
            gameId: String(leg.event_id || leg.gameId || "game"),
            marketType: String(leg.bet_type || leg.marketType || "head_to_head"),
            selection: String(leg.selection || leg.runner_name || "Selection"),
            line: leg.line ? Number(leg.line) : null,
            odds: Number(leg.odds) || 1.01,
            fairOdds: leg.fairOdds ? Number(leg.fairOdds) : null,
            modelProb: leg.modelProb ? Number(leg.modelProb) : null,
            edgePct: leg.edgePct ? Number(leg.edgePct) : null,
            confidence: leg.confidence ? Number(leg.confidence) : null,
            rationale: leg.rationale || null,
            correlationTag: leg.correlationTag || null,
            isWeakestLeg: Boolean(leg.isWeakestLeg || leg.is_weakest),
            status: "PENDING",
          })),
        },
      },
      include: {
        legs: true,
      },
    });

    return res.status(201).json({
      success: true,
      slip,
      shareCode: slip.shareCode,
    });
  } catch (error: any) {
    console.error("Failed to save slip:", error);
    return res.status(500).json({
      error: "Failed to save slip",
      details: error?.message || "Internal error",
    });
  }
});

// GET /api/slips - List saved slips for user
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = getOptionalUserId(req);
    if (!userId) {
      return res.json({ slips: [] });
    }

    const slips = await prisma.slip.findMany({
      where: { userId },
      include: { legs: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return res.json({ slips });
  } catch (error: any) {
    console.error("Failed to list slips:", error);
    return res.status(500).json({ error: "Failed to list slips" });
  }
});

// GET /api/slips/history/roi-breakdown - Slip history ROI analytics breakdown by leg type, sport, and market
router.get("/history/roi-breakdown", async (req: Request, res: Response) => {
  try {
    const userId = getOptionalUserId(req);
    const where: any = {
      status: { in: ["WON", "LOST", "VOID", "SETTLED"] },
    };
    if (userId) {
      where.userId = userId;
    }

    const settledSlips = await prisma.slip.findMany({
      where,
      include: { legs: true },
      orderBy: { settledAt: "desc" },
    });

    if (settledSlips.length === 0) {
      return res.json({
        status: "empty",
        message: "No settled slips in history yet.",
        summary: null,
        byLegType: [],
        bySport: [],
        byMarket: [],
      });
    }

    let totalStaked = 0;
    let totalPayout = 0;
    let wonCount = 0;
    let lostCount = 0;
    let voidCount = 0;

    const byLegTypeMap: Record<string, { staked: number; payout: number; bets: number; wins: number }> = {};
    const bySportMap: Record<string, { staked: number; payout: number; bets: number; wins: number }> = {};
    const byMarketMap: Record<string, { staked: number; payout: number; bets: number; wins: number }> = {};

    let totalLegsEvaluated = 0;
    let clvBeatenLegs = 0;

    for (const slip of settledSlips) {
      const stake = Number(slip.actualStake || slip.kellyStake || 10);
      const isWon = slip.status === "WON";
      const isLost = slip.status === "LOST";
      const payout = isWon ? stake * Number(slip.combinedOdds || 1) : 0;

      totalStaked += stake;
      totalPayout += payout;
      if (isWon) wonCount++;
      if (isLost) lostCount++;
      if (slip.status === "VOID") voidCount++;

      const legCount = slip.legs?.length || 1;
      let legTypeCategory = "Singles";
      if (slip.slipType === "SGM") legTypeCategory = "Same Game Multi (SGM)";
      else if (legCount === 2) legTypeCategory = "2-Leg Doubles";
      else if (legCount === 3) legTypeCategory = "3-Leg Trebles";
      else if (legCount >= 4) legTypeCategory = "4+ Leg Multis";

      if (!byLegTypeMap[legTypeCategory]) {
        byLegTypeMap[legTypeCategory] = { staked: 0, payout: 0, bets: 0, wins: 0 };
      }
      byLegTypeMap[legTypeCategory].staked += stake;
      byLegTypeMap[legTypeCategory].payout += payout;
      byLegTypeMap[legTypeCategory].bets += 1;
      if (isWon) byLegTypeMap[legTypeCategory].wins += 1;

      for (const leg of slip.legs || []) {
        totalLegsEvaluated++;
        const legSport = (leg.sport || "Other").toUpperCase();
        const legMarket = leg.marketType || "Head to Head";

        if (!bySportMap[legSport]) bySportMap[legSport] = { staked: 0, payout: 0, bets: 0, wins: 0 };
        bySportMap[legSport].staked += stake / legCount;
        bySportMap[legSport].payout += payout / legCount;
        bySportMap[legSport].bets += 1;
        if (leg.status === "WON") bySportMap[legSport].wins += 1;

        if (!byMarketMap[legMarket]) byMarketMap[legMarket] = { staked: 0, payout: 0, bets: 0, wins: 0 };
        byMarketMap[legMarket].staked += stake / legCount;
        byMarketMap[legMarket].payout += payout / legCount;
        byMarketMap[legMarket].bets += 1;
        if (leg.status === "WON") byMarketMap[legMarket].wins += 1;

        if (leg.fairOdds && leg.odds > leg.fairOdds) {
          clvBeatenLegs++;
        }
      }
    }

    const netProfit = totalPayout - totalStaked;
    const overallRoi = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0;
    const winRate = settledSlips.length > 0 ? (wonCount / settledSlips.length) * 100 : 0;
    const clvBeatRate = totalLegsEvaluated > 0 ? (clvBeatenLegs / totalLegsEvaluated) * 100 : 0;

    const formatBreakdown = (map: Record<string, { staked: number; payout: number; bets: number; wins: number }>) =>
      Object.entries(map).map(([key, data]) => {
        const profit = data.payout - data.staked;
        const roi = data.staked > 0 ? (profit / data.staked) * 100 : 0;
        const wr = data.bets > 0 ? (data.wins / data.bets) * 100 : 0;
        return {
          category: key,
          staked: Number(data.staked.toFixed(2)),
          payout: Number(data.payout.toFixed(2)),
          netProfit: Number(profit.toFixed(2)),
          roiPct: Number(roi.toFixed(1)),
          betsPlaced: data.bets,
          wins: data.wins,
          winRatePct: Number(wr.toFixed(1)),
        };
      });

    return res.json({
      status: "ok",
      summary: {
        totalSlips: settledSlips.length,
        wonSlips: wonCount,
        lostSlips: lostCount,
        voidSlips: voidCount,
        winRatePct: Number(winRate.toFixed(1)),
        totalStaked: Number(totalStaked.toFixed(2)),
        totalPayout: Number(totalPayout.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        overallRoiPct: Number(overallRoi.toFixed(1)),
        clvBeatRatePct: Number(clvBeatRate.toFixed(1)),
      },
      byLegType: formatBreakdown(byLegTypeMap),
      bySport: formatBreakdown(bySportMap),
      byMarket: formatBreakdown(byMarketMap),
    });
  } catch (error: any) {
    console.error("Error computing ROI breakdown:", error);
    return res.status(500).json({ error: "Failed to compute ROI breakdown" });
  }
});

// GET /api/slips/:idOrCode/post-mortem - Leg-by-leg tracking & post-mortem analysis
router.get("/:idOrCode/post-mortem", async (req: Request, res: Response) => {
  try {
    const { idOrCode } = req.params;

    const slip = await prisma.slip.findFirst({
      where: {
        OR: [{ id: idOrCode }, { shareCode: idOrCode.toUpperCase() }],
      },
      include: { legs: true },
    });

    if (!slip) {
      return res.status(404).json({ error: "Slip not found" });
    }

    const legsWithAnalysis = slip.legs.map((leg: any) => {
      const line = leg.line;
      const resultValue = leg.resultValue;
      let outcomeDiff = null;
      let clvPct = null;

      if (line !== null && resultValue !== null) {
        outcomeDiff = Number((resultValue - line).toFixed(1));
      }

      if (leg.fairOdds && leg.odds) {
        clvPct = Number((((leg.odds - leg.fairOdds) / leg.fairOdds) * 100).toFixed(1));
      }

      return {
        ...leg,
        outcomeDiff,
        clvPct,
        beatCLV: clvPct !== null ? clvPct > 0 : false,
      };
    });

    const wonLegs = legsWithAnalysis.filter((l: any) => l.status === "WON").length;
    const lostLegs = legsWithAnalysis.filter((l: any) => l.status === "LOST").length;
    const totalLegs = legsWithAnalysis.length;

    let postMortemDiagnosis = "Pending final settlement of game events.";
    if (slip.status === "WON") {
      postMortemDiagnosis = `Clean sweep! All ${totalLegs} legs hit with positive model expectancy.`;
    } else if (slip.status === "LOST") {
      const weakestLost = legsWithAnalysis.find((l: any) => l.isWeakestLeg && l.status === "LOST");
      if (weakestLost) {
        postMortemDiagnosis = `Predicted vulnerability realized: Identified weakest leg '${weakestLost.selection}' failed to cover line.`;
      } else if (lostLegs === 1) {
        postMortemDiagnosis = `Heartbreaker 1-leg miss: ${wonLegs} of ${totalLegs} legs hit. Re-evaluate correlation penalty on single failing leg.`;
      } else {
        postMortemDiagnosis = `Multi broke down with ${lostLegs} failing legs. Variance or adverse game script disrupted expected distributions.`;
      }
    }

    return res.json({
      status: "ok",
      slip: {
        id: slip.id,
        name: slip.name,
        slipType: slip.slipType,
        status: slip.status,
        combinedOdds: slip.combinedOdds,
        actualStake: slip.actualStake,
        settledAt: slip.settledAt,
        shareCode: slip.shareCode,
        wonLegs,
        lostLegs,
        totalLegs,
        postMortemDiagnosis,
        legs: legsWithAnalysis,
      },
    });
  } catch (error: any) {
    console.error("Error generating slip post-mortem:", error);
    return res.status(500).json({ error: "Failed to generate post-mortem" });
  }
});

// PATCH /api/slips/:idOrCode/settle - Settle slip and its legs
router.patch("/:idOrCode/settle", async (req: Request, res: Response) => {
  try {
    const { idOrCode } = req.params;
    const { status, legsResults = [] } = req.body;

    const slip = await prisma.slip.findFirst({
      where: {
        OR: [{ id: idOrCode }, { shareCode: idOrCode.toUpperCase() }],
      },
      include: { legs: true },
    });

    if (!slip) {
      return res.status(404).json({ error: "Slip not found" });
    }

    // Update individual legs if provided
    for (const legRes of legsResults) {
      if (legRes.id) {
        await prisma.slipLeg.update({
          where: { id: legRes.id },
          data: {
            status: legRes.status || "PENDING",
            resultValue: legRes.resultValue !== undefined ? Number(legRes.resultValue) : undefined,
          },
        });
      }
    }

    const updatedSlip = await prisma.slip.update({
      where: { id: slip.id },
      data: {
        status: status || "SETTLED",
        settledAt: new Date(),
      },
      include: { legs: true },
    });

    return res.json({ success: true, slip: updatedSlip });
  } catch (error: any) {
    console.error("Error settling slip:", error);
    return res.status(500).json({ error: "Failed to settle slip" });
  }
});

// GET /api/slips/:idOrCode - Get slip by ID or share code
router.get("/:idOrCode", async (req: Request, res: Response) => {
  try {
    const { idOrCode } = req.params;

    const slip = await prisma.slip.findFirst({
      where: {
        OR: [{ id: idOrCode }, { shareCode: idOrCode.toUpperCase() }],
      },
      include: { legs: true },
    });

    if (!slip) {
      return res.status(404).json({ error: "Slip not found" });
    }

    return res.json({ slip });
  } catch (error: any) {
    console.error("Failed to get slip:", error);
    return res.status(500).json({ error: "Failed to get slip" });
  }
});

// POST /api/slips/:idOrCode/clone - Clone slip
router.post("/:idOrCode/clone", async (req: Request, res: Response) => {
  try {
    const { idOrCode } = req.params;
    const userId = getOptionalUserId(req);

    const sourceSlip = await prisma.slip.findFirst({
      where: {
        OR: [{ id: idOrCode }, { shareCode: idOrCode.toUpperCase() }],
      },
      include: { legs: true },
    });

    if (!sourceSlip) {
      return res.status(404).json({ error: "Source slip not found" });
    }

    let effectiveUserId = userId || sourceSlip.userId;
    const newShareCode = generateShareCode();

    const clonedSlip = await prisma.slip.create({
      data: {
        userId: effectiveUserId,
        name: `${sourceSlip.name || "Multi"} (Clone)`,
        slipType: sourceSlip.slipType,
        riskProfile: sourceSlip.riskProfile,
        healthScore: sourceSlip.healthScore,
        combinedOdds: sourceSlip.combinedOdds,
        fairOdds: sourceSlip.fairOdds,
        edgePct: sourceSlip.edgePct,
        kellyStake: sourceSlip.kellyStake,
        actualStake: sourceSlip.actualStake,
        isShared: true,
        shareCode: newShareCode,
        status: "DRAFT",
        legs: {
          create: sourceSlip.legs.map((leg: any) => ({
            sport: leg.sport,
            gameId: leg.gameId,
            marketType: leg.marketType,
            selection: leg.selection,
            line: leg.line,
            odds: leg.odds,
            fairOdds: leg.fairOdds,
            modelProb: leg.modelProb,
            edgePct: leg.edgePct,
            confidence: leg.confidence,
            rationale: leg.rationale,
            correlationTag: leg.correlationTag,
            isWeakestLeg: leg.isWeakestLeg,
            status: "PENDING",
          })),
        },
      },
      include: { legs: true },
    });

    return res.status(201).json({ success: true, slip: clonedSlip });
  } catch (error: any) {
    console.error("Failed to clone slip:", error);
    return res.status(500).json({ error: "Failed to clone slip" });
  }
});

export default router;
