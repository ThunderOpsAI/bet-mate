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
import SportCard from "../components/sport/SportCard";
import SportMatchupDrawer, { type MatchupDrawerData } from "../components/sport/SportMatchupDrawer";


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
  const [drawerMatchup, setDrawerMatchup] = useState<MatchupDrawerData | null>(null);
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
          <Swords size={28} />
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
    <div className="space-y-5 px-4 sm:px-6 py-6 max-w-7xl mx-auto">
      <ExplainDrawer
        open={activeExplanation !== null}
        explanation={activeExplanation}
        onClose={() => setActiveExplanation(null)}
      />
      <div className="flex items-center justify-end gap-3 flex-wrap mb-3">
        <RefreshControls
          lastUpdated={lastUpdated}
          nextRefreshAt={nextRefreshAt}
          isRefreshing={refreshing}
          onRefresh={refreshPage}
        />
      </div>
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
                    <div key={game.game_id} className="game-prediction-card flex items-center justify-center p-4 border border-white/5 rounded-xl bg-white/5 mb-3">
                      <span className="text-slate-400 font-bold text-xs">{game.home_team} vs {game.away_team} - <span className="text-slate-500 font-normal">Pending Data</span></span>
                    </div>
                  );
                }

                const homePct = prediction.predictions.home_win_probability;
                const awayPct = prediction.predictions.away_win_probability;
                const confidenceSignal = getConfidenceSignal(prediction.ai_insights_context);
                const urgencySignal = getUrgencySignal({
                  startTime: game.date,
                  isClosed: gameComplete > 0 && gameComplete < 100,
                  isResultPending: gameComplete >= 100,
                });

                const startDateLabel = game.date
                  ? new Date(game.date).toLocaleString("en-AU", { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : "Bout time pending";

                const matchupData: MatchupDrawerData = {
                  id: game.game_id,
                  sport: "mma",
                  title: `${game.home_team} vs ${game.away_team}`,
                  subTitle: scoreLabel ?? startDateLabel,
                  date: game.date,
                  venue: game.venue,
                  roundOrLeague: game.weight_class,
                  outcomes: [
                    {
                      name: game.home_team,
                      isHome: true,
                      winProb: homePct,
                      fairOdds: prediction.predictions.fair_odds_home,
                      marketOdds: prediction.predictions.market_odds_home,
                    },
                    {
                      name: game.away_team,
                      isAway: true,
                      winProb: awayPct,
                      fairOdds: prediction.predictions.fair_odds_away,
                      marketOdds: prediction.predictions.market_odds_away,
                    },
                  ],
                  metadata: {
                    confidenceSignal,
                    urgencySignal,
                  },
                  featureImpact: prediction.feature_impact,
                  aiInsightsContext: prediction.ai_insights_context,
                  modelMetadata: prediction.model_metadata,
                };

                return (
                  <SportCard
                    key={game.game_id}
                    matchup={matchupData}
                    onOpenDrawer={(m) => setDrawerMatchup(m)}
                  />
                );
              })}
            </div>
          </ErrorBoundary>
          <SportMatchupDrawer
            isOpen={drawerMatchup !== null}
            onClose={() => setDrawerMatchup(null)}
            matchup={drawerMatchup}
          />
        </>
      )}

      <div className="disclaimer">
        ⚠️ <strong>Disclaimer:</strong> MMA predictions are generated by machine
        learning models considering striking/grappling stats, physical attributes, form, and age. They are not guarantees.
      </div>
    </div>
  );
}
