"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BobExplanation,
  FeatureImpactItem,
  ModelMetadata,
} from "../lib/bob/explainer";
import { Brain, Flag, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";
import ErrorState from "../components/ErrorState";
import ExplainDrawer from "../components/ExplainDrawer";
import {
  ConfidenceBadge,
  UrgencyBadge,
} from "../components/PredictionSignalBadges";
import BestGolfOpportunities from "../components/golf/BestOpportunities";
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
import { getEdgePercent, rankOpportunities } from "../lib/opportunityScore";
import PaperBetAction from "../components/PaperBetAction";
import FeedbackButtons from "../components/FeedbackButtons";
import SportCodeFilter from "../components/sport/SportCodeFilter";
import SportCard from "../components/sport/SportCard";
import SportMatchupDrawer, { type MatchupDrawerData } from "../components/sport/SportMatchupDrawer";

type GolfPlayer = {
  player_id: string;
  name: string;
  betfair_back_price?: number;
};

type GolfTournament = {
  tournament_id: string;
  name: string;
  venue?: string;
  start_time?: string;
  meeting_date?: string;
  players: GolfPlayer[];
};

type PlayerPrediction = {
  player_id: string;
  name: string;
  win_probability: number;
  fair_odds: number;
  market_odds?: number | null;
};

type GolfPrediction = {
  tournament_id: string;
  predictions: PlayerPrediction[];
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

type GolfPredictionEntry = readonly [string, GolfPrediction];

function getGolfCacheKeys() {
  const dateKey = getMlCacheDateKey();

  return {
    fixturesKey: getMlDataCacheKey("fixtures", "golf", dateKey),
    predictionsKey: getMlDataCacheKey("predictions", "golf", dateKey),
  };
}

function isGolfPredictionEntry(
  entry: GolfPredictionEntry | null,
): entry is GolfPredictionEntry {
  return entry !== null;
}

async function fetchTodayGolfTournaments() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/api/golf/games/today`, {
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn("Golf today endpoint returned 404, falling back to empty list.");
        return [];
      }
      throw new Error(`Golf fixtures request failed with ${response.status}`);
    }

    const data = await safeResponseJson(response);
    return (data?.games ?? []) as GolfTournament[];
  } catch (error) {
    console.error("fetchTodayGolfTournaments failed:", error);
    return [];
  }
}

async function fetchGolfPredictions(tournaments: GolfTournament[]) {
  if (!tournaments || tournaments.length === 0) return {};

  const entries = await Promise.all(
    tournaments.map(async (tournament) => {
      try {
        const response = await fetchWithTimeout(`${ML_API}/api/predict/golf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tournament),
        });

        if (!response.ok) {
          return null;
        }

        const predData = await safeResponseJson(response);
        if (!predData) return null;
        return [tournament.tournament_id, predData] as const;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(entries.filter(isGolfPredictionEntry)) as Record<
    string,
    GolfPrediction
  >;
}

export default function GolfPage() {
  const [tournaments, setTournaments] = useState<GolfTournament[]>([]);
  const [predictions, setPredictions] = useState<Record<string, GolfPrediction>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [expandedTournament, setExpandedTournament] = useState<string | null>(null);
  const [drawerMatchup, setDrawerMatchup] = useState<MatchupDrawerData | null>(null);
  const [activeExplanation, setActiveExplanation] = useState<BobExplanation | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const refreshingRef = useRef(false);

  const syncCacheMetadata = () => {
    const { fixturesKey, predictionsKey } = getGolfCacheKeys();
    const metadata = getMlDataCacheMetadata([fixturesKey, predictionsKey]);

    if (!isMountedRef.current) {
      return;
    }

    setLastUpdated(metadata.lastUpdated);
    setNextRefreshAt(metadata.nextRefreshAt);
  };

  const hydrateFromCache = () => {
    const { fixturesKey, predictionsKey } = getGolfCacheKeys();
    const cachedFixtures = readMlDataCache<GolfTournament[]>(fixturesKey);
    const cachedPredictions = readMlDataCache<Record<string, GolfPrediction>>(
      predictionsKey,
    );

    if (cachedFixtures && isMountedRef.current) {
      setTournaments(cachedFixtures.data);
    }

    if (cachedPredictions && isMountedRef.current) {
      setPredictions(cachedPredictions.data);
    }

    syncCacheMetadata();

    return {
      cachedFixtures,
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

    const { fixturesKey, predictionsKey } = getGolfCacheKeys();

    const fixturesEntry = await refreshMlDataCache(
      fixturesKey,
      fetchTodayGolfTournaments,
      { force: true },
    ).catch((error) => {
      refreshHadFailure = true;
      usedCacheFallback = true;
      console.error("Failed to refresh Golf fixtures:", error);
      scheduleMlDataCacheRetry(fixturesKey);
      return readMlDataCache<GolfTournament[]>(fixturesKey);
    });

    if (fixturesEntry && isMountedRef.current) {
      setTournaments(fixturesEntry.data);
      setLoading(false);
    }

    if (fixturesEntry) {
      const predictionsEntry = await refreshMlDataCache(
        predictionsKey,
        () => fetchGolfPredictions(fixturesEntry.data),
        { force: true },
      ).catch((error) => {
        refreshHadFailure = true;
        usedCacheFallback = true;
        console.error("Failed to refresh Golf predictions:", error);
        scheduleMlDataCacheRetry(predictionsKey);
        return readMlDataCache<Record<string, GolfPrediction>>(predictionsKey);
      });

      if (predictionsEntry && isMountedRef.current) {
        setPredictions(predictionsEntry.data);
      }
    }

    syncCacheMetadata();
    refreshingRef.current = false;
    trackRefreshOutcome("/golf", refreshStartedAt, {
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
    const { cachedFixtures, cachedPredictions } = hydrateFromCache();

    if (cachedFixtures) {
      setLoading(false);
    }

    const shouldRefresh =
      !cachedFixtures ||
      !cachedPredictions ||
      isMlDataCacheStale(cachedFixtures) ||
      isMlDataCacheStale(cachedPredictions);

    if (shouldRefresh) {
      void refreshPage();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    trackStaleCache("/golf", lastUpdated);
  }, [lastUpdated]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <Flag size={48} />
          <p>Loading Golf snapshot...</p>
        </div>
      </div>
    );
  }

  const golfOpportunities = rankOpportunities(
    tournaments.flatMap((tournament) => {
      const prediction = predictions[tournament.tournament_id];
      if (!prediction) {
        return [];
      }

      const confidenceSignal = prediction
        ? getConfidenceSignal(prediction.ai_insights_context)
        : null;
      const urgencySignal = getUrgencySignal({
        startTime: tournament.start_time,
        eventDate: tournament.meeting_date,
      });

      return prediction.predictions.map((pick) => {
        const player = tournament.players.find(
          (candidate) => candidate.player_id === pick.player_id,
        );

        return {
          id: `${tournament.tournament_id}-${pick.player_id}`,
          sport: "golf" as const,
          selectionName: pick.name,
          eventLabel: tournament.name,
          probability: pick.win_probability,
          fairOdds: pick.fair_odds,
          marketOdds: pick.market_odds ?? player?.betfair_back_price ?? undefined,
          confidenceSignal,
          urgencySignal,
          href: "/golf",
        };
      });
    }),
  ).slice(0, 5);

  const hasGolfData = tournaments.length > 0 || Object.keys(predictions).length > 0;


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
      <SportCodeFilter activeSport="golf" />

      {!hasGolfData && refreshFailed ? (
        <ErrorState
          title="Golf board unavailable"
          message="BetMate could not load a usable Golf snapshot yet. Try a manual refresh."
          tone="danger"
          actionLabel="Refresh now"
          onAction={() => void refreshPage()}
        />
      ) : (
        <>
          <ErrorBoundary sectionName="Golf opportunities">
            <BestGolfOpportunities opportunities={golfOpportunities} />
          </ErrorBoundary>

          <ErrorBoundary sectionName="Golf predictions">
            <div className="tournament-list">
              {tournaments.map((tournament) => {
                const prediction = predictions[tournament.tournament_id];
                const topPicks = prediction?.predictions?.slice(0, 5) ?? [];
                
                const confidenceSignal = prediction
                  ? getConfidenceSignal(prediction.ai_insights_context)
                  : null;
                const urgencySignal = getUrgencySignal({
                  startTime: tournament.start_time,
                  eventDate: tournament.meeting_date,
                });

                const outcomes = topPicks.map((pick) => {
                  const player = tournament.players.find(
                    (candidate) => candidate.player_id === pick.player_id,
                  );
                  const marketPrice = pick.market_odds ?? player?.betfair_back_price;

                  return {
                    name: pick.name,
                    winProb: pick.win_probability,
                    fairOdds: pick.fair_odds,
                    marketOdds: marketPrice,
                  };
                });

                const matchupData: MatchupDrawerData = {
                  id: tournament.tournament_id,
                  sport: "golf",
                  title: tournament.name,
                  subTitle: tournament.meeting_date || tournament.start_time || undefined,
                  venue: tournament.venue,
                  outcomes,
                  metadata: {
                    confidenceSignal,
                    urgencySignal,
                  },
                  featureImpact: prediction?.feature_impact,
                  aiInsightsContext: prediction?.ai_insights_context,
                  modelMetadata: prediction?.model_metadata,
                };

                return (
                  <SportCard
                    key={tournament.tournament_id}
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
        ⚠️ <strong>Disclaimer:</strong> Golf predictions are generated by machine
        learning models considering player rankings, historical course performance, and weather conditions. They are not guarantees.
      </div>
    </div>
  );
}
