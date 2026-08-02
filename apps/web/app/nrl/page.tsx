"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BobExplanation,
  FeatureImpactItem,
  ModelMetadata,
} from "../lib/bob/explainer";
import { Brain, Shield, BarChart3 } from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";
import ErrorState from "../components/ErrorState";
import ExplainDrawer from "../components/ExplainDrawer";
import {
  ConfidenceBadge,
  UrgencyBadge,
} from "../components/PredictionSignalBadges";
import BestNrlOpportunities from "../components/nrl/BestOpportunities";
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


type NRLGame = {
  game_id: string;
  home_team: string;
  away_team: string;
  features?: Record<string, number>;
  date?: string;
  venue?: string;
  complete?: number;
  hscore?: number | null;
  ascore?: number | null;
};

type NRLScoreUpdate = {
  id?: string | number;
  game_id?: string | number;
  gameid?: string | number;
  hscore?: number | string | null;
  ascore?: number | string | null;
  complete?: number | string | null;
  status?: string;
};

type NRLPrediction = {
  game_id: string;
  predictions: {
    home_team: string;
    away_team: string;
    home_win_probability: number;
    away_win_probability: number;
    fair_odds_home: number;
    fair_odds_away: number;
    market_odds_home?: number | null;
    market_odds_away?: number | null;
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

type NRLPredictionEntry = readonly [string, NRLPrediction];

function getNrlCacheKeys() {
  const dateKey = getMlCacheDateKey();

  return {
    fixturesKey: getMlDataCacheKey("fixtures", "nrl", dateKey),
    predictionsKey: getMlDataCacheKey("predictions", "nrl", dateKey),
  };
}

function isNrlPredictionEntry(
  entry: NRLPredictionEntry | null,
): entry is NRLPredictionEntry {
  return entry !== null;
}

async function fetchUpcomingNrlGames() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/api/nrl/games/upcoming`, {
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn("NRL upcoming endpoint returned 404, falling back to empty list.");
        return [];
      }
      throw new Error(`NRL fixtures request failed with ${response.status}`);
    }

    const data = await response.json();
    return (data?.games ?? []) as NRLGame[];
  } catch (error) {
    console.error("fetchUpcomingNrlGames failed:", error);
    return [];
  }
}

async function fetchNrlPredictions(games: NRLGame[]) {
  if (!games || games.length === 0) return {};

  const entries = await Promise.all(
    games.map(async (game) => {
      try {
        const response = await fetchWithTimeout(`${ML_API}/api/predict/nrl`, {
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

  return Object.fromEntries(entries.filter(isNrlPredictionEntry)) as Record<
    string,
    NRLPrediction
  >;
}

export default function NRLPage() {
  const [games, setGames] = useState<NRLGame[]>([]);
  const [predictions, setPredictions] = useState<Record<string, NRLPrediction>>(
    {},
  );
  const [liveScores, setLiveScores] = useState<Record<string, NRLScoreUpdate>>({});
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
    const { fixturesKey, predictionsKey } = getNrlCacheKeys();
    const metadata = getMlDataCacheMetadata([fixturesKey, predictionsKey]);

    if (!isMountedRef.current) {
      return;
    }

    setLastUpdated(metadata.lastUpdated);
    setNextRefreshAt(metadata.nextRefreshAt);
  };

  const hydrateFromCache = () => {
    const { fixturesKey, predictionsKey } = getNrlCacheKeys();
    const cachedGames = readMlDataCache<NRLGame[]>(fixturesKey);
    const cachedPredictions = readMlDataCache<Record<string, NRLPrediction>>(
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

    const { fixturesKey, predictionsKey } = getNrlCacheKeys();

    const fixturesEntry = await refreshMlDataCache(
      fixturesKey,
      fetchUpcomingNrlGames,
      { force: true },
    ).catch((error) => {
      refreshHadFailure = true;
      usedCacheFallback = true;
      console.error("Failed to refresh NRL fixtures:", error);
      scheduleMlDataCacheRetry(fixturesKey);
      return readMlDataCache<NRLGame[]>(fixturesKey);
    });

    if (fixturesEntry && isMountedRef.current) {
      setGames(fixturesEntry.data);
      setLoading(false);
    }

    if (fixturesEntry) {
      const predictionsEntry = await refreshMlDataCache(
        predictionsKey,
        () => fetchNrlPredictions(fixturesEntry.data),
        { force: true },
      ).catch((error) => {
        refreshHadFailure = true;
        usedCacheFallback = true;
        console.error("Failed to refresh NRL predictions:", error);
        scheduleMlDataCacheRetry(predictionsKey);
        return readMlDataCache<Record<string, NRLPrediction>>(predictionsKey);
      });

      if (predictionsEntry && isMountedRef.current) {
        setPredictions(predictionsEntry.data);
      }
    }

    syncCacheMetadata();
    refreshingRef.current = false;
    trackRefreshOutcome("/nrl", refreshStartedAt, {
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
    const eventSource = new EventSource(`${ML_API}/api/nrl/games/live`);

    const handleGamesEvent = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data);
        const updates = Array.isArray(parsed) ? parsed : [parsed];
        const nextScores: Record<string, NRLScoreUpdate> = {};

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
    trackStaleCache("/nrl", lastUpdated);
  }, [lastUpdated]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <Shield size={48} />
          <p>Loading NRL snapshot...</p>
        </div>
      </div>
    );
  }

  const nrlOpportunities = rankOpportunities(
    games.flatMap((game) => {
      const prediction = predictions[game.game_id];
      if (!prediction) {
        return [];
      }

      const homePct = prediction.predictions.home_win_probability;
      const awayPct = prediction.predictions.away_win_probability;
      const homeWins = homePct > awayPct;

      return [
        {
          id: game.game_id,
          sport: "nrl" as const,
          selectionName: homeWins ? game.home_team : game.away_team,
          eventLabel: `${game.home_team} vs ${game.away_team}`,
          probability: homeWins ? homePct : awayPct,
          fairOdds: homeWins
            ? prediction.predictions.fair_odds_home
            : prediction.predictions.fair_odds_away,
          confidenceSignal: getConfidenceSignal(prediction.ai_insights_context),
          urgencySignal: getUrgencySignal({
            startTime: game.date,
            isClosed: (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
            isResultPending: (game.complete ?? 0) >= 100,
          }),
          marketOdds: homeWins
            ? prediction.predictions.market_odds_home ?? undefined
            : prediction.predictions.market_odds_away ?? undefined,
          href: "/nrl",
          note: (homeWins ? prediction.predictions.market_odds_home : prediction.predictions.market_odds_away)
            ? undefined
            : "Live market prices are not attached here yet, so this section stays honest by ranking model leans instead of claiming a price edge.",
        },
      ];
    }),
  ).slice(0, 5);

  const hasNrlData = games.length > 0 || Object.keys(predictions).length > 0;
  const nrlStatus = getCachedViewStatus({
    resourceLabel: "NRL data",
    hasData: hasNrlData,
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

      {nrlStatus ? (
        <div className="status-stack">
          <ErrorState
            title={nrlStatus.title}
            message={nrlStatus.message}
            tone={nrlStatus.tone}
            actionLabel="Refresh now"
            onAction={() => void refreshPage()}
            compact
          />
        </div>
      ) : null}

      {!hasNrlData && refreshFailed ? (
        <ErrorState
          title="NRL board unavailable"
          message="BetMate could not load a usable NRL snapshot yet. Try a manual refresh."
          tone="danger"
          actionLabel="Refresh now"
          onAction={() => void refreshPage()}
        />
      ) : (
        <>
          <ErrorBoundary sectionName="NRL opportunities">
            <BestNrlOpportunities opportunities={nrlOpportunities} />
          </ErrorBoundary>

          <ErrorBoundary sectionName="NRL predictions">
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

                if (!prediction) {
                  return (
                    <div key={game.game_id} className="game-prediction-card flex items-center justify-center p-6 border border-white/5 rounded-2xl bg-white/5 mb-3">
                      <span className="text-slate-400 font-bold text-sm">{game.home_team} vs {game.away_team} - <span className="text-slate-500 font-normal">Pending Data</span></span>
                    </div>
                  );
                }
                const homePct = prediction.predictions.home_win_probability;
                const awayPct = prediction.predictions.away_win_probability;
                const homeWins = homePct > awayPct;
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
                      <div className={`team-block ${homeWins ? "favoured" : ""}`}>
                        <span className="team-label">HOME</span>
                        <span className="team-name-lg">{game.home_team}</span>
                        <span className="team-prob-lg">{homePct.toFixed(1)}%</span>
                        {prediction ? (
                          <span className="team-odds">
                            Fair: ${prediction.predictions.fair_odds_home.toFixed(2)}
                          </span>
                        ) : null}
                        {prediction?.predictions.market_odds_home ? (
                          <span className="team-odds market">
                            Betfair: ${prediction.predictions.market_odds_home.toFixed(2)}
                          </span>
                        ) : null}
                        {prediction ? (
                          <PaperBetAction
                            variant="phase1"
                            label="Log Selection Home"
                            loggedLabel="Home Logged"
                            cancelLabel="Cancel"
                            openBetslipOnAdd={false}
                            fullWidth
                            bet={{
                              sport: "nrl",
                              event_id: game.game_id,
                              event_name: `${game.home_team} vs ${game.away_team}`,
                              selection: game.home_team,
                              odds: prediction.predictions.market_odds_home ?? prediction.predictions.fair_odds_home,
                              bet_type: "head_to_head",
                              stake: 10,
                              odds_source: prediction.predictions.market_odds_home ? "market" : "model_fair",
                              current_odds: prediction.predictions.market_odds_home ?? prediction.predictions.fair_odds_home,
                              can_compare_odds: Boolean(prediction.predictions.market_odds_home && prediction.predictions.market_odds_home > 1),
                              event_start_time: game.date,
                              is_closed: gameComplete > 0 && gameComplete < 100,
                            }}
                          />
                        ) : null}
                      </div>

                      <div className="matchup-center-block">
                        <span className="matchup-center-kicker">NRL Matchup</span>
                        <span className="matchup-center-title">
                          {game.home_team} vs {game.away_team}
                        </span>
                        <span className="matchup-center-subtitle">
                          {scoreLabel ?? (game.date ? new Date(game.date).toLocaleString("en-AU", { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Start time pending")}
                        </span>
                      </div>

                      <div className={`team-block ${!homeWins ? "favoured" : ""}`}>
                        <span className="team-label">AWAY</span>
                        <span className="team-name-lg">{game.away_team}</span>
                        <span className="team-prob-lg">{awayPct.toFixed(1)}%</span>
                        {prediction ? (
                          <span className="team-odds">
                            Fair: ${prediction.predictions.fair_odds_away.toFixed(2)}
                          </span>
                        ) : null}
                        {prediction?.predictions.market_odds_away ? (
                          <span className="team-odds market">
                            Betfair: ${prediction.predictions.market_odds_away.toFixed(2)}
                          </span>
                        ) : null}
                        {prediction ? (
                          <PaperBetAction
                            variant="phase1"
                            label="Log Selection Away"
                            loggedLabel="Away Logged"
                            cancelLabel="Cancel"
                            openBetslipOnAdd={false}
                            fullWidth
                            bet={{
                              sport: "nrl",
                              event_id: game.game_id,
                              event_name: `${game.home_team} vs ${game.away_team}`,
                              selection: game.away_team,
                              odds: prediction.predictions.market_odds_away ?? prediction.predictions.fair_odds_away,
                              bet_type: "head_to_head",
                              stake: 10,
                              odds_source: prediction.predictions.market_odds_away ? "market" : "model_fair",
                              current_odds: prediction.predictions.market_odds_away ?? prediction.predictions.fair_odds_away,
                              can_compare_odds: Boolean(prediction.predictions.market_odds_away && prediction.predictions.market_odds_away > 1),
                              event_start_time: game.date,
                              is_closed: gameComplete > 0 && gameComplete < 100,
                            }}
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="game-prob-bar large">
                      <div className="prob-fill home" style={{ width: `${homePct}%` }} />
                      <div className="prob-fill away" style={{ width: `${awayPct}%` }} />
                    </div>

                    <div className="game-context-row">
                      {confidenceSignal ? <ConfidenceBadge signal={confidenceSignal} /> : null}
                      {urgencySignal ? <UrgencyBadge signal={urgencySignal} /> : null}
                      {game.venue ? <span className="context-chip">📍 {game.venue}</span> : null}
                      {prediction ? (
                        <>
                          <button
                            type="button"
                            className="why-pick-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveExplanation(
                                buildBobExplanation({
                                  sport: "nrl",
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
                          <div onClick={(event) => event.stopPropagation()} style={{ marginLeft: 'auto' }}>
                            <FeedbackButtons 
                              sport="nrl" 
                              eventId={game.game_id} 
                              selection={homeWins ? game.home_team : game.away_team}
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
          </ErrorBoundary>
        </>
      )}

      <div className="disclaimer">
        ⚠️ <strong>Disclaimer:</strong> NRL predictions are generated by machine
        learning models considering form, rest, travel, and historical matchups. They are not guarantees.
      </div>
    </div>
  );
}
