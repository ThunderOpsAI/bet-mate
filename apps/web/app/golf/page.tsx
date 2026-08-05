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
  getCachedViewStatus,
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
  const golfStatus = getCachedViewStatus({
    resourceLabel: "Golf data",
    hasData: hasGolfData,
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

      {golfStatus ? (
        <div className="status-stack">
          <ErrorState
            title={golfStatus.title}
            message={golfStatus.message}
            tone={golfStatus.tone}
            actionLabel="Refresh now"
            onAction={() => void refreshPage()}
            compact
          />
        </div>
      ) : null}

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
            <div className="tournament-list" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {tournaments.map((tournament) => {
                const prediction = predictions[tournament.tournament_id];
                const isExpanded = expandedTournament === tournament.tournament_id;
                const topPicks = prediction?.predictions?.slice(0, 5) ?? [];
                
                const confidenceSignal = prediction
                  ? getConfidenceSignal(prediction.ai_insights_context)
                  : null;
                const urgencySignal = getUrgencySignal({
                  startTime: tournament.start_time,
                  eventDate: tournament.meeting_date,
                });

                return (
                  <div key={tournament.tournament_id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div 
                      onClick={() => setExpandedTournament(isExpanded ? null : tournament.tournament_id)}
                      style={{ 
                        padding: "1.25rem", 
                        cursor: "pointer", 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center",
                        background: "rgba(255, 255, 255, 0.02)"
                      }}
                    >
                      <div>
                        <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                          ⛳ {tournament.name}
                        </h4>
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                          {tournament.venue && <span className="context-chip">📍 {tournament.venue}</span>}
                          {confidenceSignal && <ConfidenceBadge signal={confidenceSignal} />}
                          {urgencySignal && <UrgencyBadge signal={urgencySignal} />}
                        </div>
                      </div>
                      <div>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: "1.25rem", borderTop: "1px solid var(--border-primary)" }}>
                        <div className="table-responsive">
                          <table className="table" style={{ width: "100%" }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: "left" }}>Player</th>
                                <th style={{ textAlign: "right" }}>Win Prob</th>
                                <th style={{ textAlign: "right" }}>Fair Odds</th>
                                <th style={{ textAlign: "right" }}>Betfair Odds</th>
                                <th style={{ textAlign: "right" }}>Edge</th>
                                <th style={{ textAlign: "center" }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {topPicks.map((pick) => {
                                const player = tournament.players.find(
                                  (candidate) => candidate.player_id === pick.player_id,
                                );
                                const marketPrice = pick.market_odds ?? player?.betfair_back_price;
                                const edge = getEdgePercent(pick.fair_odds, marketPrice);

                                return (
                                  <tr key={pick.player_id}>
                                    <td style={{ fontWeight: 600 }}>{pick.name}</td>
                                    <td style={{ textAlign: "right", color: "var(--yellow)" }}>
                                      {pick.win_probability.toFixed(1)}%
                                    </td>
                                    <td style={{ textAlign: "right" }}>${pick.fair_odds.toFixed(2)}</td>
                                    <td style={{ textAlign: "right" }}>
                                      {marketPrice ? `$${marketPrice.toFixed(2)}` : "—"}
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                      {edge && edge > 0 ? (
                                        <span className="value-badge positive">+{edge.toFixed(0)}%</span>
                                      ) : "—"}
                                    </td>
                                    <td style={{ textAlign: "center" }}>
                                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                                        <button
                                          type="button"
                                          className="why-pick-button btn btn-xs"
                                          onClick={() => {
                                            setActiveExplanation(
                                              buildBobExplanation({
                                                sport: "golf",
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
                                          Why?
                                        </button>
                                        <PaperBetAction
                                          bet={{
                                            sport: "golf",
                                            event_id: tournament.tournament_id,
                                            event_name: tournament.name,
                                            selection: pick.name,
                                            odds: marketPrice ?? pick.fair_odds,
                                            bet_type: "win",
                                            stake: 10,
                                            odds_source: marketPrice ? "market" : "model_fair",
                                            current_odds: marketPrice ?? pick.fair_odds,
                                            can_compare_odds: Boolean(marketPrice && marketPrice > 1),
                                            event_start_time: tournament.start_time,
                                          }}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ErrorBoundary>
        </>
      )}

      <div className="disclaimer">
        ⚠️ <strong>Disclaimer:</strong> Golf predictions are generated by machine
        learning models considering player rankings, historical course performance, and weather conditions. They are not guarantees.
      </div>
    </div>
  );
}
