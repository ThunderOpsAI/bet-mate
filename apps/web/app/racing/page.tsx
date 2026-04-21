"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BobExplanation,
  FeatureImpactItem,
  ModelMetadata,
} from "../lib/bob/explainer";
import {
  Trophy,
  MapPin,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Bell,
  BellOff,
} from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";
import ErrorState from "../components/ErrorState";
import ExplainDrawer from "../components/ExplainDrawer";
import {
  ConfidenceBadge,
  UrgencyBadge,
} from "../components/PredictionSignalBadges";
import BestRacingOpportunities from "../components/racing/BestOpportunities";
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
import { useAuth } from "../providers/AuthProvider";
import PaperBetAction from "../components/PaperBetAction";
import FeedbackButtons from "../components/FeedbackButtons";

type BlackbookConfig = {
  probability_threshold: number;
  stake: number;
  notify_phone: string;
  notify_email: string;
  notify_pushover_key: string;
};

type HorseData = {
  horse_id: string;
  name: string;
  barrier: number;
  weight: number;
  past_win_rate: number;
  jockey_win_rate: number;
  track_condition: number;
  days_since_last_race: number;
  betfair_back_price?: number;
  betfair_implied_prob?: number;
  jockey_name?: string | null;
  data_source?: "betfair" | "racing_australia" | "mock";
};

type Race = {
  race_id: string;
  venue: string;
  race_number: number;
  distance: number;
  start_time?: string;
  meeting_type?: "metro" | "provincial" | "country" | "unknown";
  meeting_region?: string;
  meeting_date?: string;
  data_source?: "betfair" | "racing_australia" | "mock";
  horses: HorseData[];
};

type Prediction = {
  horse_id: string;
  name: string;
  win_probability: number;
  fair_odds: number;
};

type RacePrediction = {
  race_id: string;
  predictions: Prediction[];
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

const trackConditions: Record<number, string> = {
  1: "Fast",
  2: "Good",
  3: "Soft",
  4: "Heavy",
};

function getRacingCacheKeys() {
  const dateKey = getMlCacheDateKey();

  return {
    fixturesKey: getMlDataCacheKey("fixtures", "racing", dateKey),
    predictionsKey: getMlDataCacheKey("predictions", "racing", dateKey),
  };
}

function isRacePredictionEntry(
  entry: RacePredictionEntry | null,
): entry is RacePredictionEntry {
  return entry !== null;
}

async function fetchTodayRaces() {
  const response = await fetch(`${ML_API}/api/races/today`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Racing fixtures request failed with ${response.status}`);
  }

  const data = await response.json();
  return (data?.races ?? []) as Race[];
}

async function fetchRacePredictions(races: Race[]) {
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

export default function RacingPage() {
  const { user } = useAuth();
  const [races, setRaces] = useState<Race[]>([]);
  const [predictions, setPredictions] = useState<Record<string, RacePrediction>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [expandedRace, setExpandedRace] = useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [watchPanel, setWatchPanel] = useState<string | null>(null);
  const [watchConfig, setWatchConfig] = useState<BlackbookConfig>({
    probability_threshold: 50,
    stake: 20,
    notify_phone: "",
    notify_email: "",
    notify_pushover_key: "",
  });
  const [watchSaving, setWatchSaving] = useState(false);
  const [watchSaved, setWatchSaved] = useState<string | null>(null);
  const [activeExplanation, setActiveExplanation] = useState<BobExplanation | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const refreshingRef = useRef(false);

  const openWatchPanel = (horseName: string) => {
    setWatchPanel(horseName);
    setWatchSaved(null);
  };

  const syncCacheMetadata = () => {
    const { fixturesKey, predictionsKey } = getRacingCacheKeys();
    const metadata = getMlDataCacheMetadata([fixturesKey, predictionsKey]);

    if (!isMountedRef.current) {
      return;
    }

    setLastUpdated(metadata.lastUpdated);
    setNextRefreshAt(metadata.nextRefreshAt);
  };

  const hydrateFromCache = () => {
    const { fixturesKey, predictionsKey } = getRacingCacheKeys();
    const cachedRaces = readMlDataCache<Race[]>(fixturesKey);
    const cachedPredictions = readMlDataCache<Record<string, RacePrediction>>(
      predictionsKey,
    );

    if (cachedRaces && isMountedRef.current) {
      setRaces(cachedRaces.data);
    }

    if (cachedPredictions && isMountedRef.current) {
      setPredictions(cachedPredictions.data);
    }

    syncCacheMetadata();

    return {
      cachedRaces,
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

    const { fixturesKey, predictionsKey } = getRacingCacheKeys();

    const fixturesEntry = await refreshMlDataCache(fixturesKey, fetchTodayRaces, {
      force: true,
    }).catch((error) => {
      refreshHadFailure = true;
      usedCacheFallback = true;
      console.error("Failed to refresh racing fixtures:", error);
      scheduleMlDataCacheRetry(fixturesKey);
      return readMlDataCache<Race[]>(fixturesKey);
    });

    if (fixturesEntry && isMountedRef.current) {
      setRaces(fixturesEntry.data);
      setLoading(false);
    }

    if (fixturesEntry) {
      const predictionsEntry = await refreshMlDataCache(
        predictionsKey,
        () => fetchRacePredictions(fixturesEntry.data),
        { force: true },
      ).catch((error) => {
        refreshHadFailure = true;
        usedCacheFallback = true;
        console.error("Failed to refresh racing predictions:", error);
        scheduleMlDataCacheRetry(predictionsKey);
        return readMlDataCache<Record<string, RacePrediction>>(predictionsKey);
      });

      if (predictionsEntry && isMountedRef.current) {
        setPredictions(predictionsEntry.data);
      }
    }

    syncCacheMetadata();
    refreshingRef.current = false;
    trackRefreshOutcome("/racing", refreshStartedAt, {
      failed: refreshHadFailure,
      usedCache: usedCacheFallback,
    });

    if (isMountedRef.current) {
      setRefreshFailed(refreshHadFailure);
      setRefreshing(false);
      setLoading(false);
    }
  };

  const saveWatchConfig = async (horseName: string) => {
    if (!user) return;
    setWatchSaving(true);
    try {
      await fetch(`${ML_API}/blackbook/${encodeURIComponent(horseName)}/auto-bet`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.id}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          sport: "racing",
          bet_type: "win",
          stake: watchConfig.stake,
          enabled: true,
          probability_threshold: watchConfig.probability_threshold,
          notify_phone: watchConfig.notify_phone || null,
          notify_email: watchConfig.notify_email || null,
          notify_pushover_key: watchConfig.notify_pushover_key || null,
        }),
      });
      setWatchSaved(horseName);
      setTimeout(() => setWatchPanel(null), 1200);
    } catch (e) {
      console.error("Failed to save watch config", e);
    } finally {
      setWatchSaving(false);
    }
  };

  useEffect(() => {
    const { cachedRaces, cachedPredictions } = hydrateFromCache();

    if (cachedRaces) {
      setLoading(false);
    }

    const shouldRefresh =
      !cachedRaces ||
      !cachedPredictions ||
      isMlDataCacheStale(cachedRaces) ||
      isMlDataCacheStale(cachedPredictions);

    if (shouldRefresh) {
      void refreshPage();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    trackStaleCache("/racing", lastUpdated);
  }, [lastUpdated]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <Trophy size={48} />
          <p>Loading racing snapshot...</p>
        </div>
      </div>
    );
  }

  const venues = Array.from(new Set(races.map((race) => race.venue)));
  const filteredRaces =
    selectedVenue === "all"
      ? races
      : races.filter((race) => race.venue === selectedVenue);
  const racingOpportunities = rankOpportunities(
    filteredRaces.flatMap((race) => {
      const prediction = predictions[race.race_id];
      if (!prediction) {
        return [];
      }

      const confidenceSignal = getConfidenceSignal(prediction.ai_insights_context);
      const urgencySignal = getUrgencySignal({
        startTime: race.start_time,
        eventDate: race.meeting_date,
      });

      return prediction.predictions.map((pick) => {
        const horse = race.horses.find(
          (candidate) => candidate.horse_id === pick.horse_id,
        );

        return {
          id: `${race.race_id}-${pick.horse_id}`,
          sport: "racing" as const,
          selectionName: pick.name,
          eventLabel: `${race.venue} R${race.race_number}`,
          probability: pick.win_probability,
          fairOdds: pick.fair_odds,
          marketOdds: horse?.betfair_back_price ?? null,
          confidenceSignal,
          urgencySignal,
          href: "/racing",
        };
      });
    }),
  ).slice(0, 5);
  const hasRacingData = races.length > 0 || Object.keys(predictions).length > 0;
  const racingStatus = getCachedViewStatus({
    resourceLabel: "Racing data",
    hasData: hasRacingData,
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

      {racingStatus ? (
        <div className="status-stack">
          <ErrorState
            title={racingStatus.title}
            message={racingStatus.message}
            tone={racingStatus.tone}
            actionLabel="Refresh now"
            onAction={() => void refreshPage()}
            compact
          />
        </div>
      ) : null}

      {!hasRacingData && refreshFailed ? (
        <ErrorState
          title="Racing snapshot unavailable"
          message="BetMate could not load the current race board. Try again shortly while cached data warms back up."
          tone="danger"
          actionLabel="Refresh now"
          onAction={() => void refreshPage()}
        />
      ) : (
        <>

      <div className="filter-bar">
        <button
          className={`filter-chip ${selectedVenue === "all" ? "active" : ""}`}
          onClick={() => setSelectedVenue("all")}
        >
          All Venues
        </button>
        {venues.map((venue) => (
          <button
            key={venue}
            className={`filter-chip ${selectedVenue === venue ? "active" : ""}`}
            onClick={() => setSelectedVenue(venue)}
          >
            <MapPin size={12} /> {venue}
          </button>
        ))}
      </div>

      <ErrorBoundary sectionName="Racing opportunities">
        <BestRacingOpportunities opportunities={racingOpportunities} />
      </ErrorBoundary>

      <ErrorBoundary sectionName="Racing predictions">
        <div className="race-list">
          {filteredRaces.map((race) => {
          const prediction = predictions[race.race_id];
          const top3 = prediction?.predictions?.slice(0, 3) ?? [];
          const isExpanded = expandedRace === race.race_id;
          const confidenceSignal = prediction
            ? getConfidenceSignal(prediction.ai_insights_context)
            : null;
          const urgencySignal = getUrgencySignal({
            startTime: race.start_time,
            eventDate: race.meeting_date,
          });

          return (
            <div
              key={race.race_id}
              className={`race-detail-card ${isExpanded ? "expanded" : ""}`}
            >
              <div
                className="race-detail-header"
                onClick={() => setExpandedRace(isExpanded ? null : race.race_id)}
              >
                <div className="race-detail-title">
                  <span className="race-venue-badge">{race.venue}</span>
                  <span className="race-number-lg">R{race.race_number}</span>
                  <span className="badge badge-accent">{race.distance}m</span>
                  <span className="badge badge-muted">
                    {race.horses.length} runners
                  </span>
                  <span className="badge badge-blue">
                    {trackConditions[race.horses[0]?.track_condition] ?? "Good"}
                  </span>
                  {race.meeting_type && race.meeting_type !== "unknown" ? (
                    <span className="badge badge-green">
                      {race.meeting_type.toUpperCase()}
                    </span>
                  ) : null}
                  {race.meeting_region && race.meeting_region !== "unknown" ? (
                    <span className="badge badge-muted">{race.meeting_region}</span>
                  ) : null}
                  {race.meeting_date ? (
                    <span className="badge badge-muted">{race.meeting_date}</span>
                  ) : null}
                  {confidenceSignal ? <ConfidenceBadge signal={confidenceSignal} /> : null}
                  {urgencySignal ? <UrgencyBadge signal={urgencySignal} /> : null}
                </div>
                <div className="race-detail-preview">
                  {top3.map((pick, index) => (
                    <span
                      key={pick.horse_id}
                      className={`preview-pick rank-${index + 1}-text`}
                    >
                      {index + 1}. {pick.name} ({pick.win_probability}%)
                    </span>
                  ))}
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {isExpanded && prediction ? (
                <div className="race-detail-body">
                  <div className="field-table-wrap">
                    <table className="field-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Horse</th>
                          <th>Jockey</th>
                          <th>Barrier</th>
                          <th>Weight</th>
                          <th>Form</th>
                          <th>Jockey Win%</th>
                          <th>Market</th>
                          <th>Win Prob</th>
                          <th>Fair Odds</th>
                          <th>Paper Bet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prediction.predictions.map((pick, index) => {
                          const horse = race.horses.find(
                            (candidate) => candidate.horse_id === pick.horse_id,
                          );
                          const edgePercent = getEdgePercent(
                            pick.fair_odds,
                            horse?.betfair_back_price,
                          );

                          return (
                            <tr
                              key={pick.horse_id}
                              className={
                                index < 3 ? `top-pick-row rank-${index + 1}-row` : ""
                              }
                            >
                              <td>
                                <span
                                  className={`pick-rank rank-${Math.min(index + 1, 4)}`}
                                >
                                  {index + 1}
                                </span>
                              </td>
                              <td className="horse-name-cell">{pick.name}</td>
                              <td>{horse?.jockey_name ?? "TBA"}</td>
                              <td>{horse?.barrier ?? "-"}</td>
                              <td>{horse?.weight ?? "-"}kg</td>
                              <td>{((horse?.past_win_rate ?? 0) * 100).toFixed(1)}%</td>
                              <td>
                                {((horse?.jockey_win_rate ?? 0) * 100).toFixed(1)}%
                              </td>
                              <td>{formatMarketPrice(horse)}</td>
                              <td>
                                <span
                                  className={`prob-badge ${
                                    index === 0 ? "prob-top" : ""
                                  }`}
                                >
                                  {pick.win_probability}%
                                </span>
                              </td>
                              <td className="fair-odds">
                                ${pick.fair_odds}
                                {edgePercent ? (
                                  <span className="value-badge positive">
                                    Edge +{edgePercent.toFixed(0)}%
                                  </span>
                                ) : null}
                              </td>
                              <td>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "6px",
                                    alignItems: "center",
                                  }}
                                >
                                  <PaperBetAction
                                    bet={{
                                      sport: "racing",
                                      event_id: race.race_id,
                                      event_name: `${race.venue} R${race.race_number}`,
                                      selection_id: pick.horse_id,
                                      selection: pick.name,
                                      odds: horse?.betfair_back_price ?? pick.fair_odds,
                                      bet_type: "win",
                                      stake: 10,
                                      odds_source: horse?.betfair_back_price
                                        ? "market"
                                        : "model_fair",
                                      current_odds:
                                        horse?.betfair_back_price ?? pick.fair_odds,
                                      can_compare_odds: Boolean(
                                        horse?.betfair_back_price &&
                                          horse.betfair_back_price > 1,
                                      ),
                                      event_start_time: race.start_time,
                                      event_date: race.meeting_date,
                                    }}
                                  />
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
                                          marketOdds: horse?.betfair_back_price,
                                          featureImpact: prediction.feature_impact,
                                          aiInsightsContext:
                                            prediction.ai_insights_context,
                                          modelMetadata: prediction.model_metadata,
                                        }),
                                      )
                                    }}
                                  >
                                    Why this pick?
                                  </button>
                                  <div onClick={(event) => event.stopPropagation()} style={{ marginLeft: '0.5rem' }}>
                                    <FeedbackButtons 
                                      sport="racing" 
                                      eventId={race.race_id} 
                                      selection={pick.name}
                                    />
                                  </div>
                                  {user && user.id !== "guest" ? (
                                    <button
                                      className="btn btn-sm btn-outline"
                                      title="Watch this horse"
                                      onClick={() =>
                                        watchPanel === pick.name
                                          ? setWatchPanel(null)
                                          : openWatchPanel(pick.name)
                                      }
                                      style={{ padding: "4px 8px" }}
                                    >
                                      {watchSaved === pick.name ? (
                                        <Bell size={14} />
                                      ) : (
                                        <BellOff size={14} />
                                      )}
                                    </button>
                                  ) : null}
                                </div>
                                {watchPanel === pick.name ? (
                                  <div
                                    style={{
                                      marginTop: "8px",
                                      padding: "12px",
                                      background: "var(--surface, #1a1a2e)",
                                      border: "1px solid var(--border, #333)",
                                      borderRadius: "8px",
                                      minWidth: "240px",
                                      fontSize: "13px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        marginBottom: "8px",
                                      }}
                                    >
                                      Save watch rule: {pick.name}
                                    </div>
                                    <label
                                      style={{
                                        display: "block",
                                        marginBottom: "6px",
                                      }}
                                    >
                                      Trigger when model win chance reaches{" "}
                                      <strong>
                                        {watchConfig.probability_threshold}%
                                      </strong>
                                      <input
                                        type="range"
                                        min={1}
                                        max={99}
                                        step={1}
                                        value={watchConfig.probability_threshold}
                                        onChange={(event) =>
                                          setWatchConfig((current) => ({
                                            ...current,
                                            probability_threshold: Number(
                                              event.target.value,
                                            ),
                                          }))
                                        }
                                        style={{
                                          width: "100%",
                                          marginTop: "4px",
                                        }}
                                      />
                                    </label>
                                    <label
                                      style={{
                                        display: "block",
                                        marginBottom: "6px",
                                      }}
                                    >
                                      Paper bet stake $
                                      <input
                                        type="number"
                                        min={1}
                                        max={10000}
                                        step={1}
                                        value={watchConfig.stake}
                                        onChange={(event) =>
                                          setWatchConfig((current) => ({
                                            ...current,
                                            stake: Number(event.target.value),
                                          }))
                                        }
                                        style={{
                                          width: "100%",
                                          marginTop: "2px",
                                        }}
                                      />
                                    </label>
                                    <label
                                      style={{
                                        display: "block",
                                        marginBottom: "4px",
                                      }}
                                    >
                                      SMS (phone number)
                                      <input
                                        type="tel"
                                        placeholder="+61400000000"
                                        value={watchConfig.notify_phone}
                                        onChange={(event) =>
                                          setWatchConfig((current) => ({
                                            ...current,
                                            notify_phone: event.target.value,
                                          }))
                                        }
                                        style={{
                                          width: "100%",
                                          marginTop: "2px",
                                        }}
                                      />
                                    </label>
                                    <label
                                      style={{
                                        display: "block",
                                        marginBottom: "4px",
                                      }}
                                    >
                                      Email
                                      <input
                                        type="email"
                                        placeholder="you@email.com"
                                        value={watchConfig.notify_email}
                                        onChange={(event) =>
                                          setWatchConfig((current) => ({
                                            ...current,
                                            notify_email: event.target.value,
                                          }))
                                        }
                                        style={{
                                          width: "100%",
                                          marginTop: "2px",
                                        }}
                                      />
                                    </label>
                                    <label
                                      style={{
                                        display: "block",
                                        marginBottom: "8px",
                                      }}
                                    >
                                      Pushover key (phone push)
                                      <input
                                        type="text"
                                        placeholder="pushover user key"
                                        value={watchConfig.notify_pushover_key}
                                        onChange={(event) =>
                                          setWatchConfig((current) => ({
                                            ...current,
                                            notify_pushover_key:
                                              event.target.value,
                                          }))
                                        }
                                        style={{
                                          width: "100%",
                                          marginTop: "2px",
                                        }}
                                      />
                                    </label>
                                    <button
                                      className="btn btn-sm btn-primary"
                                      onClick={() => saveWatchConfig(pick.name)}
                                      disabled={watchSaving}
                                      style={{ width: "100%" }}
                                    >
                                      {watchSaved === pick.name
                                        ? "Saved ✓"
                                        : watchSaving
                                          ? "Saving..."
                                          : "Save watch rule"}
                                    </button>
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="feature-impact-section">
                    <h4>
                      <BarChart3 size={16} /> Bob explainability
                    </h4>
                    <p className="muted-copy">
                      Each runner now has a dedicated "Why this pick?" view so Bob can
                      explain the model edge, caution flags, and market context
                      without flooding the table with raw feature bars.
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
        ⚠️ <strong>Disclaimer:</strong> Predictions are generated by machine
        learning models trained on historical patterns. They are not guarantees.
        Please gamble responsibly.
      </div>
    </div>
  );
}

function formatMarketPrice(horse?: HorseData): string {
  if (!horse?.betfair_back_price || horse.betfair_back_price <= 1) {
    return "-";
  }

  return `$${horse.betfair_back_price.toFixed(2)}`;
}
