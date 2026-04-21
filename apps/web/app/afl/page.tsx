"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BobExplanation,
  FeatureImpactItem,
  ModelMetadata,
} from "../lib/bob/explainer";
import { Brain, CircleDot, BarChart3 } from "lucide-react";
import ExplainDrawer from "../components/ExplainDrawer";
import RefreshControls from "../components/RefreshControls";
import { buildBobExplanation } from "../lib/bob/explainer";
import { ML_API } from "../lib/mlApi";
import {
  getMlCacheDateKey,
  getMlDataCacheKey,
  getMlDataCacheMetadata,
  isMlDataCacheStale,
  readMlDataCache,
  refreshMlDataCache,
  scheduleMlDataCacheRetry,
} from "../lib/cache/mlDataCache";
import PaperBetAction from "../components/PaperBetAction";

type AFLGame = {
  game_id: string;
  home_team: string;
  away_team: string;
  features: Record<string, number>;
  round?: number;
  venue?: string;
  date?: string;
  complete?: number;
  hscore?: number | null;
  ascore?: number | null;
  squiggle_tip?: string;
  squiggle_confidence?: number | string | null;
};

type AFLScoreUpdate = {
  id?: string | number;
  game_id?: string | number;
  gameid?: string | number;
  hscore?: number | string | null;
  ascore?: number | string | null;
  complete?: number | string | null;
  status?: string;
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

type AFLPredictionEntry = readonly [string, AFLPrediction];

const weatherMap: Record<number, string> = {
  1: "☀️ Clear",
  2: "⛅ Cloudy",
  3: "🌧️ Rain",
};

function getAflCacheKeys() {
  const dateKey = getMlCacheDateKey();

  return {
    fixturesKey: getMlDataCacheKey("fixtures", "afl", dateKey),
    predictionsKey: getMlDataCacheKey("predictions", "afl", dateKey),
  };
}

function isAflPredictionEntry(
  entry: AFLPredictionEntry | null,
): entry is AFLPredictionEntry {
  return entry !== null;
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

export default function AFLPage() {
  const [games, setGames] = useState<AFLGame[]>([]);
  const [predictions, setPredictions] = useState<Record<string, AFLPrediction>>(
    {},
  );
  const [liveScores, setLiveScores] = useState<Record<string, AFLScoreUpdate>>({});
  const [liveStatus, setLiveStatus] = useState<
    "connecting" | "connected" | "reconnecting"
  >("connecting");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [activeExplanation, setActiveExplanation] = useState<BobExplanation | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const refreshingRef = useRef(false);

  const syncCacheMetadata = () => {
    const { fixturesKey, predictionsKey } = getAflCacheKeys();
    const metadata = getMlDataCacheMetadata([fixturesKey, predictionsKey]);

    if (!isMountedRef.current) {
      return;
    }

    setLastUpdated(metadata.lastUpdated);
    setNextRefreshAt(metadata.nextRefreshAt);
  };

  const hydrateFromCache = () => {
    const { fixturesKey, predictionsKey } = getAflCacheKeys();
    const cachedGames = readMlDataCache<AFLGame[]>(fixturesKey);
    const cachedPredictions = readMlDataCache<Record<string, AFLPrediction>>(
      predictionsKey,
    );

    if (cachedGames && isMountedRef.current) {
      setGames(cachedGames.data);
    }

    if (cachedPredictions && isMountedRef.current) {
      setPredictions(cachedPredictions.data);
    }

    syncCacheMetadata();

    return {
      cachedGames,
      cachedPredictions,
    };
  };

  const refreshPage = async () => {
    if (refreshingRef.current) {
      return;
    }

    refreshingRef.current = true;
    if (isMountedRef.current) {
      setRefreshing(true);
    }

    const { fixturesKey, predictionsKey } = getAflCacheKeys();

    const fixturesEntry = await refreshMlDataCache(
      fixturesKey,
      fetchUpcomingAflGames,
      { force: true },
    ).catch((error) => {
      console.error("Failed to refresh AFL fixtures:", error);
      scheduleMlDataCacheRetry(fixturesKey);
      return readMlDataCache<AFLGame[]>(fixturesKey);
    });

    if (fixturesEntry && isMountedRef.current) {
      setGames(fixturesEntry.data);
      setLoading(false);
    }

    if (fixturesEntry) {
      const predictionsEntry = await refreshMlDataCache(
        predictionsKey,
        () => fetchAflPredictions(fixturesEntry.data),
        { force: true },
      ).catch((error) => {
        console.error("Failed to refresh AFL predictions:", error);
        scheduleMlDataCacheRetry(predictionsKey);
        return readMlDataCache<Record<string, AFLPrediction>>(predictionsKey);
      });

      if (predictionsEntry && isMountedRef.current) {
        setPredictions(predictionsEntry.data);
      }
    }

    syncCacheMetadata();
    refreshingRef.current = false;

    if (isMountedRef.current) {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    const { cachedGames, cachedPredictions } = hydrateFromCache();

    if (cachedGames) {
      setLoading(false);
    }

    const shouldRefresh =
      !cachedGames ||
      !cachedPredictions ||
      isMlDataCacheStale(cachedGames) ||
      isMlDataCacheStale(cachedPredictions);

    if (shouldRefresh) {
      void refreshPage();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const eventSource = new EventSource(`${ML_API}/api/afl/games/live`);

    const handleGamesEvent = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data);
        const updates = Array.isArray(parsed) ? parsed : [parsed];
        const nextScores: Record<string, AFLScoreUpdate> = {};

        for (const update of updates) {
          const key = getLiveScoreKey(update);
          if (key) {
            nextScores[key] = update;
          }
        }

        if (Object.keys(nextScores).length > 0) {
          setLiveScores((current) => ({ ...current, ...nextScores }));
        }
        setLiveStatus("connected");
      } catch {
        // Ignore welcome pings that are not score payloads.
      }
    };

    eventSource.addEventListener("games", handleGamesEvent);
    eventSource.onopen = () => setLiveStatus("connected");
    eventSource.onerror = () => setLiveStatus("reconnecting");

    return () => {
      eventSource.removeEventListener("games", handleGamesEvent);
      eventSource.close();
    };
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <CircleDot size={48} />
          <p>Loading AFL snapshot...</p>
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
      <RefreshControls
        lastUpdated={lastUpdated}
        nextRefreshAt={nextRefreshAt}
        isRefreshing={refreshing}
        onRefresh={refreshPage}
      />

      <div className="game-cards-list">
        {games.map((game) => {
          const prediction = predictions[game.game_id];
          const liveScore = liveScores[game.game_id];
          const homeScore = toScore(liveScore?.hscore ?? game.hscore);
          const awayScore = toScore(liveScore?.ascore ?? game.ascore);
          const gameComplete = toScore(liveScore?.complete ?? game.complete) ?? 0;
          const scoreLabel = formatScoreLabel(homeScore, awayScore, gameComplete);
          const homePct = prediction?.predictions?.home_win_probability ?? 50;
          const awayPct = prediction?.predictions?.away_win_probability ?? 50;
          const homeWins = homePct > awayPct;
          const isExpanded = expandedGame === game.game_id;

          return (
            <div
              key={game.game_id}
              className={`game-prediction-card ${isExpanded ? "expanded" : ""}`}
              onClick={() => setExpandedGame(isExpanded ? null : game.game_id)}
            >
              <div className="game-matchup-header">
                <div className={`team-block ${homeWins ? "favoured" : ""}`}>
                  <span className="team-label">HOME</span>
                  <span className="team-name-lg">{game.home_team}</span>
                  <span className="team-prob-lg">{homePct.toFixed(1)}%</span>
                  {prediction ? (
                    <span className="team-odds">
                      Fair: ${prediction.predictions.fair_odds_home}
                    </span>
                  ) : null}
                </div>

                <div className="vs-divider">
                  <span>VS</span>
                </div>

                <div className={`team-block ${!homeWins ? "favoured" : ""}`}>
                  <span className="team-label">AWAY</span>
                  <span className="team-name-lg">{game.away_team}</span>
                  <span className="team-prob-lg">{awayPct.toFixed(1)}%</span>
                  {prediction ? (
                    <span className="team-odds">
                      Fair: ${prediction.predictions.fair_odds_away}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="game-prob-bar large">
                <div className="prob-fill home" style={{ width: `${homePct}%` }} />
                <div className="prob-fill away" style={{ width: `${awayPct}%` }} />
              </div>

              <div className="game-context-row">
                <span className="context-chip">
                  Live scores: {formatLiveStatus(liveStatus)}
                </span>
                {scoreLabel ? <span className="context-chip">{scoreLabel}</span> : null}
                <span className="context-chip">
                  {weatherMap[game.features.weather_condition] ?? "☀️ Clear"}
                </span>
                <span className="context-chip">
                  🏠 {game.features.home_rest_days}d rest
                </span>
                <span className="context-chip">
                  ✈️ {game.features.travel_distance_away}km travel
                </span>
                <span className="context-chip">
                  🔥 H:W{game.features.home_win_streak} / A:W
                  {game.features.away_win_streak}
                </span>
                {game.squiggle_tip ? (
                  <span className="context-chip">
                    Squiggle: {game.squiggle_tip}{" "}
                    {formatSquiggleConfidence(game.squiggle_confidence)}
                  </span>
                ) : null}
                {prediction ? (
                  <>
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
                    <div onClick={(event) => event.stopPropagation()}>
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
                    <div onClick={(event) => event.stopPropagation()}>
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
                  </>
                ) : null}
              </div>

              {isExpanded && prediction ? (
                <div className="game-expanded-section">
                  <div className="feature-impact-section">
                    <h4>
                      <BarChart3 size={16} /> Bob explainability
                    </h4>
                    <p className="muted-copy">
                      Open the "Why" drawer for the model lean to see what is helping,
                      what is dragging, and how much trust Bob is putting in the read.
                    </p>
                  </div>

                  <div className="explain-inline-card">
                    <span>
                      Model lean: {homeWins ? game.home_team : game.away_team} at{" "}
                      {(homeWins ? homePct : awayPct).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="disclaimer">
        ⚠️ <strong>Disclaimer:</strong> AFL predictions are generated by machine
        learning models considering home advantage, form, weather, and travel
        fatigue. They are not guarantees.
      </div>
    </div>
  );
}

function formatSquiggleConfidence(confidence?: number | string | null): string {
  if (confidence === null || confidence === undefined || confidence === "") {
    return "";
  }

  const numericConfidence = Number(confidence);
  if (!Number.isFinite(numericConfidence)) {
    return "";
  }

  const confidencePct =
    numericConfidence > 1 ? numericConfidence : numericConfidence * 100;
  return `${confidencePct.toFixed(0)}%`;
}

function getLiveScoreKey(update: AFLScoreUpdate): string | null {
  const key = update.id ?? update.game_id ?? update.gameid;
  return key === undefined || key === null ? null : String(key);
}

function toScore(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatScoreLabel(
  homeScore: number | null,
  awayScore: number | null,
  complete: number,
): string | null {
  if (homeScore === null || awayScore === null) {
    return null;
  }

  const status = complete >= 100 ? "Final" : "Live";
  return `${status}: ${homeScore}-${awayScore}`;
}

function formatLiveStatus(status: "connecting" | "connected" | "reconnecting") {
  if (status === "connected") {
    return "connected";
  }

  if (status === "reconnecting") {
    return "reconnecting";
  }

  return "connecting";
}
