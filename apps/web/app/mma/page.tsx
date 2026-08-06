"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BobExplanation,
  FeatureImpactItem,
  ModelMetadata,
} from "../lib/bob/explainer";
import { Brain, Swords, BarChart3 } from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";
import ErrorState from "../components/ErrorState";
import ExplainDrawer from "../components/ExplainDrawer";
import {
  ConfidenceBadge,
  UrgencyBadge,
} from "../components/PredictionSignalBadges";
import BestMmaOpportunities from "../components/mma/BestOpportunities";
import RefreshControls from "../components/RefreshControls";
import { buildBobExplanation } from "../lib/bob/explainer";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { ML_API } from "../lib/mlApi";
import { safeResponseJson } from "../lib/api";
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
import SportCodeFilter from "../components/sport/SportCodeFilter";


type MMAMatchup = {
  game_id: string;
  home_team: string; // Fighter 1
  away_team: string; // Fighter 2
  features?: Record<string, number>;
  date?: string;
  weight_class?: string;
  venue?: string;
  complete?: number;
  hscore?: number | null; // e.g. winner (1 for Fighter 1, 2 for Fighter 2)
  ascore?: number | null;
};

type MMAPrediction = {
  game_id: string;
  predictions: {
    home_team: string; // Fighter 1
    away_team: string; // Fighter 2
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

type MMAPredictionEntry = readonly [string, MMAPrediction];

function getMmaCacheKeys() {
  const dateKey = getMlCacheDateKey();

  return {
    fixturesKey: getMlDataCacheKey("fixtures", "mma", dateKey),
    predictionsKey: getMlDataCacheKey("predictions", "mma", dateKey),
  };
}

function isMmaPredictionEntry(
  entry: MMAPredictionEntry | null,
): entry is MMAPredictionEntry {
  return entry !== null;
}

async function fetchTodayMmaGames() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/api/mma/games/today`, {
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn("MMA today endpoint returned 404, falling back to empty list.");
        return [];
      }
      throw new Error(`MMA fixtures request failed with ${response.status}`);
    }

    const data = await safeResponseJson(response);
    return (data?.games ?? []) as MMAMatchup[];
  } catch (error) {
    console.error("fetchTodayMmaGames failed:", error);
    return [];
  }
}

async function fetchMmaPredictions(games: MMAMatchup[]) {
  if (!games || games.length === 0) return {};

  const entries = await Promise.all(
    games.map(async (game) => {
      try {
        const response = await fetchWithTimeout(`${ML_API}/api/predict/mma`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(game),
        });

        if (!response.ok) {
          return null;
        }

        const predData = await safeResponseJson(response);
        if (!predData) return null;
        return [game.game_id, predData] as const;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(entries.filter(isMmaPredictionEntry)) as Record<
    string,
    MMAPrediction
  >;
}

export default function MMAPage() {
  const [games, setGames] = useState<MMAMatchup[]>([]);
  const [predictions, setPredictions] = useState<Record<string, MMAPrediction>>(
    {},
  );
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
    const { fixturesKey, predictionsKey } = getMmaCacheKeys();
    const metadata = getMlDataCacheMetadata([fixturesKey, predictionsKey]);

    if (!isMountedRef.current) {
      return;
    }

    setLastUpdated(metadata.lastUpdated);
    setNextRefreshAt(metadata.nextRefreshAt);
  };

  const hydrateFromCache = () => {
    const { fixturesKey, predictionsKey } = getMmaCacheKeys();
    const cachedGames = readMlDataCache<MMAMatchup[]>(fixturesKey);
    const cachedPredictions = readMlDataCache<Record<string, MMAPrediction>>(
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

    const { fixturesKey, predictionsKey } = getMmaCacheKeys();

    const fixturesEntry = await refreshMlDataCache(
      fixturesKey,
      fetchTodayMmaGames,
      { force: true },
    ).catch((error) => {
      refreshHadFailure = true;
      usedCacheFallback = true;
      console.error("Failed to refresh MMA fixtures:", error);
      scheduleMlDataCacheRetry(fixturesKey);
      return readMlDataCache<MMAMatchup[]>(fixturesKey);
    });

    if (fixturesEntry && isMountedRef.current) {
      setGames(fixturesEntry.data);
      setLoading(false);
    }

    if (fixturesEntry) {
      const predictionsEntry = await refreshMlDataCache(
        predictionsKey,
        () => fetchMmaPredictions(fixturesEntry.data),
        { force: true },
      ).catch((error) => {
        refreshHadFailure = true;
        usedCacheFallback = true;
        console.error("Failed to refresh MMA predictions:", error);
        scheduleMlDataCacheRetry(predictionsKey);
        return readMlDataCache<Record<string, MMAPrediction>>(predictionsKey);
      });

      if (predictionsEntry && isMountedRef.current) {
        setPredictions(predictionsEntry.data);
      }
    }

    syncCacheMetadata();
    refreshingRef.current = false;
    trackRefreshOutcome("/mma", refreshStartedAt, {
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
    trackStaleCache("/mma", lastUpdated);
  }, [lastUpdated]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <Swords size={48} />
          <p>Loading MMA snapshot...</p>
        </div>
      </div>
    );
  }

  const mmaOpportunities = rankOpportunities(
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
          sport: "mma" as const,
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
          href: "/mma",
          marketOdds: homeWins
            ? prediction.predictions.market_odds_home ?? undefined
            : prediction.predictions.market_odds_away ?? undefined,
          note: (homeWins ? prediction.predictions.market_odds_home : prediction.predictions.market_odds_away)
            ? undefined
            : "Live market prices are not attached here yet, so this section stays honest by ranking model leans instead of claiming a price edge.",
        },
      ];
    }),
  ).slice(0, 5);

  const hasMmaData = games.length > 0 || Object.keys(predictions).length > 0;


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
      <SportCodeFilter activeSport="mma" />

      {!hasMmaData && refreshFailed ? (
        <ErrorState
          title="MMA board unavailable"
          message="BetMate could not load a usable MMA snapshot yet. Try a manual refresh."
          tone="danger"
          actionLabel="Refresh now"
          onAction={() => void refreshPage()}
        />
      ) : (
        <>
          <ErrorBoundary sectionName="MMA opportunities">
            <BestMmaOpportunities opportunities={mmaOpportunities} />
          </ErrorBoundary>

          <ErrorBoundary sectionName="MMA predictions">
            <div className="game-cards-list">
              {games.map((game) => {
                const prediction = predictions[game.game_id];
                const gameComplete = Number(game.complete ?? 0);
                const scoreLabel = gameComplete >= 100 ? "Final Fight Result" : null;

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
                        <span className="team-label">FIGHTER 1</span>
                        <span className="team-name-lg">{game.home_team}</span>
                        <span className="team-prob-lg">{homePct.toFixed(1)}%</span>
                        {prediction ? (
                          <span className="team-odds">
                            Fair: ${prediction.predictions.fair_odds_home.toFixed(2)}
                          </span>
                        ) : null}
                        {prediction?.predictions.market_odds_home ? (
                          <span className="team-odds market">Betfair: ${prediction.predictions.market_odds_home.toFixed(2)}</span>
                        ) : null}
                        {prediction ? (
                          <PaperBetAction
                            variant="phase1"
                            label="Log Selection Fighter 1"
                            loggedLabel="Fighter 1 Logged"
                            cancelLabel="Cancel"
                            openBetslipOnAdd={false}
                            fullWidth
                            bet={{
                              sport: "mma",
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
                        <span className="matchup-center-kicker">MMA Bout</span>
                        <span className="matchup-center-title">
                          {game.home_team} vs {game.away_team}
                        </span>
                        <span className="matchup-center-subtitle">
                          {scoreLabel ?? (game.date ? new Date(game.date).toLocaleString("en-AU", { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Bout time pending")}
                        </span>
                      </div>

                      <div className={`team-block ${!homeWins ? "favoured" : ""}`}>
                        <span className="team-label">FIGHTER 2</span>
                        <span className="team-name-lg">{game.away_team}</span>
                        <span className="team-prob-lg">{awayPct.toFixed(1)}%</span>
                        {prediction ? (
                          <span className="team-odds">
                            Fair: ${prediction.predictions.fair_odds_away.toFixed(2)}
                          </span>
                        ) : null}
                        {prediction?.predictions.market_odds_away ? (
                          <span className="team-odds market">Betfair: ${prediction.predictions.market_odds_away.toFixed(2)}</span>
                        ) : null}
                        {prediction ? (
                          <PaperBetAction
                            variant="phase1"
                            label="Log Selection Fighter 2"
                            loggedLabel="Fighter 2 Logged"
                            cancelLabel="Cancel"
                            openBetslipOnAdd={false}
                            fullWidth
                            bet={{
                              sport: "mma",
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
                      {game.weight_class ? <span className="context-chip">⚖️ {game.weight_class}</span> : null}
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
                                  sport: "mma",
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
                              sport="mma" 
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
        ⚠️ <strong>Disclaimer:</strong> MMA predictions are generated by machine
        learning models considering striking/grappling stats, physical attributes, form, and age. They are not guarantees.
      </div>
    </div>
  );
}
