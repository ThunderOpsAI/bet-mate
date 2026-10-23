import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma: any = new PrismaClient();

// -------------------------------------------------------------
// Helper Functions
// -------------------------------------------------------------

/**
 * Extracts a numeric value for a given market type from a player's statsJson.
 */
function extractStatValue(statsJson: any, market: string): number | null {
  if (!statsJson || typeof statsJson !== "object") return null;

  const normalizedMarket = market.toUpperCase().replace(/_OU$/, "").replace(/[^A-Z0-9]/g, "");

  const fieldAliases: Record<string, string[]> = {
    POINTS: ["points", "pts", "total_points", "score"],
    PTS: ["points", "pts"],
    DISPOSALS: ["disposals", "disp", "touches"],
    TACKLES: ["tackles", "tck"],
    REBOUNDS: ["rebounds", "reb", "total_rebounds"],
    REB: ["rebounds", "reb"],
    ASSISTS: ["assists", "ast"],
    AST: ["assists", "ast"],
    GOALS: ["goals", "gls"],
    PASSINGYARDS: ["passingYards", "passing_yards", "passYds", "pass_yds"],
    RUSHINGYARDS: ["rushingYards", "rushing_yards", "rushYds", "rush_yds"],
    RECEIVINGYARDS: ["receivingYards", "receiving_yards", "recYds", "rec_yds"],
    STEALS: ["steals", "stl"],
    BLOCKS: ["blocks", "blk"],
    THREES: ["threes", "threePointersMade", "three_pointers_made", "fg3m"],
    FANTASYPOINTS: ["fantasyPoints", "fantasy_points", "fanPts"],
    METRES: ["metres", "meters", "metres_gained", "metresGained"],
    MARKS: ["marks", "mrk"],
    CLEARANCES: ["clearances", "clr"],
  };

  const aliases = fieldAliases[normalizedMarket] || [normalizedMarket.toLowerCase()];

  for (const alias of aliases) {
    for (const [key, val] of Object.entries(statsJson)) {
      if (key.toLowerCase().replace(/[^a-z0-9]/g, "") === alias.toLowerCase().replace(/[^a-z0-9]/g, "")) {
        const num = Number(val);
        if (!isNaN(num)) return num;
      }
    }
  }

  for (const [key, val] of Object.entries(statsJson)) {
    const cleanKey = key.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanKey === normalizedMarket || cleanKey.includes(normalizedMarket) || normalizedMarket.includes(cleanKey)) {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
  }

  return null;
}

/**
 * Calculates hit rate metrics against a given line.
 */
function calculateHitRateStats(values: number[], line: number) {
  const totalGames = values.length;
  if (totalGames === 0) {
    return {
      totalGames: 0,
      hits: 0,
      overs: 0,
      unders: 0,
      pushes: 0,
      hitRate: 0,
      averageValue: 0,
      values: [],
    };
  }

  const overs = values.filter((v) => v > line).length;
  const unders = values.filter((v) => v < line).length;
  const pushes = values.filter((v) => v === line).length;
  const hits = overs;
  const hitRate = Number(((hits / totalGames) * 100).toFixed(1));
  const sum = values.reduce((acc, v) => acc + v, 0);
  const averageValue = Number((sum / totalGames).toFixed(2));

  return {
    totalGames,
    hits,
    overs,
    unders,
    pushes,
    hitRate,
    averageValue,
    values,
  };
}

/**
 * Calculates average minutes and stat metrics for an array of PlayerGameStat records.
 */
function calculateStatAverages(gameStats: any[]) {
  if (!gameStats || gameStats.length === 0) {
    return { games: 0, minutes: 0, averages: {} };
  }

  const gamesCount = gameStats.length;
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};

  let minutesSum = 0;
  let minutesCount = 0;

  for (const stat of gameStats) {
    if (stat.minutes !== null && stat.minutes !== undefined && !isNaN(Number(stat.minutes))) {
      minutesSum += Number(stat.minutes);
      minutesCount++;
    }

    if (stat.statsJson && typeof stat.statsJson === "object") {
      for (const [key, val] of Object.entries(stat.statsJson)) {
        const num = Number(val);
        if (!isNaN(num)) {
          sums[key] = (sums[key] || 0) + num;
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    }
  }

  const averages: Record<string, number> = {};
  const avgMinutes = minutesCount > 0 ? Number((minutesSum / minutesCount).toFixed(1)) : 0;

  for (const [key, sum] of Object.entries(sums)) {
    const c = counts[key] || 1;
    averages[key] = Number((sum / c).toFixed(1));
  }

  return {
    games: gamesCount,
    minutes: avgMinutes,
    averages,
  };
}

// -------------------------------------------------------------
// 1. GET /api/stats/player/:id
// -------------------------------------------------------------
router.get("/player/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const player = await prisma.player.findFirst({
      where: {
        OR: [{ id }, { externalId: id }],
      },
      include: {
        gameStats: {
          orderBy: { gameDate: "desc" },
          take: 50,
        },
      },
    });

    if (!player) {
      return res.status(404).json({
        data: null,
        status: "empty",
        message: `Player with id '${id}' was not found`,
      });
    }

    const gameStats = player.gameStats || [];

    if (gameStats.length === 0) {
      return res.json({
        data: {
          player: {
            id: player.id,
            externalId: player.externalId,
            sport: player.sport,
            fullName: player.fullName,
            team: player.team,
            position: player.position,
            jerseyNum: player.jerseyNum,
            status: player.status,
          },
          splits: {
            home: null,
            away: null,
            recent5: null,
            season: null,
          },
          minutesTrends: {
            recentGames: [],
            trend: "insufficient_data",
            l5Average: 0,
            seasonAverage: 0,
          },
          recentGames: [],
        },
        status: "empty",
        message: `No game stats found for player ${player.fullName}`,
      });
    }

    const homeGames = gameStats.filter((g: any) => g.isHome);
    const awayGames = gameStats.filter((g: any) => !g.isHome);
    const l5Games = gameStats.slice(0, 5);

    const homeSplits = calculateStatAverages(homeGames);
    const awaySplits = calculateStatAverages(awayGames);
    const l5Splits = calculateStatAverages(l5Games);
    const seasonSplits = calculateStatAverages(gameStats);

    const recentMinutes = gameStats.slice(0, 10).map((g: any) => ({
      gameId: g.gameId,
      gameDate: g.gameDate,
      opponent: g.opponent,
      isHome: g.isHome,
      minutes: g.minutes !== null ? Number(g.minutes) : null,
    }));

    const l5AvgMin = l5Splits.minutes;
    const seasonAvgMin = seasonSplits.minutes;

    let trend = "stable";
    if (l5AvgMin > seasonAvgMin + 1.5) {
      trend = "increasing";
    } else if (l5AvgMin < seasonAvgMin - 1.5) {
      trend = "decreasing";
    }

    return res.json({
      data: {
        player: {
          id: player.id,
          externalId: player.externalId,
          sport: player.sport,
          fullName: player.fullName,
          team: player.team,
          position: player.position,
          jerseyNum: player.jerseyNum,
          status: player.status,
        },
        splits: {
          home: homeSplits,
          away: awaySplits,
          recent5: l5Splits,
          season: seasonSplits,
        },
        minutesTrends: {
          recentGames: recentMinutes,
          trend,
          l5Average: l5AvgMin,
          seasonAverage: seasonAvgMin,
          diff: Number((l5AvgMin - seasonAvgMin).toFixed(1)),
        },
        recentGames: gameStats.slice(0, 10),
      },
      status: "ok",
    });
  } catch (error: any) {
    console.error("Error fetching player stats:", error);
    return res.status(500).json({ error: "Failed to fetch player stats" });
  }
});

// -------------------------------------------------------------
// 2. GET /api/stats/player/:id/hit-rates
// -------------------------------------------------------------
router.get("/player/:id/hit-rates", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { market, line, opponent } = req.query;

    if (!market || line === undefined || isNaN(Number(line))) {
      return res.status(400).json({
        data: [],
        status: "bad_request",
        message: "Query parameters 'market' (string) and 'line' (number) are required",
      });
    }

    const targetMarket = String(market);
    const targetLine = Number(line);

    const player = await prisma.player.findFirst({
      where: {
        OR: [{ id }, { externalId: id }],
      },
      include: {
        gameStats: {
          orderBy: { gameDate: "desc" },
          take: 50,
        },
      },
    });

    if (!player) {
      return res.status(404).json({
        data: [],
        status: "empty",
        message: `Player with id '${id}' was not found`,
      });
    }

    const gameStats = player.gameStats || [];

    if (gameStats.length === 0) {
      return res.json({
        data: [],
        status: "empty",
        message: `No game stats found for player ${player.fullName}`,
      });
    }

    // Extract stat values for the market across all games
    const validGames: { gameId: string; gameDate: any; opponent: string; isHome: boolean; value: number }[] = [];

    for (const g of gameStats) {
      const val = extractStatValue(g.statsJson, targetMarket);
      if (val !== null) {
        validGames.push({
          gameId: g.gameId,
          gameDate: g.gameDate,
          opponent: g.opponent,
          isHome: g.isHome,
          value: val,
        });
      }
    }

    if (validGames.length === 0) {
      return res.json({
        data: [],
        status: "empty",
        message: `No recorded game stats contain values for market '${targetMarket}'`,
      });
    }

    const seasonValues = validGames.map((g) => g.value);
    const l5Values = validGames.slice(0, 5).map((g) => g.value);
    const l10Values = validGames.slice(0, 10).map((g) => g.value);
    const l20Values = validGames.slice(0, 20).map((g) => g.value);

    // Opponent filtering: use explicit query param if passed, otherwise default to latest opponent
    const targetOpponent = opponent ? String(opponent) : (validGames[0]?.opponent || null);
    const vsOpponentGames = targetOpponent
      ? validGames.filter((g) => g.opponent.toLowerCase() === targetOpponent.toLowerCase())
      : [];
    const vsOpponentValues = vsOpponentGames.map((g) => g.value);

    return res.json({
      data: {
        player: {
          id: player.id,
          fullName: player.fullName,
          team: player.team,
          position: player.position,
          sport: player.sport,
        },
        market: targetMarket,
        line: targetLine,
        targetOpponent,
        hitRates: {
          l5: calculateHitRateStats(l5Values, targetLine),
          l10: calculateHitRateStats(l10Values, targetLine),
          l20: calculateHitRateStats(l20Values, targetLine),
          season: calculateHitRateStats(seasonValues, targetLine),
          vsOpponent: calculateHitRateStats(vsOpponentValues, targetLine),
        },
        recentGames: validGames.slice(0, 10),
      },
      status: "ok",
    });
  } catch (error: any) {
    console.error("Error computing player hit rates:", error);
    return res.status(500).json({ error: "Failed to compute player hit rates" });
  }
});

// -------------------------------------------------------------
// 3. GET /api/stats/defense-vs-position
// -------------------------------------------------------------
router.get("/defense-vs-position", async (req: Request, res: Response) => {
  try {
    const { sport, team } = req.query;

    const playerStatWhere: any = {};
    if (sport && typeof sport === "string") {
      playerStatWhere.sport = sport.toUpperCase();
    }

    const playerStats = await prisma.playerGameStat.findMany({
      where: playerStatWhere,
      include: {
        player: {
          select: {
            position: true,
            sport: true,
          },
        },
      },
      take: 1000,
    });

    if (!playerStats || playerStats.length === 0) {
      return res.json({
        data: [],
        status: "empty",
        message: "No defensive matchup statistics found",
      });
    }

    const teamStatsWhere: any = {};
    if (sport && typeof sport === "string") {
      teamStatsWhere.sport = sport.toUpperCase();
    }
    const teamGameStats = await prisma.teamGameStat.findMany({
      where: teamStatsWhere,
      take: 500,
    });

    // Group player stats conceded by defending team (opponent) and player position
    const defenseByPos: Record<
      string,
      Record<string, { totalPoints: number; count: number; statsSum: Record<string, number> }>
    > = {};

    for (const pgs of playerStats) {
      const defTeam = pgs.opponent;
      const pos = pgs.player?.position || "UNKNOWN";
      if (!defTeam) continue;

      if (!defenseByPos[defTeam]) defenseByPos[defTeam] = {};
      if (!defenseByPos[defTeam][pos]) {
        defenseByPos[defTeam][pos] = { totalPoints: 0, count: 0, statsSum: {} };
      }

      const entry = defenseByPos[defTeam][pos];
      entry.count++;

      if (pgs.statsJson && typeof pgs.statsJson === "object") {
        for (const [k, v] of Object.entries(pgs.statsJson)) {
          const num = Number(v);
          if (!isNaN(num)) {
            entry.statsSum[k] = (entry.statsSum[k] || 0) + num;
            const lk = k.toLowerCase();
            if (lk === "points" || lk === "pts" || lk === "disposals") {
              entry.totalPoints += num;
            }
          }
        }
      }
    }

    const allPositions = new Set<string>();
    for (const defTeam of Object.keys(defenseByPos)) {
      for (const pos of Object.keys(defenseByPos[defTeam])) {
        allPositions.add(pos);
      }
    }

    const positionRankings: Record<string, any[]> = {};

    for (const pos of allPositions) {
      const teamsForPos: any[] = [];
      for (const [defTeam, posMap] of Object.entries(defenseByPos)) {
        const data = posMap[pos];
        if (data && data.count > 0) {
          const avgConceded = Number((data.totalPoints / data.count).toFixed(1));
          const metricAverages: Record<string, number> = {};
          for (const [k, sum] of Object.entries(data.statsSum)) {
            metricAverages[k] = Number((sum / data.count).toFixed(1));
          }
          teamsForPos.push({
            team: defTeam,
            position: pos,
            sampleGames: data.count,
            avgConceded,
            metricAverages,
          });
        }
      }

      // Rank teams: lowest points conceded = best defense (rank 1)
      teamsForPos.sort((a, b) => a.avgConceded - b.avgConceded);
      teamsForPos.forEach((t, idx) => {
        t.rank = idx + 1;
        t.totalTeams = teamsForPos.length;
      });

      positionRankings[pos] = teamsForPos;
    }

    if (team && typeof team === "string") {
      const targetTeamUpper = team.toUpperCase();
      const teamRanks: any[] = [];

      for (const [, teamsList] of Object.entries(positionRankings)) {
        const found = teamsList.find((t) => t.team.toUpperCase() === targetTeamUpper);
        if (found) {
          teamRanks.push(found);
        }
      }

      if (teamRanks.length === 0) {
        return res.json({
          data: [],
          status: "empty",
          message: `No defensive position stats found for team '${team}'`,
        });
      }

      const matchingTeamStats = teamGameStats.filter(
        (t: any) => t.team.toUpperCase() === targetTeamUpper
      );
      const avgPace =
        matchingTeamStats.length > 0
          ? Number(
              (
                matchingTeamStats.reduce((s: number, t: any) => s + (t.pace || 0), 0) /
                matchingTeamStats.length
              ).toFixed(1)
            )
          : null;

      return res.json({
        data: {
          team,
          sport: sport || null,
          pace: avgPace,
          ranks: teamRanks,
        },
        status: "ok",
      });
    }

    return res.json({
      data: positionRankings,
      status: "ok",
    });
  } catch (error: any) {
    console.error("Error calculating defense vs position:", error);
    return res.status(500).json({ error: "Failed to calculate defense vs position" });
  }
});

// -------------------------------------------------------------
// 4. GET /api/stats/team/:team
// -------------------------------------------------------------
router.get("/team/:team", async (req: Request, res: Response) => {
  try {
    const { team } = req.params;
    const { sport } = req.query;

    const where: any = {
      team: { equals: team, mode: "insensitive" },
    };
    if (sport && typeof sport === "string") {
      where.sport = sport.toUpperCase();
    }

    const teamStats = await prisma.teamGameStat.findMany({
      where,
      orderBy: { gameDate: "desc" },
      take: 50,
    });

    if (!teamStats || teamStats.length === 0) {
      return res.json({
        data: [],
        status: "empty",
        message: `No team game stats found for team '${team}'`,
      });
    }

    const totalGames = teamStats.length;
    const wins = teamStats.filter((g: any) => g.score !== null && g.oppScore !== null && g.score > g.oppScore).length;
    const losses = teamStats.filter((g: any) => g.score !== null && g.oppScore !== null && g.score < g.oppScore).length;
    const draws = teamStats.filter((g: any) => g.score !== null && g.oppScore !== null && g.score === g.oppScore).length;
    const winRate = totalGames > 0 ? Number(((wins / totalGames) * 100).toFixed(1)) : 0;

    const gamesWithScore = teamStats.filter((g: any) => g.score !== null);
    const avgScore = gamesWithScore.length > 0
      ? Number((gamesWithScore.reduce((s: number, g: any) => s + (g.score || 0), 0) / gamesWithScore.length).toFixed(1))
      : 0;

    const gamesWithOppScore = teamStats.filter((g: any) => g.oppScore !== null);
    const avgOppScore = gamesWithOppScore.length > 0
      ? Number((gamesWithOppScore.reduce((s: number, g: any) => s + (g.oppScore || 0), 0) / gamesWithOppScore.length).toFixed(1))
      : 0;

    const gamesWithPace = teamStats.filter((g: any) => g.pace !== null && g.pace !== undefined);
    const avgPace = gamesWithPace.length > 0
      ? Number((gamesWithPace.reduce((s: number, g: any) => s + (g.pace || 0), 0) / gamesWithPace.length).toFixed(1))
      : null;

    const l5PaceGames = teamStats.slice(0, 5).filter((g: any) => g.pace !== null && g.pace !== undefined);
    const l5Pace = l5PaceGames.length > 0
      ? Number((l5PaceGames.reduce((s: number, g: any) => s + (g.pace || 0), 0) / l5PaceGames.length).toFixed(1))
      : avgPace;

    const homeGames = teamStats.filter((g: any) => g.isHome && g.oppScore !== null);
    const awayGames = teamStats.filter((g: any) => !g.isHome && g.oppScore !== null);
    const homeOppScoreAvg = homeGames.length > 0
      ? Number((homeGames.reduce((s: number, g: any) => s + (g.oppScore || 0), 0) / homeGames.length).toFixed(1))
      : null;
    const awayOppScoreAvg = awayGames.length > 0
      ? Number((awayGames.reduce((s: number, g: any) => s + (g.oppScore || 0), 0) / awayGames.length).toFixed(1))
      : null;

    const recentScores = teamStats.slice(0, 10).map((g: any) => ({
      gameId: g.gameId,
      gameDate: g.gameDate,
      opponent: g.opponent,
      isHome: g.isHome,
      score: g.score,
      oppScore: g.oppScore,
      result: g.score !== null && g.oppScore !== null
        ? (g.score > g.oppScore ? "W" : g.score < g.oppScore ? "L" : "D")
        : null,
      margin: g.score !== null && g.oppScore !== null ? g.score - g.oppScore : null,
      pace: g.pace,
    }));

    // Aggregate metrics from metricsJson
    const aggregatedMetrics: Record<string, number> = {};
    const metricCounts: Record<string, number> = {};
    for (const g of teamStats) {
      if (g.metricsJson && typeof g.metricsJson === "object") {
        for (const [k, v] of Object.entries(g.metricsJson)) {
          const num = Number(v);
          if (!isNaN(num)) {
            aggregatedMetrics[k] = (aggregatedMetrics[k] || 0) + num;
            metricCounts[k] = (metricCounts[k] || 0) + 1;
          }
        }
      }
    }
    const defensiveMetrics: Record<string, number> = {};
    for (const [k, sum] of Object.entries(aggregatedMetrics)) {
      defensiveMetrics[k] = Number((sum / (metricCounts[k] || 1)).toFixed(1));
    }

    return res.json({
      data: {
        team: teamStats[0].team,
        sport: teamStats[0].sport,
        record: {
          games: totalGames,
          wins,
          losses,
          draws,
          winRate,
        },
        scoring: {
          averageScore: avgScore,
          averageOppScore: avgOppScore,
          averageMargin: Number((avgScore - avgOppScore).toFixed(1)),
        },
        pace: {
          seasonAverage: avgPace,
          l5Average: l5Pace,
        },
        defensiveMetrics: {
          averageOppScoreAllowed: avgOppScore,
          homeOppScoreAllowed: homeOppScoreAvg,
          awayOppScoreAllowed: awayOppScoreAvg,
          advancedMetrics: defensiveMetrics,
        },
        recentScores,
      },
      status: "ok",
    });
  } catch (error: any) {
    console.error("Error fetching team stats:", error);
    return res.status(500).json({ error: "Failed to fetch team stats" });
  }
});

// -------------------------------------------------------------
// 5. GET /api/stats/compare
// -------------------------------------------------------------
router.get("/compare", async (req: Request, res: Response) => {
  try {
    const { playerA, playerB } = req.query;

    if (!playerA || !playerB) {
      return res.status(400).json({
        data: [],
        status: "bad_request",
        message: "Both 'playerA' and 'playerB' query parameters are required",
      });
    }

    const [pA, pB] = await Promise.all([
      prisma.player.findFirst({
        where: { OR: [{ id: String(playerA) }, { externalId: String(playerA) }] },
        include: { gameStats: { orderBy: { gameDate: "desc" }, take: 40 } },
      }),
      prisma.player.findFirst({
        where: { OR: [{ id: String(playerB) }, { externalId: String(playerB) }] },
        include: { gameStats: { orderBy: { gameDate: "desc" }, take: 40 } },
      }),
    ]);

    if (!pA || !pB) {
      const missing = [];
      if (!pA) missing.push(`playerA '${playerA}'`);
      if (!pB) missing.push(`playerB '${playerB}'`);
      return res.status(404).json({
        data: [],
        status: "empty",
        message: `Could not find ${missing.join(" and ")}`,
      });
    }

    const statsA = pA.gameStats || [];
    const statsB = pB.gameStats || [];

    const formatPlayerComparison = (player: any, stats: any[]) => {
      const homeGames = stats.filter((g: any) => g.isHome);
      const awayGames = stats.filter((g: any) => !g.isHome);
      const l5Games = stats.slice(0, 5);

      return {
        profile: {
          id: player.id,
          externalId: player.externalId,
          sport: player.sport,
          fullName: player.fullName,
          team: player.team,
          position: player.position,
          jerseyNum: player.jerseyNum,
          status: player.status,
        },
        seasonStats: calculateStatAverages(stats),
        l5Stats: calculateStatAverages(l5Games),
        homeAwaySplits: {
          home: calculateStatAverages(homeGames),
          away: calculateStatAverages(awayGames),
        },
      };
    };

    // Find head-to-head games (common gameId or playing against each other's team)
    const gamesByIdB = new Map<string, any>(statsB.map((g: any) => [g.gameId, g]));
    const headToHead: any[] = [];

    for (const gA of statsA) {
      const gB = gamesByIdB.get(gA.gameId);
      if (gB) {
        headToHead.push({
          gameId: gA.gameId,
          gameDate: gA.gameDate,
          playerAStats: {
            minutes: gA.minutes,
            stats: gA.statsJson,
          },
          playerBStats: {
            minutes: gB.minutes,
            stats: gB.statsJson,
          },
        });
      }
    }

    return res.json({
      data: {
        playerA: formatPlayerComparison(pA, statsA),
        playerB: formatPlayerComparison(pB, statsB),
        headToHead,
      },
      status: "ok",
    });
  } catch (error: any) {
    console.error("Error comparing players:", error);
    return res.status(500).json({ error: "Failed to compare players" });
  }
});

// -------------------------------------------------------------
// 6. GET /api/stats/games/:gameId
// -------------------------------------------------------------
router.get("/games/:gameId", async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    const [teamStats, propMarkets, playerStats] = await Promise.all([
      prisma.teamGameStat.findMany({
        where: { gameId },
      }),
      prisma.propMarket.findMany({
        where: { gameId },
        include: {
          player: true,
          odds: {
            orderBy: { capturedAt: "desc" },
          },
        },
      }),
      prisma.playerGameStat.findMany({
        where: { gameId },
        include: {
          player: true,
        },
        orderBy: { minutes: "desc" },
      }),
    ]);

    if (
      (!teamStats || teamStats.length === 0) &&
      (!propMarkets || propMarkets.length === 0) &&
      (!playerStats || playerStats.length === 0)
    ) {
      return res.json({
        data: [],
        status: "empty",
        message: `No game stats or prop markets found for gameId '${gameId}'`,
      });
    }

    const homeTeamStat = teamStats.find((t: any) => t.isHome) || teamStats[0] || null;
    const awayTeamStat = teamStats.find((t: any) => !t.isHome) || (teamStats.length > 1 ? teamStats[1] : null);

    const formattedMarkets = propMarkets.map((m: any) => ({
      id: m.id,
      marketType: m.marketType,
      line: m.line,
      status: m.status,
      player: m.player
        ? {
            id: m.player.id,
            fullName: m.player.fullName,
            team: m.player.team,
            position: m.player.position,
          }
        : null,
      odds: (m.odds || []).map((o: any) => ({
        id: o.id,
        bookmaker: o.bookmaker,
        selection: o.selection,
        price: o.price,
        fairPrice: o.fairPrice,
        edgePct: o.edgePct,
        trueProb: o.trueProb,
        capturedAt: o.capturedAt,
      })),
    }));

    const boxScore = playerStats.map((p: any) => ({
      playerId: p.playerId,
      fullName: p.player?.fullName || null,
      team: p.player?.team || null,
      position: p.player?.position || null,
      minutes: p.minutes,
      stats: p.statsJson,
    }));

    return res.json({
      data: {
        gameId,
        sport: teamStats[0]?.sport || propMarkets[0]?.sport || playerStats[0]?.sport || null,
        matchup: {
          homeTeam: homeTeamStat?.team || null,
          awayTeam: awayTeamStat?.team || null,
          gameDate: homeTeamStat?.gameDate || awayTeamStat?.gameDate || null,
          homeScore: homeTeamStat?.score ?? null,
          awayScore: awayTeamStat?.score ?? null,
        },
        teamStats: {
          home: homeTeamStat,
          away: awayTeamStat,
        },
        propMarkets: formattedMarkets,
        boxScore,
      },
      status: "ok",
    });
  } catch (error: any) {
    console.error("Error fetching game stats:", error);
    return res.status(500).json({ error: "Failed to fetch game stats" });
  }
});

// -------------------------------------------------------------
// 7. GET /api/stats/props
// -------------------------------------------------------------
router.get("/props", async (req: Request, res: Response) => {
  try {
    const { sport, minEdge, minHitRate, marketType } = req.query;

    const where: any = {
      status: "OPEN",
    };

    if (sport && typeof sport === "string") {
      where.sport = sport.toUpperCase();
    }

    if (marketType && typeof marketType === "string") {
      where.marketType = { contains: marketType, mode: "insensitive" };
    }

    const propMarkets = await prisma.propMarket.findMany({
      where,
      include: {
        player: {
          include: {
            gameStats: {
              orderBy: { gameDate: "desc" },
              take: 20,
            },
          },
        },
        odds: {
          orderBy: { capturedAt: "desc" },
        },
      },
      take: 100,
    });

    if (!propMarkets || propMarkets.length === 0) {
      return res.json({
        data: [],
        status: "empty",
        message: "No open props found matching the criteria",
      });
    }

    const normalizedMinEdge = minEdge !== undefined && !isNaN(Number(minEdge))
      ? (Number(minEdge) > 1 ? Number(minEdge) / 100 : Number(minEdge))
      : null;

    const normalizedMinHitRate = minHitRate !== undefined && !isNaN(Number(minHitRate))
      ? (Number(minHitRate) > 1 ? Number(minHitRate) : Number(minHitRate) * 100)
      : null;

    const formattedProps: any[] = [];

    for (const m of propMarkets) {
      let oddsList = m.odds || [];

      // Filter by minEdge if provided
      if (normalizedMinEdge !== null) {
        oddsList = oddsList.filter((o: any) => {
          if (o.edgePct === null || o.edgePct === undefined) return false;
          const edge = o.edgePct > 1 ? o.edgePct / 100 : o.edgePct;
          return edge >= normalizedMinEdge;
        });
        if (oddsList.length === 0) continue;
      }

      // Calculate hit rate if player gameStats and line are available
      let hitRateData = null;
      if (m.player && m.player.gameStats && m.line !== null) {
        const values: number[] = [];
        for (const g of m.player.gameStats) {
          const val = extractStatValue(g.statsJson, m.marketType);
          if (val !== null) values.push(val);
        }
        if (values.length > 0) {
          hitRateData = calculateHitRateStats(values, m.line);
        }
      }

      // Filter by minHitRate if provided
      if (normalizedMinHitRate !== null) {
        if (!hitRateData || hitRateData.hitRate < normalizedMinHitRate) {
          continue;
        }
      }

      // Find best odds by edgePct
      const bestOdds = oddsList.length > 0
        ? oddsList.reduce((best: any, curr: any) => {
            const currEdge = curr.edgePct ?? -999;
            const bestEdge = best?.edgePct ?? -999;
            return currEdge > bestEdge ? curr : best;
          }, oddsList[0])
        : null;

      formattedProps.push({
        id: m.id,
        sport: m.sport,
        gameId: m.gameId,
        marketType: m.marketType,
        line: m.line,
        status: m.status,
        player: m.player
          ? {
              id: m.player.id,
              fullName: m.player.fullName,
              team: m.player.team,
              position: m.player.position,
            }
          : null,
        hitRate: hitRateData,
        bestOdds: bestOdds
          ? {
              id: bestOdds.id,
              bookmaker: bestOdds.bookmaker,
              selection: bestOdds.selection,
              price: bestOdds.price,
              fairPrice: bestOdds.fairPrice,
              edgePct: bestOdds.edgePct,
              trueProb: bestOdds.trueProb,
            }
          : null,
        odds: oddsList.map((o: any) => ({
          id: o.id,
          bookmaker: o.bookmaker,
          selection: o.selection,
          price: o.price,
          fairPrice: o.fairPrice,
          edgePct: o.edgePct,
          trueProb: o.trueProb,
          capturedAt: o.capturedAt,
        })),
      });
    }

    if (formattedProps.length === 0) {
      return res.json({
        data: [],
        status: "empty",
        message: "No open props found matching the criteria",
      });
    }

    return res.json({
      data: formattedProps,
      count: formattedProps.length,
      status: "ok",
    });
  } catch (error: any) {
    console.error("Error fetching prop stats:", error);
    return res.status(500).json({ error: "Failed to fetch prop stats" });
  }
});

// -------------------------------------------------------------
// 8. POST /api/stats/query - Interactive Custom Stat Query Builder (Item 33)
// -------------------------------------------------------------
router.post("/query", async (req: Request, res: Response) => {
  try {
    const {
      sport,
      playerId,
      playerName,
      stat = "points",
      condition = "GT",
      value = 0,
      split = "ALL",
      teammateOutName,
    } = req.body;

    if (!playerId && !playerName) {
      return res.status(400).json({
        error: "Either 'playerId' or 'playerName' is required to execute query",
      });
    }

    const playerWhere: any = {};
    if (playerId) {
      playerWhere.OR = [{ id: String(playerId) }, { externalId: String(playerId) }];
    } else if (playerName) {
      playerWhere.fullName = { contains: String(playerName), mode: "insensitive" };
    }
    if (sport) {
      playerWhere.sport = String(sport).toUpperCase();
    }

    const player = await prisma.player.findFirst({
      where: playerWhere,
      include: {
        gameStats: {
          orderBy: { gameDate: "desc" },
          take: 82,
        },
      },
    });

    if (!player) {
      return res.json({
        status: "empty",
        message: `Player '${playerName || playerId}' was not found.`,
        query: { sport, playerName, stat, condition, value, split, teammateOutName },
        results: null,
      });
    }

    let candidateGames = player.gameStats || [];

    // Filter by Home / Away split if specified
    if (split === "HOME") {
      candidateGames = candidateGames.filter((g: any) => g.isHome);
    } else if (split === "AWAY") {
      candidateGames = candidateGames.filter((g: any) => !g.isHome);
    }

    // Filter by teammate out if specified
    let teammateFilterNote = null;
    if (teammateOutName) {
      const teammate = await prisma.player.findFirst({
        where: {
          fullName: { contains: String(teammateOutName), mode: "insensitive" },
          sport: player.sport,
        },
        include: {
          gameStats: true,
        },
      });

      if (teammate) {
        // Find games where teammate played active minutes (> 0)
        const teammateActiveGameIds = new Set(
          teammate.gameStats
            .filter((tg: any) => tg.minutes && Number(tg.minutes) > 0)
            .map((tg: any) => tg.gameId)
        );
        // Only keep games where teammate was OUT (did not play or had 0 minutes)
        candidateGames = candidateGames.filter((g: any) => !teammateActiveGameIds.has(g.gameId));
        teammateFilterNote = `Filtered to games where ${teammate.fullName} was inactive/OUT`;
      }
    }

    const targetVal = Number(value);
    const evaluatedGames: any[] = [];
    let hits = 0;
    let statSum = 0;

    for (const g of candidateGames) {
      const extractedVal = extractStatValue(g.statsJson, stat);
      if (extractedVal !== null) {
        statSum += extractedVal;
        let isHit = false;

        switch (condition.toUpperCase()) {
          case "GT":
            isHit = extractedVal > targetVal;
            break;
          case "GTE":
            isHit = extractedVal >= targetVal;
            break;
          case "LT":
            isHit = extractedVal < targetVal;
            break;
          case "LTE":
            isHit = extractedVal <= targetVal;
            break;
          case "EQ":
            isHit = extractedVal === targetVal;
            break;
          default:
            isHit = extractedVal > targetVal;
        }

        if (isHit) hits++;

        evaluatedGames.push({
          gameId: g.gameId,
          gameDate: g.gameDate,
          opponent: g.opponent,
          isHome: g.isHome,
          minutes: g.minutes,
          statValue: extractedVal,
          isHit,
        });
      }
    }

    const totalEvaluated = evaluatedGames.length;
    if (totalEvaluated === 0) {
      return res.json({
        status: "empty",
        message: `No matching game logs with stat '${stat}' found for ${player.fullName}.`,
        query: { sport: player.sport, playerName: player.fullName, stat, condition, value: targetVal, split, teammateOutName },
        results: null,
      });
    }

    const hitRatePct = Number(((hits / totalEvaluated) * 100).toFixed(1));
    const averageValue = Number((statSum / totalEvaluated).toFixed(1));

    return res.json({
      status: "ok",
      player: {
        id: player.id,
        fullName: player.fullName,
        team: player.team,
        sport: player.sport,
        position: player.position,
      },
      query: {
        sport: player.sport,
        playerName: player.fullName,
        stat,
        condition,
        value: targetVal,
        split,
        teammateOutName: teammateOutName || null,
        note: teammateFilterNote,
      },
      summary: {
        totalGames: totalEvaluated,
        hits,
        misses: totalEvaluated - hits,
        hitRatePct,
        averageValue,
      },
      games: evaluatedGames,
    });
  } catch (error: any) {
    console.error("Error executing custom stat query:", error);
    return res.status(500).json({ error: "Failed to execute custom stat query" });
  }
});

export default router;

