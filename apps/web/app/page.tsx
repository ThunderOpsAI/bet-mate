"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BobExplanation,
  FeatureImpactItem,
  ModelMetadata,
} from "./lib/bob/explainer";
import {
  Trophy,
  Zap,
  CircleDot,
  ChevronRight,
  Activity,
  Brain,
} from "lucide-react";
import Link from "next/link";
import ExplainDrawer from "./components/ExplainDrawer";
import RefreshControls from "./components/RefreshControls";
import PaperBetAction from "./components/PaperBetAction";
import { buildBobExplanation } from "./lib/bob/explainer";
import { ML_API } from "./lib/mlApi";
import {
  getMlCacheDateKey,
  getMlDataCacheKey,
  getMlDataCacheMetadata,
  isMlDataCacheStale,
  readMlDataCache,
  refreshMlDataCache,
  scheduleMlDataCacheRetry,
} from "./lib/cache/mlDataCache";

type RaceSummary = {
  race_id: string;
  venue: string;
  race_number: number;
  distance: number;
  meeting_type?: "metro" | "provincial" | "country" | "unknown";
  meeting_region?: string;
  meeting_date?: string;
  horses: Array<{
    horse_id: string;
    name: string;
    betfair_back_price?: number;
  }>;
};

type RacePrediction = {
  race_id: string;
  predictions: Array<{
    horse_id: string;
    name: string;
    win_probability: number;
    fair_odds: number;
  }>;
  feature_impact?: FeatureImpactItem[] | Record<string, number>;
  ai_insights_context?:
    | {
        data_quality?: "strong" | "moderate" | "thin";
        calibration_confidence?: number;
        market_agreement?: boolean;
        notes?: string[];
      }
    | string;
  model_metadata?: ModelMetadata;
};

type AFLGame = {
  game_id: string;
  home_team: string;
  away_team: string;
  features: Record<string, number>;
};

type AFLPrediction = {
  game_id: string;
  predictions: {
    home_team: string;
    away_team: string;
    home_win_probability: number;
    away_win_probability: number;
    fair_odds_home: number;
    fair_odds_away: number;
  };
  feature_impact?: FeatureImpactItem[] | Record<string, number>;
  ai_insights_context?:
    | {
        data_quality?: "strong" | "moderate" | "thin";
        calibration_confidence?: number;
        market_agreement?: boolean;
        notes?: string[];
      }
    | string;
  model_metadata?: ModelMetadata;
};

type NBAGame = {
  game_id: string;
  home_team: string;
  away_team: string;
  features: Record<string, number>;
};

type NBAPrediction = {
  game_id: string;
  predictions: {
    home_team: string;
    away_team: string;
    home_win_probability: number;
    away_win_probability: number;
    fair_odds_home: number;
    fair_odds_away: number;
  };
  feature_impact?: FeatureImpactItem[] | Record<string, number>;
  ai_insights_context?:
    | {
        data_quality?: "strong" | "moderate" | "thin";
        calibration_confidence?: number;
        market_agreement?: boolean;
        notes?: string[];
      }
    | string;
  model_metadata?: ModelMetadata;
};

type RacePredictionEntry = readonly [string, RacePrediction];
type AFLPredictionEntry = readonly [string, AFLPrediction];
type NBAPredictionEntry = readonly [string, NBAPrediction];

function getDashboardCacheKeys() {
  const dateKey = getMlCacheDateKey();

  return {
    racingFixturesKey: getMlDataCacheKey("fixtures", "racing", dateKey),
    racingPredictionsKey: getMlDataCacheKey("predictions", "racing", dateKey),
    aflFixturesKey: getMlDataCacheKey("fixtures", "afl", dateKey),
    aflPredictionsKey: getMlDataCacheKey("predictions", "afl", dateKey),
    nbaFixturesKey: getMlDataCacheKey("fixtures", "nba", dateKey),
    nbaPredictionsKey: getMlDataCacheKey("predictions", "nba", dateKey),
  };
}

function isRacePredictionEntry(
  entry: RacePredictionEntry | null,
): entry is RacePredictionEntry {
  return entry !== null;
}

function isAflPredictionEntry(
  entry: AFLPredictionEntry | null,
): entry is AFLPredictionEntry {
  return entry !== null;
}

function isNbaPredictionEntry(
  entry: NBAPredictionEntry | null,
): entry is NBAPredictionEntry {
  return entry !== null;
}

async function fetchEngineStatus() {
  try {
    const response = await fetch(`${ML_API}/health`, { cache: "no-store" });
    return response.ok ? "online" : "offline";
  } catch {
    return "offline" as const;
  }
}

async function fetchTodayRaces() {
  const response = await fetch(`${ML_API}/api/races/today`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Racing fixtures request failed with ${response.status}`);
  }

  const data = await response.json();
  return (data?.races ?? []) as RaceSummary[];
}

async function fetchUpcomingAflGames() {
  const response = await fetch(`${ML_API}/api/afl/games/upcoming`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`AFL fixtures request failed with ${response.status}`);
  }

  const data = await response.json();
  return (data?.games ?? []) as AFLGame[];
}

async function fetchTodayNbaGames() {
  const response = await fetch(`${ML_API}/api/nba/games/today`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`NBA fixtures request failed with ${response.status}`);
  }

  const data = await response.json();
  return (data?.games ?? []) as NBAGame[];
}

async function fetchRacePredictions(races: RaceSummary[]) {
  const entries = await Promise.all(
    races.map(async (race) => {
      try {
        const response = await fetch(`${ML_API}/api/predict/racing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(race),
        });

        if (!response.ok) {
          return null;
        }

        return [race.race_id, await response.json()] as const;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(entries.filter(isRacePredictionEntry)) as Record<
    string,
    RacePrediction
  >;
}

async function fetchAflPredictions(games: AFLGame[]) {
  const entries = await Promise.all(
    games.map(async (game) => {
      try {
        const response = await fetch(`${ML_API}/api/predict/afl`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(game),
        });

        if (!response.ok) {
          return null;
        }

        return [game.game_id, await response.json()] as const;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(entries.filter(isAflPredictionEntry)) as Record<
    string,
    AFLPrediction
  >;
}

async function fetchNbaPredictions(games: NBAGame[]) {
  const entries = await Promise.all(
    games.map(async (game) => {
      try {
        const response = await fetch(`${ML_API}/api/predict/nba`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(game),
        });

        if (!response.ok) {
          return null;
        }

        return [game.game_id, await response.json()] as const;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(entries.filter(isNbaPredictionEntry)) as Record<
    string,
    NBAPrediction
  >;
}

export default function DashboardPage() {
  const router = useRouter();
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [aflGames, setAFLGames] = useState<AFLGame[]>([]);
  const [nbaGames, setNBAGames] = useState<NBAGame[]>([]);
  const [racePredictions, setRacePredictions] = useState<
    Record<string, RacePrediction>
  >({});
  const [aflPredictions, setAFLPredictions] = useState<
    Record<string, AFLPrediction>
  >({});
  const [nbaPredictions, setNBAPredictions] = useState<
    Record<string, NBAPrediction>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [engineStatus, setEngineStatus] = useState<"online" | "offline">(
    "offline",
  );
  const [activeExplanation, setActiveExplanation] = useState<BobExplanation | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const refreshingRef = useRef(false);

  const syncCacheMetadata = () => {
    const keys = getDashboardCacheKeys();
    const metadata = getMlDataCacheMetadata(Object.values(keys));

    if (!isMountedRef.current) {
      return;
    }

    setLastUpdated(metadata.lastUpdated);
    setNextRefreshAt(metadata.nextRefreshAt);
  };

  const hydrateFromCache = () => {
    const keys = getDashboardCacheKeys();
    const cachedRaces = readMlDataCache<RaceSummary[]>(keys.racingFixturesKey);
    const cachedRacePredictions = readMlDataCache<Record<string, RacePrediction>>(
      keys.racingPredictionsKey,
    );
    const cachedAflGames = readMlDataCache<AFLGame[]>(keys.aflFixturesKey);
    const cachedAflPredictions = readMlDataCache<Record<string, AFLPrediction>>(
      keys.aflPredictionsKey,
    );
    const cachedNbaGames = readMlDataCache<NBAGame[]>(keys.nbaFixturesKey);
    const cachedNbaPredictions = readMlDataCache<Record<string, NBAPrediction>>(
      keys.nbaPredictionsKey,
    );

    if (cachedRaces && isMountedRef.current) {
      setRaces(cachedRaces.data);
    }

    if (cachedRacePredictions && isMountedRef.current) {
      setRacePredictions(cachedRacePredictions.data);
    }

    if (cachedAflGames && isMountedRef.current) {
      setAFLGames(cachedAflGames.data);
    }

    if (cachedAflPredictions && isMountedRef.current) {
      setAFLPredictions(cachedAflPredictions.data);
    }

    if (cachedNbaGames && isMountedRef.current) {
      setNBAGames(cachedNbaGames.data);
    }

    if (cachedNbaPredictions && isMountedRef.current) {
      setNBAPredictions(cachedNbaPredictions.data);
    }

    syncCacheMetadata();

    return {
      cachedRaces,
      cachedRacePredictions,
      cachedAflGames,
      cachedAflPredictions,
      cachedNbaGames,
      cachedNbaPredictions,
    };
  };

  const refreshEngineHealth = async () => {
    const status = await fetchEngineStatus();

    if (isMountedRef.current) {
      setEngineStatus(status);
    }
  };

  const refreshDashboard = async () => {
    if (refreshingRef.current) {
      return;
    }

    refreshingRef.current = true;
    if (isMountedRef.current) {
      setRefreshing(true);
    }

    const keys = getDashboardCacheKeys();
    const healthPromise = refreshEngineHealth();

    const [racingFixturesEntry, aflFixturesEntry, nbaFixturesEntry] =
      await Promise.all([
        refreshMlDataCache(keys.racingFixturesKey, fetchTodayRaces, {
          force: true,
        }).catch((error) => {
          console.error("Failed to refresh racing fixtures:", error);
          scheduleMlDataCacheRetry(keys.racingFixturesKey);
          return readMlDataCache<RaceSummary[]>(keys.racingFixturesKey);
        }),
        refreshMlDataCache(keys.aflFixturesKey, fetchUpcomingAflGames, {
          force: true,
        }).catch((error) => {
          console.error("Failed to refresh AFL fixtures:", error);
          scheduleMlDataCacheRetry(keys.aflFixturesKey);
          return readMlDataCache<AFLGame[]>(keys.aflFixturesKey);
        }),
        refreshMlDataCache(keys.nbaFixturesKey, fetchTodayNbaGames, {
          force: true,
        }).catch((error) => {
          console.error("Failed to refresh NBA fixtures:", error);
          scheduleMlDataCacheRetry(keys.nbaFixturesKey);
          return readMlDataCache<NBAGame[]>(keys.nbaFixturesKey);
        }),
      ]);

    if (racingFixturesEntry && isMountedRef.current) {
      setRaces(racingFixturesEntry.data);
    }

    if (aflFixturesEntry && isMountedRef.current) {
      setAFLGames(aflFixturesEntry.data);
    }

    if (nbaFixturesEntry && isMountedRef.current) {
      setNBAGames(nbaFixturesEntry.data);
    }

    if (isMountedRef.current) {
      setLoading(false);
    }

    const racePredictionsPromise = racingFixturesEntry
      ? refreshMlDataCache(
          keys.racingPredictionsKey,
          () => fetchRacePredictions(racingFixturesEntry.data),
          { force: true },
        ).catch((error) => {
          console.error("Failed to refresh racing predictions:", error);
          scheduleMlDataCacheRetry(keys.racingPredictionsKey);
          return readMlDataCache<Record<string, RacePrediction>>(
            keys.racingPredictionsKey,
          );
        })
      : Promise.resolve(
          readMlDataCache<Record<string, RacePrediction>>(
            keys.racingPredictionsKey,
          ),
        );

    const aflPredictionsPromise = aflFixturesEntry
      ? refreshMlDataCache(
          keys.aflPredictionsKey,
          () => fetchAflPredictions(aflFixturesEntry.data),
          { force: true },
        ).catch((error) => {
          console.error("Failed to refresh AFL predictions:", error);
          scheduleMlDataCacheRetry(keys.aflPredictionsKey);
          return readMlDataCache<Record<string, AFLPrediction>>(
            keys.aflPredictionsKey,
          );
        })
      : Promise.resolve(
          readMlDataCache<Record<string, AFLPrediction>>(keys.aflPredictionsKey),
        );

    const nbaPredictionsPromise = nbaFixturesEntry
      ? refreshMlDataCache(
          keys.nbaPredictionsKey,
          () => fetchNbaPredictions(nbaFixturesEntry.data),
          { force: true },
        ).catch((error) => {
          console.error("Failed to refresh NBA predictions:", error);
          scheduleMlDataCacheRetry(keys.nbaPredictionsKey);
          return readMlDataCache<Record<string, NBAPrediction>>(
            keys.nbaPredictionsKey,
          );
        })
      : Promise.resolve(
          readMlDataCache<Record<string, NBAPrediction>>(keys.nbaPredictionsKey),
        );

    const [racePredictionsEntry, aflPredictionsEntry, nbaPredictionsEntry] =
      await Promise.all([
        racePredictionsPromise,
        aflPredictionsPromise,
        nbaPredictionsPromise,
      ]);

    if (racePredictionsEntry && isMountedRef.current) {
      setRacePredictions(racePredictionsEntry.data);
    }

    if (aflPredictionsEntry && isMountedRef.current) {
      setAFLPredictions(aflPredictionsEntry.data);
    }

    if (nbaPredictionsEntry && isMountedRef.current) {
      setNBAPredictions(nbaPredictionsEntry.data);
    }

    await healthPromise;
    syncCacheMetadata();
    refreshingRef.current = false;

    if (isMountedRef.current) {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = hydrateFromCache();
    const hasFixtureCache =
      !!cached.cachedRaces || !!cached.cachedAflGames || !!cached.cachedNbaGames;

    if (hasFixtureCache) {
      setLoading(false);
    }

    const shouldRefresh =
      !cached.cachedRaces ||
      !cached.cachedRacePredictions ||
      !cached.cachedAflGames ||
      !cached.cachedAflPredictions ||
      !cached.cachedNbaGames ||
      !cached.cachedNbaPredictions ||
      isMlDataCacheStale(cached.cachedRaces) ||
      isMlDataCacheStale(cached.cachedRacePredictions) ||
      isMlDataCacheStale(cached.cachedAflGames) ||
      isMlDataCacheStale(cached.cachedAflPredictions) ||
      isMlDataCacheStale(cached.cachedNbaGames) ||
      isMlDataCacheStale(cached.cachedNbaPredictions);

    if (shouldRefresh) {
      void refreshDashboard();
    } else {
      void refreshEngineHealth();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <Brain size={48} />
          <p>Loading today's ML snapshots...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ExplainDrawer
        open={activeExplanation !== null}
        explanation={activeExplanation}
        onClose={() => setActiveExplanation(null)}
      />
      <div className={`engine-banner ${engineStatus}`}>
        <Activity size={16} />
        <span>
          ML Prediction Engine:{" "}
          <strong>{engineStatus === "online" ? "Online" : "Offline"}</strong>
        </span>
        {engineStatus === "online" ? (
          <span className="engine-models">3 prediction models active</span>
        ) : null}
      </div>

      <RefreshControls
        lastUpdated={lastUpdated}
        nextRefreshAt={nextRefreshAt}
        isRefreshing={refreshing}
        onRefresh={refreshDashboard}
      />

      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="stat-label">
            <Trophy
              size={14}
              style={{ display: "inline", verticalAlign: "middle" }}
            />{" "}
            Races Today
          </div>
          <div className="stat-value">{races.length}</div>
          <div className="stat-sub">{new Set(races.map((race) => race.venue)).size} venues</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">
            <CircleDot
              size={14}
              style={{ display: "inline", verticalAlign: "middle" }}
            />{" "}
            AFL Games
          </div>
          <div className="stat-value">{aflGames.length}</div>
          <div className="stat-sub">This round</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">
            <Zap
              size={14}
              style={{ display: "inline", verticalAlign: "middle" }}
            />{" "}
            NBA Games
          </div>
          <div className="stat-value">{nbaGames.length}</div>
          <div className="stat-sub">Tonight</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">
            <Brain
              size={14}
              style={{ display: "inline", verticalAlign: "middle" }}
            />{" "}
            ML Models
          </div>
          <div className="stat-value">3</div>
          <div className="stat-sub">Shared cached snapshots</div>
        </div>
      </div>

      <div className="section-header">
        <h3>🏇 Top Racing Predictions</h3>
        <Link href="/racing" className="btn btn-sm btn-secondary">
          View All <ChevronRight size={14} />
        </Link>
      </div>
      <div className="predictions-grid">
        {races.slice(0, 3).map((race) => {
          const prediction = racePredictions[race.race_id];
          const top3 = prediction?.predictions?.slice(0, 3) ?? [];

          return (
            <div
              key={race.race_id}
              className="prediction-card"
              onClick={() => router.push("/racing")}
            >
              <div className="prediction-card-header">
                <div>
                  <span className="prediction-venue">{race.venue}</span>
                  <span className="prediction-race">Race {race.race_number}</span>
                  {race.meeting_region || race.meeting_type ? (
                    <div className="context-chip" style={{ marginTop: "0.4rem" }}>
                      {[race.meeting_region, race.meeting_type]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  ) : null}
                </div>
                <span className="badge badge-accent">{race.distance}m</span>
              </div>
              <div className="prediction-picks">
                {top3.map((pick, index) => (
                  <div key={pick.horse_id} className="prediction-pick-row">
                    <div className="prediction-pick-left">
                      <span className={`pick-rank rank-${index + 1}`}>
                        {index + 1}
                      </span>
                      <span className="prediction-horse-name">{pick.name}</span>
                    </div>
                    <div className="prediction-pick-right">
                      <span className="prediction-prob">
                        {pick.win_probability}%
                      </span>
                      <span className="prediction-odds">${pick.fair_odds}</span>
                      <button
                        type="button"
                        className="why-pick-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveExplanation(
                            buildBobExplanation({
                              sport: "racing",
                              selectionName: pick.name,
                              probability: pick.win_probability,
                              fairOdds: pick.fair_odds,
                              featureImpact: prediction?.feature_impact,
                              aiInsightsContext: prediction?.ai_insights_context,
                              modelMetadata: prediction?.model_metadata,
                            }),
                          );
                        }}
                      >
                        Why this pick?
                      </button>
                      <Link
                        className="btn btn-sm btn-secondary"
                        href={paperBetHref({
                          sport: "racing",
                          eventId: race.race_id,
                          eventName: `${race.venue} R${race.race_number}`,
                          selection: pick.name,
                          odds: pick.fair_odds,
                          betType: "win",
                        })}
                        onClick={(event) => event.stopPropagation()}
                      >
                        Paper
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-header" style={{ marginTop: "2rem" }}>
        <h3>🏈 AFL Predictions</h3>
        <Link href="/afl" className="btn btn-sm btn-secondary">
          View All <ChevronRight size={14} />
        </Link>
      </div>
      <div className="predictions-grid">
        {aflGames.slice(0, 3).map((game) => {
          const prediction = aflPredictions[game.game_id];
          const homePct = prediction?.predictions?.home_win_probability ?? 50;
          const awayPct = prediction?.predictions?.away_win_probability ?? 50;
          const homeWins = homePct > awayPct;

          return (
            <div
              key={game.game_id}
              className="prediction-card game-card-variant"
              onClick={() => router.push("/afl")}
            >
              <div className="game-matchup">
                <div className={`game-team ${homeWins ? "favoured" : ""}`}>
                  <span className="team-name">{game.home_team}</span>
                  <span className="team-prob">{homePct}%</span>
                  {prediction ? (
                    <div
                      onClick={(event) => event.stopPropagation()}
                      style={{ marginTop: "0.75rem" }}
                    >
                      <PaperBetAction
                        bet={{
                          sport: "afl",
                          event_id: game.game_id,
                          event_name: `${game.home_team} vs ${game.away_team}`,
                          selection: game.home_team,
                          odds: prediction.predictions.fair_odds_home,
                          bet_type: "head_to_head",
                          stake: 10,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="game-vs">VS</div>
                <div className={`game-team ${!homeWins ? "favoured" : ""}`}>
                  <span className="team-name">{game.away_team}</span>
                  <span className="team-prob">{awayPct}%</span>
                  {prediction ? (
                    <div
                      onClick={(event) => event.stopPropagation()}
                      style={{ marginTop: "0.75rem" }}
                    >
                      <PaperBetAction
                        bet={{
                          sport: "afl",
                          event_id: game.game_id,
                          event_name: `${game.home_team} vs ${game.away_team}`,
                          selection: game.away_team,
                          odds: prediction.predictions.fair_odds_away,
                          bet_type: "head_to_head",
                          stake: 10,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="game-prob-bar">
                <div className="prob-fill home" style={{ width: `${homePct}%` }} />
                <div className="prob-fill away" style={{ width: `${awayPct}%` }} />
              </div>
              {prediction ? (
                <div className="dashboard-card-actions">
                  <button
                    type="button"
                    className="why-pick-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveExplanation(
                        buildBobExplanation({
                          sport: "afl",
                          selectionName: homeWins ? game.home_team : game.away_team,
                          opponentName: homeWins ? game.away_team : game.home_team,
                          probability: homeWins ? homePct : awayPct,
                          fairOdds: homeWins
                            ? prediction.predictions.fair_odds_home
                            : prediction.predictions.fair_odds_away,
                          featureImpact: prediction.feature_impact,
                          aiInsightsContext: prediction.ai_insights_context,
                          modelMetadata: prediction.model_metadata,
                        }),
                      );
                    }}
                  >
                    <Brain size={14} /> Why {homeWins ? game.home_team : game.away_team}?
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="section-header" style={{ marginTop: "2rem" }}>
        <h3>🏀 NBA Predictions</h3>
        <Link href="/nba" className="btn btn-sm btn-secondary">
          View All <ChevronRight size={14} />
        </Link>
      </div>
      <div className="predictions-grid">
        {nbaGames.slice(0, 3).map((game) => {
          const prediction = nbaPredictions[game.game_id];
          const homePct = prediction?.predictions?.home_win_probability ?? 50;
          const awayPct = prediction?.predictions?.away_win_probability ?? 50;
          const homeWins = homePct > awayPct;

          return (
            <div
              key={game.game_id}
              className="prediction-card game-card-variant"
              onClick={() => router.push("/nba")}
            >
              <div className="game-matchup">
                <div className={`game-team ${homeWins ? "favoured" : ""}`}>
                  <span className="team-name">{game.home_team}</span>
                  <span className="team-prob">{homePct}%</span>
                  {prediction ? (
                    <div
                      onClick={(event) => event.stopPropagation()}
                      style={{ marginTop: "0.75rem" }}
                    >
                      <PaperBetAction
                        bet={{
                          sport: "nba",
                          event_id: game.game_id,
                          event_name: `${game.home_team} vs ${game.away_team}`,
                          selection: game.home_team,
                          odds: prediction.predictions.fair_odds_home,
                          bet_type: "head_to_head",
                          stake: 10,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="game-vs">VS</div>
                <div className={`game-team ${!homeWins ? "favoured" : ""}`}>
                  <span className="team-name">{game.away_team}</span>
                  <span className="team-prob">{awayPct}%</span>
                  {prediction ? (
                    <div
                      onClick={(event) => event.stopPropagation()}
                      style={{ marginTop: "0.75rem" }}
                    >
                      <PaperBetAction
                        bet={{
                          sport: "nba",
                          event_id: game.game_id,
                          event_name: `${game.home_team} vs ${game.away_team}`,
                          selection: game.away_team,
                          odds: prediction.predictions.fair_odds_away,
                          bet_type: "head_to_head",
                          stake: 10,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="game-prob-bar">
                <div className="prob-fill home" style={{ width: `${homePct}%` }} />
                <div className="prob-fill away" style={{ width: `${awayPct}%` }} />
              </div>
              {prediction ? (
                <div className="dashboard-card-actions">
                  <button
                    type="button"
                    className="why-pick-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveExplanation(
                        buildBobExplanation({
                          sport: "nba",
                          selectionName: homeWins ? game.home_team : game.away_team,
                          opponentName: homeWins ? game.away_team : game.home_team,
                          probability: homeWins ? homePct : awayPct,
                          fairOdds: homeWins
                            ? prediction.predictions.fair_odds_home
                            : prediction.predictions.fair_odds_away,
                          featureImpact: prediction.feature_impact,
                          aiInsightsContext: prediction.ai_insights_context,
                          modelMetadata: prediction.model_metadata,
                        }),
                      );
                    }}
                  >
                    <Brain size={14} /> Why {homeWins ? game.home_team : game.away_team}?
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="disclaimer">
        ⚠️ <strong>Disclaimer:</strong> This app is for information and tracking
        purposes only. We do not facilitate betting or handle payments.
        Predictions are generated by machine learning models and are not
        guarantees. Past performance does not indicate future results. Please
        gamble responsibly. If you need help, visit{" "}
        <a
          href="https://www.gamblinghelponline.org.au/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--yellow)", textDecoration: "underline" }}
        >
          Gambling Help Online
        </a>
        .
      </div>
    </div>
  );
}

function paperBetHref(params: {
  sport: string;
  eventId: string;
  eventName: string;
  selection: string;
  odds: number;
  betType: string;
}): string {
  const search = new URLSearchParams({
    sport: params.sport,
    event_id: params.eventId,
    event_name: params.eventName,
    selection: params.selection,
    odds: String(params.odds),
    bet_type: params.betType,
  });

  return `/bets/new?${search.toString()}`;
}
