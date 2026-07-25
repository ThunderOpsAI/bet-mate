"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BobExplanation,
  FeatureImpactItem,
  ModelMetadata,
} from "../lib/bob/explainer";
import { Brain, Globe, BarChart3 } from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";
import ErrorState from "../components/ErrorState";
import ExplainDrawer from "../components/ExplainDrawer";
import {
  ConfidenceBadge,
  UrgencyBadge,
} from "../components/PredictionSignalBadges";
import BestSoccerOpportunities from "../components/soccer/BestOpportunities";
import RefreshControls from "../components/RefreshControls";
import { buildBobExplanation } from "../lib/bob/explainer";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
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
import {
  getCachedViewStatus,
  trackRefreshOutcome,
  trackStaleCache,
} from "../lib/monitoring/performance";
import {
  getConfidenceSignal,
  getUrgencySignal,
} from "../lib/predictionSignals";
import { rankOpportunities } from "../lib/opportunityScore";
import PaperBetAction from "../components/PaperBetAction";
import FeedbackButtons from "../components/FeedbackButtons";
import { deriveFallbackWinProb } from "../lib/fallbackProbability";

type SoccerGame = {
  game_id: string;
  home_team: string;
  away_team: string;
  features?: Record<string, number>;
  date?: string;
  league?: string;
  complete?: number;
  hscore?: number | null;
  ascore?: number | null;
};

type SoccerScoreUpdate = {
  id?: string | number;
  game_id?: string | number;
  gameid?: string | number;
  hscore?: number | string | null;
  ascore?: number | string | null;
  complete?: number | string | null;
  status?: string;
};

type SoccerPrediction = {
  game_id: string;
  predictions: {
    home_team: string;
    away_team: string;
    home_win_probability: number;
    away_win_probability: number;
    draw_probability?: number;
    fair_odds_home: number;
    fair_odds_away: number;
    fair_odds_draw?: number;
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

type SoccerPredictionEntry = readonly [string, SoccerPrediction];

function getSoccerCacheKeys() {
  const dateKey = getMlCacheDateKey();

  return {
    fixturesKey: getMlDataCacheKey("fixtures", "soccer", dateKey),
    predictionsKey: getMlDataCacheKey("predictions", "soccer", dateKey),
  };
}

function isSoccerPredictionEntry(
  entry: SoccerPredictionEntry | null,
): entry is SoccerPredictionEntry {
  return entry !== null;
}

async function fetchTodaySoccerGames() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/api/soccer/games/today`, {
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn("Soccer today endpoint returned 404, falling back to empty list.");
        return [];
      }
      throw new Error(`Soccer fixtures request failed with ${response.status}`);
    }

    const data = await response.json();
    return (data?.games ?? []) as SoccerGame[];
  } catch (error) {
    console.error("fetchTodaySoccerGames failed:", error);
    return [];
  }
}

async function fetchSoccerPredictions(games: SoccerGame[]) {
  if (!games || games.length === 0) return {};

  const entries = await Promise.all(
    games.map(async (game) => {
      try {
        const response = await fetchWithTimeout(`${ML_API}/api/predict/soccer`, {
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

  return Object.fromEntries(entries.filter(isSoccerPredictionEntry)) as Record<
    string,
    SoccerPrediction
  >;
}

export default function SoccerPage() {
  const [games, setGames] = useState<SoccerGame[]>([]);
  const [predictions, setPredictions] = useState<Record<string, SoccerPrediction>>(
    {},
  );
  const [liveScores, setLiveScores] = useState<Record<string, SoccerScoreUpdate>>({});
  const [liveStatus, setLiveStatus] = useState<
    "connecting" | "connected" | "reconnecting"
  >("connecting");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [activeExplanation, setActiveExplanation] = useState<BobExplanation | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const refreshingRef = useRef(false);

  const syncCacheMetadata = () => {
    const { fixturesKey, predictionsKey } = getSoccerCacheKeys();
    const metadata = getMlDataCacheMetadata([fixturesKey, predictionsKey]);

    if (!isMountedRef.current) {
      return;
    }

    setLastUpdated(metadata.lastUpdated);
    setNextRefreshAt(metadata.nextRefreshAt);
  };

  const hydrateFromCache = () => {
    const { fixturesKey, predictionsKey } = getSoccerCacheKeys();
    const cachedGames = readMlDataCache<SoccerGame[]>(fixturesKey);
    const cachedPredictions = readMlDataCache<Record<string, SoccerPrediction>>(
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

    const refreshStartedAt = Date.now();
    let refreshHadFailure = false;
    let usedCacheFallback = false;

    refreshingRef.current = true;
    if (isMountedRef.current) {
      setRefreshing(true);
    }

    const { fixturesKey, predictionsKey } = getSoccerCacheKeys();

    const fixturesEntry = await refreshMlDataCache(
      fixturesKey,
      fetchTodaySoccerGames,
      { force: true },
    ).catch((error) => {
      refreshHadFailure = true;
      usedCacheFallback = true;
      console.error("Failed to refresh Soccer fixtures:", error);
      scheduleMlDataCacheRetry(fixturesKey);
      return readMlDataCache<SoccerGame[]>(fixturesKey);
    });

    if (fixturesEntry && isMountedRef.current) {
      setGames(fixturesEntry.data);
      setLoading(false);
    }

    if (fixturesEntry) {
      const predictionsEntry = await refreshMlDataCache(
        predictionsKey,
        () => fetchSoccerPredictions(fixturesEntry.data),
        { force: true },
      ).catch((error) => {
        refreshHadFailure = true;
        usedCacheFallback = true;
        console.error("Failed to refresh Soccer predictions:", error);
        scheduleMlDataCacheRetry(predictionsKey);
        return readMlDataCache<Record<string, SoccerPrediction>>(predictionsKey);
      });

      if (predictionsEntry && isMountedRef.current) {
        setPredictions(predictionsEntry.data);
      }
    }

    syncCacheMetadata();
    refreshingRef.current = false;
    trackRefreshOutcome("/soccer", refreshStartedAt, {
      failed: refreshHadFailure,
      usedCache: usedCacheFallback,
    });

    if (isMountedRef.current) {
      setRefreshFailed(refreshHadFailure);
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
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
    const eventSource = new EventSource(`${ML_API}/api/soccer/games/live`);

    const handleGamesEvent = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data);
        const updates = Array.isArray(parsed) ? parsed : [parsed];
        const nextScores: Record<string, SoccerScoreUpdate> = {};

        for (const update of updates) {
          const key = update.id ?? update.game_id ?? update.gameid;
          if (key) {
            nextScores[String(key)] = update;
          }
        }

        if (Object.keys(nextScores).length > 0) {
          setLiveScores((current) => ({ ...current, ...nextScores }));
        }
        setLiveStatus("connected");
      } catch {
        // Ignore welcome pings.
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

  useEffect(() => {
    trackStaleCache("/soccer", lastUpdated);
  }, [lastUpdated]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <Globe size={48} />
          <p>Loading Soccer snapshot...</p>
        </div>
      </div>
    );
  }

  const soccerOpportunities = rankOpportunities(
    games.flatMap((game) => {
      const prediction = predictions[game.game_id];
      if (!prediction) {
        return [];
      }

      const homePct = prediction.predictions.home_win_probability;
      const awayPct = prediction.predictions.away_win_probability;
      const drawPct = prediction.predictions.draw_probability ?? 0;
      
      let selectionName = game.home_team;
      let probability = homePct;
      let fairOdds = prediction.predictions.fair_odds_home;

      if (awayPct > homePct && awayPct > drawPct) {
        selectionName = game.away_team;
        probability = awayPct;
        fairOdds = prediction.predictions.fair_odds_away;
      } else if (drawPct > homePct && drawPct > awayPct) {
        selectionName = "Draw";
        probability = drawPct;
        fairOdds = prediction.predictions.fair_odds_draw ?? 3.0;
      }

      return [
        {
          id: game.game_id,
          sport: "soccer" as const,
          selectionName,
          eventLabel: `${game.home_team} vs ${game.away_team}`,
          probability,
          fairOdds,
          confidenceSignal: getConfidenceSignal(prediction.ai_insights_context),
          urgencySignal: getUrgencySignal({
            startTime: game.date,
            isClosed: (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
            isResultPending: (game.complete ?? 0) >= 100,
          }),
          href: "/soccer",
          note: "Live market prices are not attached here yet, so this section ranks model leans.",
        },
      ];
    }),
  ).slice(0, 5);

  const hasSoccerData = games.length > 0 || Object.keys(predictions).length > 0;
  const soccerStatus = getCachedViewStatus({
    resourceLabel: "Soccer data",
    hasData: hasSoccerData,
    lastUpdated,
    isRefreshing: refreshing,
    refreshFailed,
  });

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

      {soccerStatus ? (
        <div className="status-stack">
          <ErrorState
            title={soccerStatus.title}
            message={soccerStatus.message}
            tone={soccerStatus.tone}
            actionLabel="Refresh now"
            onAction={() => void refreshPage()}
            compact
          />
        </div>
      ) : null}

      {!hasSoccerData && refreshFailed ? (
        <ErrorState
          title="Soccer board unavailable"
          message="BetMate could not load a usable Soccer snapshot yet. Try a manual refresh."
          tone="danger"
          actionLabel="Refresh now"
          onAction={() => void refreshPage()}
        />
      ) : (
        <>
          <ErrorBoundary sectionName="Soccer opportunities">
            <BestSoccerOpportunities opportunities={soccerOpportunities} />
          </ErrorBoundary>

          <ErrorBoundary sectionName="Soccer predictions">
            <div className="game-cards-list">
              {games.map((game) => {
                const prediction = predictions[game.game_id];
                const liveScore = liveScores[game.game_id];
                const homeScore = liveScore?.hscore ?? game.hscore ?? null;
                const awayScore = liveScore?.ascore ?? game.ascore ?? null;
                const gameComplete = Number(liveScore?.complete ?? game.complete ?? 0);
                const scoreLabel = homeScore !== null && awayScore !== null
                  ? `${gameComplete >= 100 ? "Final" : "Live"}: ${homeScore}-${awayScore}`
                  : null;

                const fallback = deriveFallbackWinProb(game.home_team, game.away_team);
                const drawPct = prediction?.predictions?.draw_probability ?? 26.0;
                const homePct = prediction?.predictions?.home_win_probability ?? Number((fallback.homePct * 0.74).toFixed(1));
                const awayPct = prediction?.predictions?.away_win_probability ?? Number((100 - homePct - drawPct).toFixed(1));
                const isExpanded = expandedGame === game.game_id;
                const confidenceSignal = prediction
                  ? getConfidenceSignal(prediction.ai_insights_context)
                  : null;
                const urgencySignal = getUrgencySignal({
                  startTime: game.date,
                  isClosed: gameComplete > 0 && gameComplete < 100,
                  isResultPending: gameComplete >= 100,
                });

                return (
                  <div
                    key={game.game_id}
                    className={`game-prediction-card ${isExpanded ? "expanded" : ""}`}
                    onClick={() => setExpandedGame(isExpanded ? null : game.game_id)}
                  >
                    <div className="game-matchup-header">
                      <div className="team-block">
                        <span className="team-label">HOME</span>
                        <span className="team-name-lg">{game.home_team}</span>
                        <span className="team-prob-lg">{homePct.toFixed(1)}%</span>
                        {prediction ? (
                          <span className="team-odds">
                            Fair: ${prediction.predictions.fair_odds_home.toFixed(2)}
                          </span>
                        ) : null}
                        {prediction ? (
                          <PaperBetAction
                            variant="phase1"
                            label="Log Home Win"
                            loggedLabel="Home Logged"
                            cancelLabel="Cancel"
                            openBetslipOnAdd={false}
                            fullWidth
                            bet={{
                              sport: "soccer",
                              event_id: game.game_id,
                              event_name: `${game.home_team} vs ${game.away_team}`,
                              selection: game.home_team,
                              odds: prediction.predictions.fair_odds_home,
                              bet_type: "head_to_head",
                              stake: 10,
                              odds_source: "model_fair",
                              current_odds: prediction.predictions.fair_odds_home,
                              can_compare_odds: false,
                              event_start_time: game.date,
                              is_closed: gameComplete > 0 && gameComplete < 100,
                            }}
                          />
                        ) : null}
                      </div>

                      {prediction?.predictions?.draw_probability !== undefined && (
                        <div className="team-block">
                          <span className="team-label">DRAW</span>
                          <span className="team-name-lg">Draw</span>
                          <span className="team-prob-lg">{drawPct.toFixed(1)}%</span>
                          <span className="team-odds">
                            Fair: ${prediction.predictions.fair_odds_draw?.toFixed(2) ?? "3.00"}
                          </span>
                          <PaperBetAction
                            variant="phase1"
                            label="Log Draw"
                            loggedLabel="Draw Logged"
                            cancelLabel="Cancel"
                            openBetslipOnAdd={false}
                            fullWidth
                            bet={{
                              sport: "soccer",
                              event_id: game.game_id,
                              event_name: `${game.home_team} vs ${game.away_team}`,
                              selection: "Draw",
                              odds: prediction.predictions.fair_odds_draw ?? 3.0,
                              bet_type: "head_to_head",
                              stake: 10,
                              odds_source: "model_fair",
                              current_odds: prediction.predictions.fair_odds_draw ?? 3.0,
                              can_compare_odds: false,
                              event_start_time: game.date,
                              is_closed: gameComplete > 0 && gameComplete < 100,
                            }}
                          />
                        </div>
                      )}

                      <div className="team-block">
                        <span className="team-label">AWAY</span>
                        <span className="team-name-lg">{game.away_team}</span>
                        <span className="team-prob-lg">{awayPct.toFixed(1)}%</span>
                        {prediction ? (
                          <span className="team-odds">
                            Fair: ${prediction.predictions.fair_odds_away.toFixed(2)}
                          </span>
                        ) : null}
                        {prediction ? (
                          <PaperBetAction
                            variant="phase1"
                            label="Log Away Win"
                            loggedLabel="Away Logged"
                            cancelLabel="Cancel"
                            openBetslipOnAdd={false}
                            fullWidth
                            bet={{
                              sport: "soccer",
                              event_id: game.game_id,
                              event_name: `${game.home_team} vs ${game.away_team}`,
                              selection: game.away_team,
                              odds: prediction.predictions.fair_odds_away,
                              bet_type: "head_to_head",
                              stake: 10,
                              odds_source: "model_fair",
                              current_odds: prediction.predictions.fair_odds_away,
                              can_compare_odds: false,
                              event_start_time: game.date,
                              is_closed: gameComplete > 0 && gameComplete < 100,
                            }}
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="game-prob-bar large">
                      <div className="prob-fill home" style={{ width: `${homePct}%` }} />
                      {prediction?.predictions?.draw_probability !== undefined && (
                        <div className="prob-fill draw" style={{ width: `${drawPct}%`, backgroundColor: "var(--border-primary)" }} />
                      )}
                      <div className="prob-fill away" style={{ width: `${awayPct}%` }} />
                    </div>

                    <div className="game-context-row">
                      {confidenceSignal ? <ConfidenceBadge signal={confidenceSignal} /> : null}
                      {urgencySignal ? <UrgencyBadge signal={urgencySignal} /> : null}
                      {game.league ? <span className="context-chip">🏆 {game.league}</span> : null}
                      {scoreLabel ? <span className="context-chip accent">{scoreLabel}</span> : <span className="context-chip">{game.date ? new Date(game.date).toLocaleString("en-AU", { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Start time pending"}</span>}
                      {prediction ? (
                        <>
                          <button
                            type="button"
                            className="why-pick-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveExplanation(
                                buildBobExplanation({
                                  sport: "soccer",
                                  selectionName: homePct > awayPct ? game.home_team : game.away_team,
                                  opponentName: homePct > awayPct ? game.away_team : game.home_team,
                                  probability: Math.max(homePct, awayPct),
                                  fairOdds: homePct > awayPct
                                    ? prediction.predictions.fair_odds_home
                                    : prediction.predictions.fair_odds_away,
                                  featureImpact: prediction.feature_impact,
                                  aiInsightsContext: prediction.ai_insights_context,
                                  modelMetadata: prediction.model_metadata,
                                }),
                              );
                            }}
                          >
                            <Brain size={14} /> Why this model lean?
                          </button>
                          <div onClick={(event) => event.stopPropagation()} style={{ marginLeft: 'auto' }}>
                            <FeedbackButtons 
                              sport="soccer" 
                              eventId={game.game_id} 
                              selection={homePct > awayPct ? game.home_team : game.away_team}
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
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </ErrorBoundary>
        </>
      )}

      <div className="disclaimer">
        ⚠️ <strong>Disclaimer:</strong> Soccer predictions are generated by machine
        learning models considering expected goals, home advantage, squad form, and leagues. They are not guarantees.
      </div>
    </div>
  );
}
