import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const router = Router();
const prisma: any = new PrismaClient();

const modelPerformanceSchema = z.object({
  sport: z.string().min(1),
  modelVariant: z.string().min(1),
  evalDate: z.string(), // ISO date string
  sampleSize: z.number().int().positive(),
  brierScore: z.number().optional(),
  calibrationJson: z.array(
    z.object({
      bin: z.string(),
      predicted: z.number(),
      actual: z.number(),
      count: z.number().optional(),
    })
  ),
  simulatedRoi: z.number(),
  actualRoi: z.number().optional(),
});

// GET /api/trust/track-record - Public model track record & calibration curves
router.get("/track-record", async (req: Request, res: Response) => {
  try {
    const { sport, modelVariant } = req.query;

    const where: any = {};
    if (sport && typeof sport === "string") {
      where.sport = sport.toUpperCase();
    }
    if (modelVariant && typeof modelVariant === "string") {
      where.modelVariant = modelVariant;
    }

    const records = await prisma.modelPerformance.findMany({
      where,
      orderBy: { evalDate: "desc" },
      take: 50,
    });

    if (records.length === 0) {
      return res.json({
        trackRecords: [],
        summary: null,
        status: "empty",
        message: "No model performance evaluations recorded yet. Awaiting scheduled backtest calibration run.",
      });
    }

    // Aggregate summary statistics
    let totalSample = 0;
    let brierWeightedSum = 0;
    let simulatedRoiWeightedSum = 0;
    let actualRoiWeightedSum = 0;
    let actualRoiCount = 0;

    for (const r of records) {
      const s = r.sampleSize || 1;
      totalSample += s;
      if (r.brierScore !== null && r.brierScore !== undefined) {
        brierWeightedSum += r.brierScore * s;
      }
      simulatedRoiWeightedSum += r.simulatedRoi * s;
      if (r.actualRoi !== null && r.actualRoi !== undefined) {
        actualRoiWeightedSum += r.actualRoi * s;
        actualRoiCount += s;
      }
    }

    const avgBrier = totalSample > 0 ? Number((brierWeightedSum / totalSample).toFixed(4)) : null;
    const avgSimRoi = totalSample > 0 ? Number((simulatedRoiWeightedSum / totalSample).toFixed(2)) : 0;
    const avgActRoi = actualRoiCount > 0 ? Number((actualRoiWeightedSum / actualRoiCount).toFixed(2)) : null;

    // Aggregate calibration bins from latest records
    const binMap: Record<string, { predictedSum: number; actualSum: number; count: number }> = {};
    for (const r of records) {
      if (Array.isArray(r.calibrationJson)) {
        for (const binItem of r.calibrationJson) {
          const binKey = binItem.bin || "Unknown";
          if (!binMap[binKey]) {
            binMap[binKey] = { predictedSum: 0, actualSum: 0, count: 0 };
          }
          binMap[binKey].predictedSum += Number(binItem.predicted || 0);
          binMap[binKey].actualSum += Number(binItem.actual || 0);
          binMap[binKey].count += 1;
        }
      }
    }

    const aggregatedCalibration = Object.entries(binMap).map(([bin, data]) => ({
      bin,
      predicted: Number((data.predictedSum / data.count).toFixed(3)),
      actual: Number((data.actualSum / data.count).toFixed(3)),
      difference: Number(((data.actualSum - data.predictedSum) / data.count).toFixed(3)),
    }));

    return res.json({
      status: "ok",
      summary: {
        totalEvaluations: records.length,
        totalSampleSize: totalSample,
        weightedBrierScore: avgBrier,
        averageSimulatedRoi: avgSimRoi,
        averageActualRoi: avgActRoi,
      },
      calibrationCurve: aggregatedCalibration,
      trackRecords: records,
    });
  } catch (error: any) {
    console.error("Error fetching model track record:", error);
    return res.status(500).json({ error: "Failed to fetch model track record" });
  }
});

// POST /api/trust/track-record - Record a model evaluation run
router.post("/track-record", async (req: Request, res: Response) => {
  try {
    const parsed = modelPerformanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid evaluation payload",
        details: parsed.error.flatten(),
      });
    }

    const { sport, modelVariant, evalDate, sampleSize, brierScore, calibrationJson, simulatedRoi, actualRoi } =
      parsed.data;

    const record = await prisma.modelPerformance.upsert({
      where: {
        sport_modelVariant_evalDate: {
          sport: sport.toUpperCase(),
          modelVariant,
          evalDate: new Date(evalDate),
        },
      },
      create: {
        sport: sport.toUpperCase(),
        modelVariant,
        evalDate: new Date(evalDate),
        sampleSize,
        brierScore: brierScore ?? null,
        calibrationJson,
        simulatedRoi,
        actualRoi: actualRoi ?? null,
      },
      update: {
        sampleSize,
        brierScore: brierScore ?? null,
        calibrationJson,
        simulatedRoi,
        actualRoi: actualRoi ?? null,
      },
    });

    return res.status(201).json({
      success: true,
      record,
      status: "ok",
    });
  } catch (error: any) {
    console.error("Error recording model performance:", error);
    return res.status(500).json({ error: "Failed to record model performance" });
  }
});

// GET /api/trust/methodology
router.get("/methodology", (_req: Request, res: Response) => {
  return res.json({
    framework: "BetMate Quantitative Calibration Engine",
    metrics: [
      {
        name: "Brier Score",
        formula: "BS = (1/N) * sum((predicted_prob - actual_outcome)^2)",
        interpretation: "Lower is better. 0.0 is perfect prediction, 0.25 is uninformative coin toss.",
        benchmark: "Sub-0.20 indicates well-calibrated edge over bookmaker consensus.",
      },
      {
        name: "Fractional Kelly Criterion",
        formula: "f* = (p * b - 1) / b * fraction (default 0.25x)",
        interpretation: "Mathematical staking strategy that maximizes logarithmic growth of capital while curbing drawdowns.",
      },
      {
        name: "Closing Line Value (CLV)",
        formula: "CLV % = (bet_odds / closing_odds - 1) * 100",
        interpretation: "Consistent positive CLV proves long-term market beating expectancy independently of short-term variance.",
      },
    ],
  });
});

export default router;
