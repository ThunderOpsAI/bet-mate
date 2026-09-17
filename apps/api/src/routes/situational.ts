import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// GET /api/situational/runners/:runnerId
router.get("/runners/:runnerId", async (req, res) => {
  try {
    const { runnerId } = req.params;
    const { venue, condition, distance } = req.query;

    const whereClause: any = {
      OR: [
        { runnerId },
        { runnerName: { equals: runnerId, mode: "insensitive" } },
      ],
    };

    if (venue && typeof venue === "string") {
      whereClause.venue = { contains: venue, mode: "insensitive" };
    }
    if (condition && typeof condition === "string") {
      whereClause.trackCondition = { contains: condition, mode: "insensitive" };
    }
    if (distance && !isNaN(Number(distance))) {
      whereClause.distance = {
        gte: Number(distance) - 100,
        lte: Number(distance) + 100,
      };
    }

    const results = await (prisma as any).raceResult.findMany({
      where: whereClause,
      orderBy: { raceDate: "desc" },
      take: 50,
    });

    const totalRuns = results.length;
    const wins = results.filter((r: any) => r.finishPosition === 1).length;
    const places = results.filter((r: any) => r.finishPosition <= 3).length;
    const winPct = totalRuns > 0 ? Number(((wins / totalRuns) * 100).toFixed(1)) : 0;
    const placePct = totalRuns > 0 ? Number(((places / totalRuns) * 100).toFixed(1)) : 0;

    return res.json({
      runnerId,
      filters: { venue: venue || null, condition: condition || null, distance: distance || null },
      summary: {
        totalRuns,
        wins,
        places,
        winPct,
        placePct,
        patternDescription:
          totalRuns > 0
            ? `In ${totalRuns} conditional run(s)${venue ? ` at ${venue}` : ""}${condition ? ` on ${condition} tracks` : ""}, won ${wins} (${winPct}%) and placed in ${places} (${placePct}%).`
            : "No conditional history records matched.",
      },
      records: results,
    });
  } catch (error: any) {
    console.error("Error fetching situational history:", error);
    return res.status(500).json({ error: "Failed to query situational history" });
  }
});

// GET /api/situational/teams/:teamName
router.get("/teams/:teamName", async (req, res) => {
  try {
    const { teamName } = req.params;
    const { venue, opponent } = req.query;

    const whereClause: any = {
      OR: [
        { homeTeam: { equals: teamName, mode: "insensitive" } },
        { awayTeam: { equals: teamName, mode: "insensitive" } },
      ],
    };

    if (venue && typeof venue === "string") {
      whereClause.venue = { contains: venue, mode: "insensitive" };
    }
    if (opponent && typeof opponent === "string") {
      whereClause.AND = [
        {
          OR: [
            { homeTeam: { equals: opponent, mode: "insensitive" } },
            { awayTeam: { equals: opponent, mode: "insensitive" } },
          ],
        },
      ];
    }

    const matches = await (prisma as any).matchResult.findMany({
      where: whereClause,
      orderBy: { matchDate: "desc" },
      take: 50,
    });

    const totalMatches = matches.length;
    const wins = matches.filter((m: any) => m.winner?.toLowerCase() === teamName.toLowerCase()).length;
    const winPct = totalMatches > 0 ? Number(((wins / totalMatches) * 100).toFixed(1)) : 0;

    return res.json({
      teamName,
      filters: { venue: venue || null, opponent: opponent || null },
      summary: {
        totalMatches,
        wins,
        winPct,
        patternDescription:
          totalMatches > 0
            ? `In ${totalMatches} match(es)${venue ? ` at ${venue}` : ""}${opponent ? ` against ${opponent}` : ""}, won ${wins} (${winPct}%).`
            : "No conditional history records matched.",
      },
      records: matches,
    });
  } catch (error: any) {
    console.error("Error fetching team situational history:", error);
    return res.status(500).json({ error: "Failed to query team situational history" });
  }
});

// GET /api/situational/runners/:runnerId/recent-results
router.get("/runners/:runnerId/recent-results", async (req, res) => {
  try {
    const { runnerId } = req.params;
    const results = await (prisma as any).raceResult.findMany({
      where: {
        OR: [
          { runnerId },
          { runnerName: { equals: runnerId, mode: "insensitive" } },
        ],
      },
      orderBy: { raceDate: "desc" },
      take: 5,
    });
    return res.json({ runnerId, results });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to fetch recent results" });
  }
});

// GET /api/situational/teams/:teamName/recent-results
router.get("/teams/:teamName/recent-results", async (req, res) => {
  try {
    const { teamName } = req.params;
    const matches = await (prisma as any).matchResult.findMany({
      where: {
        OR: [
          { homeTeam: { equals: teamName, mode: "insensitive" } },
          { awayTeam: { equals: teamName, mode: "insensitive" } },
        ],
      },
      orderBy: { matchDate: "desc" },
      take: 5,
    });
    return res.json({ teamName, matches });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to fetch recent team results" });
  }
});

// POST /api/situational/backfill
router.post("/backfill", async (_req, res) => {
  try {
    const sampleRaces = [
      {
        raceId: "flemington-r1-2026-08-01",
        venue: "Flemington",
        raceDate: new Date("2026-08-01"),
        trackCondition: "Good 4",
        distance: 1200,
        runnerId: "horse-101",
        runnerName: "Thunder Bolt",
        jockeyName: "J. McDonald",
        trainerName: "C. Waller",
        barrier: 3,
        weight: 56.5,
        finishPosition: 1,
        startingPrice: 3.2,
      },
      {
        raceId: "flemington-r3-2026-07-15",
        venue: "Flemington",
        raceDate: new Date("2026-07-15"),
        trackCondition: "Soft 6",
        distance: 1200,
        runnerId: "horse-101",
        runnerName: "Thunder Bolt",
        jockeyName: "J. McDonald",
        trainerName: "C. Waller",
        barrier: 2,
        weight: 56.0,
        finishPosition: 1,
        startingPrice: 2.8,
      },
      {
        raceId: "caulfield-r5-2026-06-20",
        venue: "Caulfield",
        raceDate: new Date("2026-06-20"),
        trackCondition: "Good 3",
        distance: 1400,
        runnerId: "horse-101",
        runnerName: "Thunder Bolt",
        jockeyName: "D. Lane",
        trainerName: "C. Waller",
        barrier: 7,
        weight: 57.0,
        finishPosition: 2,
        startingPrice: 4.5,
      },
    ];

    let count = 0;
    for (const r of sampleRaces) {
      await (prisma as any).raceResult.create({ data: r });
      count++;
    }

    return res.json({ ok: true, seeded: count });
  } catch (error: any) {
    console.error("Backfill error:", error);
    return res.status(500).json({ error: "Failed to backfill data" });
  }
});

export default router;
