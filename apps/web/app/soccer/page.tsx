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
import SportMatchupDrawer, { type MatchupDrawerData, type DrawerOutcome } from "../components/sport/SportMatchupDrawer";


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

    const data = await safeResponseJson(response);
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

        const predData = await safeResponseJson(response);
        if (!predData) return null;
        return [game.game_id, predData] as const;
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
  const [drawerMatchup, setDrawerMatchup] = useState<MatchupDrawerData | null>(null);
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
          marketOdds: (selectionName === game.home_team)
            ? prediction.predictions.market_odds_home ?? undefined
            : (selectionName === game.away_team)
              ? prediction.predictions.market_odds_away ?? undefined
              : undefined,
          note: ((selectionName === game.home_team) ? prediction.predictions.market_odds_home : (selectionName === game.away_team) ? prediction.predictions.market_odds_away : null)
            ? undefined
            : "Live market prices are not attached here yet, so this section stays honest by ranking model leans instead of claiming a price edge.",
        },
      ];
    }),
  ).slice(0, 5);

  const hasSoccerData = games.length > 0 || Object.keys(predictions).length > 0;


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
      <SportCodeFilter activeSport="soccer" />

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

                if (!prediction) {
                  return (
                    <div key={game.game_id} className="game-prediction-card flex items-center justify-center p-4 border border-white/5 rounded-xl bg-white/5 mb-3">
                      <span className="text-slate-400 font-bold text-xs">{game.home_team} vs {game.away_team} - <span className="text-slate-500 font-normal">Pending Data</span></span>
                    </div>
                  );
                }

                const drawPct = prediction.predictions.draw_probability ?? 0;
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
                  : "Start time pending";

                const outcomes: DrawerOutcome[] = [
                  {
                    name: game.home_team,
                    isHome: true,
                    winProb: homePct,
                    fairOdds: prediction.predictions.fair_odds_home,
                    marketOdds: prediction.predictions.market_odds_home,
                  },
                ];

                if (prediction.predictions.draw_probability !== undefined && prediction.predictions.fair_odds_draw) {
                  outcomes.push({
                    name: "Draw",
                    isDraw: true,
                    winProb: drawPct,
                    fairOdds: prediction.predictions.fair_odds_draw,
                    marketOdds: null,
                  });
                }

                outcomes.push({
                  name: game.away_team,
                  isAway: true,
                  winProb: awayPct,
                  fairOdds: prediction.predictions.fair_odds_away,
                  marketOdds: prediction.predictions.market_odds_away,
                });

                const matchupData: MatchupDrawerData = {
                  id: game.game_id,
                  sport: "soccer",
                  title: `${game.home_team} vs ${game.away_team}`,
                  subTitle: scoreLabel ?? startDateLabel,
                  date: game.date,
                  roundOrLeague: game.league,
                  outcomes,
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
        ⚠️ <strong>Disclaimer:</strong> Soccer predictions are generated by machine
        learning models considering expected goals, home advantage, squad form, and leagues. They are not guarantees.
      </div>
    </div>
  );
}
