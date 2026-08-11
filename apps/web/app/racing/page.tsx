"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  CircleDot,
  Flag,
} from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";
import ErrorState from "../components/ErrorState";
import ExplainDrawer from "../components/ExplainDrawer";
import {
  ConfidenceBadge,
  UrgencyBadge,
} from "../components/PredictionSignalBadges";
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
import { isPhase2MainRace } from "../lib/racingMainRaces";
import { useAuth } from "../providers/AuthProvider";
import PaperBetAction from "../components/PaperBetAction";
import FeedbackButtons from "../components/FeedbackButtons";
import TemporalHeader from "../components/racing/TemporalHeader";
import RaceCodeFilter from "../components/racing/RaceCodeFilter";
import VenueCard from "../components/racing/VenueCard";
import MeetingOverview from "../components/racing/MeetingOverview";
import SingleRaceCard from "../components/racing/SingleRaceCard";

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
  data_source?: "betfair" | "racing_australia";
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
  data_source?: "betfair" | "racing_australia";
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

function getRacingCacheKeys(type: string = "T", tab: string = "today") {
  const dateKey = getDateForTab(tab);

  return {
    fixturesKey: getMlDataCacheKey("fixtures", "racing", `${type}:${dateKey}`),
    predictionsKey: getMlDataCacheKey("predictions", "racing", `${type}:${dateKey}`),
  };
}

function isRacePredictionEntry(
  entry: RacePredictionEntry | null,
): entry is RacePredictionEntry {
  return entry !== null;
}

function getLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateForTab(tab: string): string {
  const today = new Date();
  if (tab === "tomorrow") {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return getLocalDateString(d);
  }
  if (tab === "next" || tab === "today") {
    return getLocalDateString(today);
  }

  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const targetDay = dayNames.indexOf(tab.toLowerCase());
  if (targetDay !== -1) {
    const currentDay = today.getDay();
    let daysAhead = targetDay - currentDay;
    if (daysAhead <= 0) {
      daysAhead += 7;
    }
    const d = new Date(today);
    d.setDate(d.getDate() + daysAhead);
    return getLocalDateString(d);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(tab)) {
    return tab;
  }

  return getLocalDateString(today);
}

async function fetchTodayRaces(raceType: string = "T", targetDateStr?: string) {
  const typeParam = raceType ? `type=${raceType}` : "";
  const dateParam = targetDateStr ? `date=${targetDateStr}` : "";
  const params = [typeParam, dateParam].filter(Boolean).join("&");
  const queryString = params ? `?${params}` : "";

  let response = await fetchWithTimeout(`${ML_API}/api/races/today${queryString}`, {
    cache: "no-store",
    timeoutMs: 15000,
  }).catch(() => null);

  let data = response && response.ok ? await safeResponseJson(response) : null;
  let races = (data?.races ?? []) as Race[];

  if (races.length === 0 && (!targetDateStr || targetDateStr === new Date().toISOString().split("T")[0])) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fallbackDateStr = tomorrow.toISOString().split("T")[0];
    const sep = queryString ? "&" : "?";
    response = await fetchWithTimeout(`${ML_API}/api/races/today${queryString}${sep}date=${fallbackDateStr}`, {
      cache: "no-store",
      timeoutMs: 15000,
    }).catch(() => null);
    if (response && response.ok) {
      data = await safeResponseJson(response);
      races = (data?.races ?? []) as Race[];
    }
  }

  return races;
}

async function fetchRacePredictions(races: Race[]) {
  const entries = await Promise.all(
    races.map(async (race) => {
      try {
        const response = await fetchWithTimeout(`${ML_API}/api/predict/racing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(race),
        });

        if (!response.ok) {
          return null;
        }

        const predData = await safeResponseJson(response);
        if (!predData) return null;
        return [race.race_id, predData] as const;
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

function RacingPageContent() {
  const { token, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const raceType = searchParams.get("type") || "T";
  const whenParam = searchParams.get("when") || "today";
  const raceTypeLabel = raceType === "G" ? "Greyhound" : raceType === "H" ? "Harness" : "Thoroughbred";
  const [races, setRaces] = useState<Race[]>([]);
  const [predictions, setPredictions] = useState<Record<string, RacePrediction>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [expandedPredictionRace, setExpandedPredictionRace] = useState<string | null>(
    null,
  );
  const initialRace = searchParams.get("race") || null;
  const [expandedRaceListing, setExpandedRaceListing] = useState<string | null>(initialRace);
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("aunz");
  const [selectedVenueName, setSelectedVenueName] = useState<string | null>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
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

  const updateQueryParams = (newType: string, newWhen: string) => {
    setSelectedVenueName(null);
    setSelectedRaceId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", newType);
    params.set("when", newWhen);
    router.push(`/racing?${params.toString()}`);
  };

  const openWatchPanel = (horseName: string) => {
    setWatchPanel(horseName);
    setWatchSaved(null);
  };

  const syncCacheMetadata = (type = raceType, tab = whenParam) => {
    const { fixturesKey, predictionsKey } = getRacingCacheKeys(type, tab);
    const metadata = getMlDataCacheMetadata([fixturesKey, predictionsKey]);

    if (!isMountedRef.current) {
      return;
    }

    setLastUpdated(metadata.lastUpdated);
    setNextRefreshAt(metadata.nextRefreshAt);
  };

  const hydrateFromCache = (type = raceType, tab = whenParam) => {
    const { fixturesKey, predictionsKey } = getRacingCacheKeys(type, tab);
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

    syncCacheMetadata(type, tab);

    return {
      cachedRaces,
      cachedPredictions,
    };
  };

  const refreshPage = async (type = raceType, tab = whenParam) => {
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

    const { fixturesKey, predictionsKey } = getRacingCacheKeys(type, tab);

    const targetDateStr = getDateForTab(tab);
    const fixturesEntry = await refreshMlDataCache(fixturesKey, () => fetchTodayRaces(type, targetDateStr), {
      force: true,
    }).catch((error) => {
      const isAbort = error?.name === "AbortError" || error?.message?.includes("aborted");
      if (!isAbort) {
        refreshHadFailure = true;
        usedCacheFallback = true;
        console.error("Failed to refresh racing fixtures:", error);
        scheduleMlDataCacheRetry(fixturesKey);
      }
      return readMlDataCache<Race[]>(fixturesKey);
    });

    if (fixturesEntry && isMountedRef.current) {
      setRaces(fixturesEntry.data);
      setLoading(false);
    }

    if (fixturesEntry && fixturesEntry.data && fixturesEntry.data.length > 0) {
      const predictionsEntry = await refreshMlDataCache(
        predictionsKey,
        () => fetchRacePredictions(fixturesEntry.data),
        { force: true },
      ).catch((error) => {
        const isAbort = error?.name === "AbortError" || error?.message?.includes("aborted");
        if (!isAbort) {
          refreshHadFailure = true;
          usedCacheFallback = true;
          console.error("Failed to refresh racing predictions:", error);
          scheduleMlDataCacheRetry(predictionsKey);
        }
        return readMlDataCache<Record<string, RacePrediction>>(predictionsKey);
      });

      if (predictionsEntry && isMountedRef.current) {
        setPredictions(predictionsEntry.data);
      }
    }

    syncCacheMetadata(type, tab);
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
    if (!user || user.id === "guest" || !token) return;
    setWatchSaving(true);
    try {
      await fetch(`${ML_API}/blackbook/${encodeURIComponent(horseName)}/auto-bet`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
    isMountedRef.current = true;
    setLoading(true);
    const { cachedRaces, cachedPredictions } = hydrateFromCache(raceType, whenParam);

    if (cachedRaces && cachedRaces.data.length > 0) {
      setLoading(false);
    }

    const shouldRefresh =
      !cachedRaces ||
      !cachedPredictions ||
      cachedRaces.data.length === 0 ||
      isMlDataCacheStale(cachedRaces) ||
      isMlDataCacheStale(cachedPredictions);

    if (shouldRefresh) {
      void refreshPage(raceType, whenParam);
    }

    return () => {
      isMountedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceType, whenParam]);

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
  const mainRacePredictions = filteredRaces.filter(
    (race) => predictions[race.race_id] && isPhase2MainRace(race),
  );
  const racingOpportunities = rankOpportunities(
    mainRacePredictions.flatMap((race) => {
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


  // Group races by venue
  const venueGroups = filteredRaces.reduce<Record<string, Race[]>>((acc, race) => {
    if (!acc[race.venue]) acc[race.venue] = [];
    acc[race.venue].push(race);
    return acc;
  }, {});

  // Region filtering
  const regionFilteredVenues = Object.entries(venueGroups).filter(([, venueRaces]) => {
    if (regionFilter === "all") return true;
    const region = venueRaces[0]?.meeting_region?.toLowerCase() ?? "";
    if (regionFilter === "aunz") return ["nsw", "vic", "qld", "sa", "wa", "tas", "act", "nt", "nz", "aus", "australia", "new zealand"].some((r) => region.includes(r)) || region === "" || region === "unknown";
    if (regionFilter === "intl") return !["nsw", "vic", "qld", "sa", "wa", "tas", "act", "nt", "nz", "aus", "australia", "new zealand", "", "unknown"].some((r) => region.includes(r));
    return true;
  });

  // Selected venue races
  const selectedVenueRaces = selectedVenueName ? (venueGroups[selectedVenueName] ?? []) : [];
  const selectedRace = selectedRaceId ? filteredRaces.find((r) => r.race_id === selectedRaceId) : null;

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



      {/* Temporal header */}
      <TemporalHeader
        activeTab={whenParam}
        onTabChange={(tab) => updateQueryParams(raceType, tab)}
      />

      {/* Race code + region filters */}
      <RaceCodeFilter
        activeType={raceType}
        activeRegion={regionFilter}
        onTypeChange={(type) => updateQueryParams(type, whenParam)}
        onRegionChange={(region) => {
          setRegionFilter(region);
          setSelectedVenueName(null);
          setSelectedRaceId(null);
        }}
      />

      {!hasRacingData && !refreshing ? (
        <ErrorState
          title="No races scheduled"
          message="Live Betfair feeds returned no meetings for today or tomorrow. Try refreshing once meetings are published."
          tone="info"
          actionLabel="Refresh now"
          onAction={() => void refreshPage()}
        />
      ) : !hasRacingData && refreshFailed ? (
        <ErrorState
          title="Racing snapshot unavailable"
          message="BetMate could not load the current race board. Try again shortly while cached data warms back up."
          tone="danger"
          actionLabel="Refresh now"
          onAction={() => void refreshPage()}
        />
      ) : selectedRace ? (
        /* --- Single Race Card View --- */
        <ErrorBoundary sectionName="Single race card">
          <button
            type="button"
            className="meeting-back-btn"
            style={{ marginBottom: "0.75rem" }}
            onClick={() => setSelectedRaceId(null)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              ← Back to {selectedVenueName ?? "venue"}
            </span>
          </button>
          <SingleRaceCard
            race={selectedRace}
            prediction={predictions[selectedRace.race_id] ?? null}
            siblingRaces={selectedVenueRaces.map((r) => ({ race_id: r.race_id, race_number: r.race_number }))}
            onSwitchRace={(id) => setSelectedRaceId(id)}
            onExplain={setActiveExplanation}
          />
        </ErrorBoundary>
      ) : selectedVenueName ? (
        /* --- Meeting Overview --- */
        <ErrorBoundary sectionName="Meeting overview">
          <MeetingOverview
            venue={selectedVenueName}
            races={selectedVenueRaces}
            onBack={() => setSelectedVenueName(null)}
            onSelectRace={(id) => setSelectedRaceId(id)}
            selectedRaceId={selectedRaceId}
          />
        </ErrorBoundary>
      ) : (
        /* --- Venue Cards Landing --- */
        <ErrorBoundary sectionName="Racing venue list">
          {regionFilteredVenues.length === 0 ? (
            <div className="card" style={{ marginTop: "1rem" }}>
              <p className="muted-copy">No venues found for the selected filters.</p>
            </div>
          ) : (
            <div className="venue-card-grid">
              {regionFilteredVenues.map(([venue, venueRaces]) => {
                const nextJump = venueRaces
                  .filter((r) => r.start_time)
                  .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime())[0];
                return (
                  <VenueCard
                    key={venue}
                    venue={venue}
                    raceCount={venueRaces.length}
                    nextRaceTime={nextJump?.start_time}
                    meetingType={venueRaces[0]?.meeting_type}
                    region={venueRaces[0]?.meeting_region}
                    onClick={() => setSelectedVenueName(venue)}
                  />
                );
              })}
            </div>
          )}
        </ErrorBoundary>
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

export default function RacingPage() {
  return (
    <Suspense
      fallback={
        <div className="dashboard-loading">
          <div className="loading-pulse">
            <Trophy size={48} />
            <p>Loading racing snapshot...</p>
          </div>
        </div>
      }
    >
      <RacingPageContent />
    </Suspense>
  );
}
