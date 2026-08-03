"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type {
  BobExplanation,
  FeatureImpactItem,
  ModelMetadata,
} from "./lib/bob/explainer";
import VariantA_CyberpunkTerminal from "./components/VariantA_CyberpunkTerminal";
import {
  Trophy,
  Zap,
  CircleDot,
  ChevronRight,
  Activity,
  Brain,
  Shield,
  Globe,
  Flag,
  Swords,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import Link from "next/link";
import BestAflOpportunities from "./components/afl/BestOpportunities";
import BestNbaOpportunities from "./components/nba/BestOpportunities";
import BestNrlOpportunities from "./components/nrl/BestOpportunities";
import BestSoccerOpportunities from "./components/soccer/BestOpportunities";
import BestGolfOpportunities from "./components/golf/BestOpportunities";
import BestMmaOpportunities from "./components/mma/BestOpportunities";
import ErrorBoundary from "./components/ErrorBoundary";
import ErrorState from "./components/ErrorState";
import ExplainDrawer from "./components/ExplainDrawer";
import {
  ConfidenceBadge,
  UrgencyBadge,
} from "./components/PredictionSignalBadges";
import BestRacingOpportunities from "./components/racing/BestOpportunities";
import RefreshControls from "./components/RefreshControls";
import PaperBetAction from "./components/PaperBetAction";
import { buildBobExplanation } from "./lib/bob/explainer";
import { ML_API } from "./lib/mlApi";
import { getEdgePercent, rankOpportunities } from "./lib/opportunityScore";
import { fetchWithTimeout } from "./lib/fetchWithTimeout";
import {
  getConfidenceSignal,
  getUrgencySignal,
} from "./lib/predictionSignals";
import {
  ML_DATA_CACHE_RETRY_MS,
  getMlCacheDateKey,
  getMlDataCacheKey,
  getMlDataCacheMetadata,
  isMlDataCacheStale,
  readMlDataCache,
  refreshMlDataCache,
  scheduleMlDataCacheRetry,
} from "./lib/cache/mlDataCache";
import {
  getCachedViewStatus,
  trackRefreshOutcome,
  trackStaleCache,
} from "./lib/monitoring/performance";
import { isPhase2MainRace } from "./lib/racingMainRaces";

type RaceSummary = {
  race_id: string;
  venue: string;
  race_number: number;
  distance: number;
  start_time?: string;
  meeting_type?: "metro" | "provincial" | "country" | "unknown";
  meeting_region?: string;
  meeting_date?: string;
  horses: Array<{
    horse_id: string;
    name: string;
    betfair_back_price?: number;
  }>;
};

type RacePrediction = {
  race_id: string;
  predictions: Array<{
    horse_id: string;
    name: string;
    win_probability: number;
    fair_odds: number;
  }>;
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

type AFLPrediction = {
  game_id: string;
  predictions: {
    home_team: string;
    away_team: string;
    home_win_probability: number;
    away_win_probability: number;
    fair_odds_home: number;
    fair_odds_away: number;
    market_odds_home?: number;
    market_odds_away?: number;
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

type NBAGame = {
  game_id: string;
  home_team: string;
  away_team: string;
  features: Record<string, number>;
  date?: string;
};

type NBAPrediction = {
  game_id: string;
  predictions: {
    home_team: string;
    away_team: string;
    home_win_probability: number;
    away_win_probability: number;
    fair_odds_home: number;
    fair_odds_away: number;
    market_odds_home?: number;
    market_odds_away?: number;
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

type NRLPrediction = {
  game_id: string;
  predictions: {
    home_team: string;
    away_team: string;
    home_win_probability: number;
    away_win_probability: number;
    fair_odds_home: number;
    fair_odds_away: number;
    market_odds_home?: number;
    market_odds_away?: number;
  };
  feature_impact?: FeatureImpactItem[] | Record<string, number>;
  ai_insights_context?: any;
  model_metadata?: ModelMetadata;
};

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
    market_odds_home?: number;
    market_odds_away?: number;
    market_odds_draw?: number;
  };
  feature_impact?: FeatureImpactItem[] | Record<string, number>;
  ai_insights_context?: any;
  model_metadata?: ModelMetadata;
};

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

type GolfPrediction = {
  tournament_id: string;
  predictions: Array<{
    player_id: string;
    name: string;
    win_probability: number;
    fair_odds: number;
    market_odds?: number;
  }>;
  feature_impact?: FeatureImpactItem[] | Record<string, number>;
  ai_insights_context?: any;
  model_metadata?: ModelMetadata;
};

type MMAMatchup = {
  game_id: string;
  home_team: string;
  away_team: string;
  features?: Record<string, number>;
  date?: string;
  weight_class?: string;
  venue?: string;
  complete?: number;
};

type MMAPrediction = {
  game_id: string;
  predictions: {
    home_team: string;
    away_team: string;
    home_win_probability: number;
    away_win_probability: number;
    fair_odds_home: number;
    fair_odds_away: number;
    market_odds_home?: number;
    market_odds_away?: number;
  };
  feature_impact?: FeatureImpactItem[] | Record<string, number>;
  ai_insights_context?: any;
  model_metadata?: ModelMetadata;
};

type RacePredictionEntry = readonly [string, RacePrediction];
type AFLPredictionEntry = readonly [string, AFLPrediction];
type NBAPredictionEntry = readonly [string, NBAPrediction];
type NRLPredictionEntry = readonly [string, NRLPrediction];
type SoccerPredictionEntry = readonly [string, SoccerPrediction];
type GolfPredictionEntry = readonly [string, GolfPrediction];
type MMAPredictionEntry = readonly [string, MMAPrediction];

function getDashboardCacheKeys() {
  const dateKey = getMlCacheDateKey();

  return {
    racingFixturesKey: getMlDataCacheKey("fixtures", "racing", dateKey),
    racingPredictionsKey: getMlDataCacheKey("predictions", "racing", dateKey),
    aflFixturesKey: getMlDataCacheKey("fixtures", "afl", dateKey),
    aflPredictionsKey: getMlDataCacheKey("predictions", "afl", dateKey),
    nbaFixturesKey: getMlDataCacheKey("fixtures", "nba", dateKey),
    nbaPredictionsKey: getMlDataCacheKey("predictions", "nba", dateKey),
    nrlFixturesKey: getMlDataCacheKey("fixtures", "nrl", dateKey),
    nrlPredictionsKey: getMlDataCacheKey("predictions", "nrl", dateKey),
    soccerFixturesKey: getMlDataCacheKey("fixtures", "soccer", dateKey),
    soccerPredictionsKey: getMlDataCacheKey("predictions", "soccer", dateKey),
    golfFixturesKey: getMlDataCacheKey("fixtures", "golf", dateKey),
    golfPredictionsKey: getMlDataCacheKey("predictions", "golf", dateKey),
    mmaFixturesKey: getMlDataCacheKey("fixtures", "mma", dateKey),
    mmaPredictionsKey: getMlDataCacheKey("predictions", "mma", dateKey),
  };
}

function isRacePredictionEntry(
  entry: RacePredictionEntry | null,
): entry is RacePredictionEntry {
  return entry !== null;
}

function isAflPredictionEntry(
  entry: AFLPredictionEntry | null,
): entry is AFLPredictionEntry {
  return entry !== null;
}

function isNbaPredictionEntry(
  entry: NBAPredictionEntry | null,
): entry is NBAPredictionEntry {
  return entry !== null;
}

function isNrlPredictionEntry(
  entry: NRLPredictionEntry | null,
): entry is NRLPredictionEntry {
  return entry !== null;
}

function isSoccerPredictionEntry(
  entry: SoccerPredictionEntry | null,
): entry is SoccerPredictionEntry {
  return entry !== null;
}

function isGolfPredictionEntry(
  entry: GolfPredictionEntry | null,
): entry is GolfPredictionEntry {
  return entry !== null;
}

function isMmaPredictionEntry(
  entry: MMAPredictionEntry | null,
): entry is MMAPredictionEntry {
  return entry !== null;
}

async function fetchEngineStatus() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/health`, {
      cache: "no-store",
    });
    return response.ok ? "online" : "offline";
  } catch {
    return "offline" as const;
  }
}

async function fetchTodayRaces() {
  try {
    let response = await fetchWithTimeout(`${ML_API}/api/races/today`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    let data = await response.json();
    let races = (data?.races ?? []) as RaceSummary[];
    
    if (races.length === 0) {
      // Fetch tomorrow's races if today has none
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split("T")[0];
      response = await fetchWithTimeout(`${ML_API}/api/races/today?date=${dateStr}`, {
        cache: "no-store",
      });
      if (response.ok) {
        data = await response.json();
        races = (data?.races ?? []) as RaceSummary[];
      }
    }
    return races;
  } catch (error) {
    return [];
  }
}

async function fetchUpcomingAflGames() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/api/afl/games/upcoming`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data?.games ?? []) as AFLGame[];
  } catch (error) {
    return [];
  }
}

async function fetchTodayNbaGames() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/api/nba/games/today`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data?.games ?? []) as NBAGame[];
  } catch (error) {
    return [];
  }
}

async function fetchUpcomingNrlGames() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/api/nrl/games/upcoming`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data?.games ?? []) as NRLGame[];
  } catch (error) {
    return [];
  }
}

async function fetchTodaySoccerGames() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/api/soccer/games/today`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data?.games ?? []) as SoccerGame[];
  } catch (error) {
    return [];
  }
}

async function fetchTodayGolfTournaments() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/api/golf/games/today`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data?.games ?? []) as GolfTournament[];
  } catch (error) {
    return [];
  }
}

async function fetchTodayMmaGames() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/api/mma/games/today`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data?.games ?? []) as MMAMatchup[];
  } catch (error) {
    return [];
  }
}

async function fetchRacePredictions(races: RaceSummary[]) {
  const entries = await Promise.all(
    races.map(async (race) => {
      try {
        const response = await fetchWithTimeout(`${ML_API}/api/predict/racing`, {
          method: "POST",
          cache: "no-store",
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

async function fetchAflPredictions(games: AFLGame[]) {
  const entries = await Promise.all(
    games.map(async (game) => {
      try {
        const response = await fetchWithTimeout(`${ML_API}/api/predict/afl`, {
          method: "POST",
          cache: "no-store",
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

async function fetchNbaPredictions(games: NBAGame[]) {
  const entries = await Promise.all(
    games.map(async (game) => {
      try {
        const response = await fetchWithTimeout(`${ML_API}/api/predict/nba`, {
          method: "POST",
          cache: "no-store",
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

  return Object.fromEntries(entries.filter(isNbaPredictionEntry)) as Record<
    string,
    NBAPrediction
  >;
}

async function fetchNrlPredictions(games: NRLGame[]) {
  if (!games || games.length === 0) return {};
  const entries = await Promise.all(
    games.map(async (game) => {
      try {
        const response = await fetchWithTimeout(`${ML_API}/api/predict/nrl`, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(game),
        });
        if (!response.ok) return null;
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

async function fetchSoccerPredictions(games: SoccerGame[]) {
  if (!games || games.length === 0) return {};
  const entries = await Promise.all(
    games.map(async (game) => {
      try {
        const response = await fetchWithTimeout(`${ML_API}/api/predict/soccer`, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(game),
        });
        if (!response.ok) return null;
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

async function fetchGolfPredictions(tournaments: GolfTournament[]) {
  if (!tournaments || tournaments.length === 0) return {};
  const entries = await Promise.all(
    tournaments.map(async (tournament) => {
      try {
        const response = await fetchWithTimeout(`${ML_API}/api/predict/golf`, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tournament),
        });
        if (!response.ok) return null;
        return [tournament.tournament_id, await response.json()] as const;
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

async function fetchMmaPredictions(games: MMAMatchup[]) {
  if (!games || games.length === 0) return {};
  const entries = await Promise.all(
    games.map(async (game) => {
      try {
        const response = await fetchWithTimeout(`${ML_API}/api/predict/mma`, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(game),
        });
        if (!response.ok) return null;
        return [game.game_id, await response.json()] as const;
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

function DashboardContent() {
  const router = useRouter();
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [aflGames, setAFLGames] = useState<AFLGame[]>([]);
  const [nbaGames, setNBAGames] = useState<NBAGame[]>([]);
  const [nrlGames, setNRLGames] = useState<NRLGame[]>([]);
  const [soccerGames, setSoccerGames] = useState<SoccerGame[]>([]);
  const [golfTournaments, setGolfTournaments] = useState<GolfTournament[]>([]);
  const [mmaMatchups, setMMAMatchups] = useState<MMAMatchup[]>([]);

  const [racePredictions, setRacePredictions] = useState<
    Record<string, RacePrediction>
  >({});
  const [aflPredictions, setAFLPredictions] = useState<
    Record<string, AFLPrediction>
  >({});
  const [nbaPredictions, setNBAPredictions] = useState<
    Record<string, NBAPrediction>
  >({});
  const [nrlPredictions, setNRLPredictions] = useState<
    Record<string, NRLPrediction>
  >({});
  const [soccerPredictions, setSoccerPredictions] = useState<
    Record<string, SoccerPrediction>
  >({});
  const [golfPredictions, setGolfPredictions] = useState<
    Record<string, GolfPrediction>
  >({});
  const [mmaPredictions, setMMAPredictions] = useState<
    Record<string, MMAPrediction>
  >({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [engineStatus, setEngineStatus] = useState<"online" | "offline">(
    "offline",
  );
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [activeExplanation, setActiveExplanation] = useState<BobExplanation | null>(
    null,
  );
  const [activeCategory, setActiveCategory] = useState<"racing" | "sports">("racing");
  const isMountedRef = useRef(true);
  const refreshingRef = useRef(false);

  const syncCacheMetadata = () => {
    const keys = getDashboardCacheKeys();
    const metadata = getMlDataCacheMetadata(Object.values(keys));

    if (!isMountedRef.current) {
      return;
    }

    setLastUpdated(metadata.lastUpdated);
    setNextRefreshAt(metadata.nextRefreshAt);
  };

  const hydrateFromCache = () => {
    const keys = getDashboardCacheKeys();
    const cachedRaces = readMlDataCache<RaceSummary[]>(keys.racingFixturesKey);
    const cachedRacePredictions = readMlDataCache<Record<string, RacePrediction>>(
      keys.racingPredictionsKey,
    );
    const cachedAflGames = readMlDataCache<AFLGame[]>(keys.aflFixturesKey);
    const cachedAflPredictions = readMlDataCache<Record<string, AFLPrediction>>(
      keys.aflPredictionsKey,
    );
    const cachedNbaGames = readMlDataCache<NBAGame[]>(keys.nbaFixturesKey);
    const cachedNbaPredictions = readMlDataCache<Record<string, NBAPrediction>>(
      keys.nbaPredictionsKey,
    );
    const cachedNrlGames = readMlDataCache<NRLGame[]>(keys.nrlFixturesKey);
    const cachedNrlPredictions = readMlDataCache<Record<string, NRLPrediction>>(
      keys.nrlPredictionsKey,
    );
    const cachedSoccerGames = readMlDataCache<SoccerGame[]>(keys.soccerFixturesKey);
    const cachedSoccerPredictions = readMlDataCache<Record<string, SoccerPrediction>>(
      keys.soccerPredictionsKey,
    );
    const cachedGolfTournaments = readMlDataCache<GolfTournament[]>(keys.golfFixturesKey);
    const cachedGolfPredictions = readMlDataCache<Record<string, GolfPrediction>>(
      keys.golfPredictionsKey,
    );
    const cachedMmaMatchups = readMlDataCache<MMAMatchup[]>(keys.mmaFixturesKey);
    const cachedMmaPredictions = readMlDataCache<Record<string, MMAPrediction>>(
      keys.mmaPredictionsKey,
    );

    if (cachedRaces && isMountedRef.current) {
      setRaces(cachedRaces.data);
    }

    if (cachedRacePredictions && isMountedRef.current) {
      setRacePredictions(cachedRacePredictions.data);
    }

    if (cachedAflGames && isMountedRef.current) {
      setAFLGames(cachedAflGames.data);
    }

    if (cachedAflPredictions && isMountedRef.current) {
      setAFLPredictions(cachedAflPredictions.data);
    }

    if (cachedNbaGames && isMountedRef.current) {
      setNBAGames(cachedNbaGames.data);
    }

    if (cachedNbaPredictions && isMountedRef.current) {
      setNBAPredictions(cachedNbaPredictions.data);
    }

    if (cachedNrlGames && isMountedRef.current) {
      setNRLGames(cachedNrlGames.data);
    }

    if (cachedNrlPredictions && isMountedRef.current) {
      setNRLPredictions(cachedNrlPredictions.data);
    }

    if (cachedSoccerGames && isMountedRef.current) {
      setSoccerGames(cachedSoccerGames.data);
    }

    if (cachedSoccerPredictions && isMountedRef.current) {
      setSoccerPredictions(cachedSoccerPredictions.data);
    }

    if (cachedGolfTournaments && isMountedRef.current) {
      setGolfTournaments(cachedGolfTournaments.data);
    }

    if (cachedGolfPredictions && isMountedRef.current) {
      setGolfPredictions(cachedGolfPredictions.data);
    }

    if (cachedMmaMatchups && isMountedRef.current) {
      setMMAMatchups(cachedMmaMatchups.data);
    }

    if (cachedMmaPredictions && isMountedRef.current) {
      setMMAPredictions(cachedMmaPredictions.data);
    }

    syncCacheMetadata();

    return {
      cachedRaces,
      cachedRacePredictions,
      cachedAflGames,
      cachedAflPredictions,
      cachedNbaGames,
      cachedNbaPredictions,
      cachedNrlGames,
      cachedNrlPredictions,
      cachedSoccerGames,
      cachedSoccerPredictions,
      cachedGolfTournaments,
      cachedGolfPredictions,
      cachedMmaMatchups,
      cachedMmaPredictions,
    };
  };

  const refreshEngineHealth = async () => {
    const status = await fetchEngineStatus();

    if (isMountedRef.current) {
      setEngineStatus(status);
    }
  };

  const refreshDashboard = async () => {
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

    const keys = getDashboardCacheKeys();
    const healthPromise = refreshEngineHealth();

    const [
      racingFixturesEntry,
      aflFixturesEntry,
      nbaFixturesEntry,
      nrlFixturesEntry,
      soccerFixturesEntry,
      golfFixturesEntry,
      mmaFixturesEntry,
    ] = await Promise.all([
      refreshMlDataCache(keys.racingFixturesKey, fetchTodayRaces, {
        force: true,
      }).catch((error) => {
        refreshHadFailure = true;
        console.error("Failed to refresh racing fixtures:", error);
        scheduleMlDataCacheRetry(keys.racingFixturesKey);
        return { data: [] as RaceSummary[], lastUpdated: Date.now(), nextRefreshAt: Date.now() + ML_DATA_CACHE_RETRY_MS, ttlMs: ML_DATA_CACHE_RETRY_MS };
      }),
      refreshMlDataCache(keys.aflFixturesKey, fetchUpcomingAflGames, {
        force: true,
      }).catch((error) => {
        refreshHadFailure = true;
        console.error("Failed to refresh AFL fixtures:", error);
        scheduleMlDataCacheRetry(keys.aflFixturesKey);
        return { data: [] as AFLGame[], lastUpdated: Date.now(), nextRefreshAt: Date.now() + ML_DATA_CACHE_RETRY_MS, ttlMs: ML_DATA_CACHE_RETRY_MS };
      }),
      refreshMlDataCache(keys.nbaFixturesKey, fetchTodayNbaGames, {
        force: true,
      }).catch((error) => {
        refreshHadFailure = true;
        console.error("Failed to refresh NBA fixtures:", error);
        scheduleMlDataCacheRetry(keys.nbaFixturesKey);
        return { data: [] as NBAGame[], lastUpdated: Date.now(), nextRefreshAt: Date.now() + ML_DATA_CACHE_RETRY_MS, ttlMs: ML_DATA_CACHE_RETRY_MS };
      }),
      refreshMlDataCache(keys.nrlFixturesKey, fetchUpcomingNrlGames, {
        force: true,
      }).catch((error) => {
        refreshHadFailure = true;
        console.error("Failed to refresh NRL fixtures:", error);
        scheduleMlDataCacheRetry(keys.nrlFixturesKey);
        return { data: [] as NRLGame[], lastUpdated: Date.now(), nextRefreshAt: Date.now() + ML_DATA_CACHE_RETRY_MS, ttlMs: ML_DATA_CACHE_RETRY_MS };
      }),
      refreshMlDataCache(keys.soccerFixturesKey, fetchTodaySoccerGames, {
        force: true,
      }).catch((error) => {
        refreshHadFailure = true;
        console.error("Failed to refresh Soccer fixtures:", error);
        scheduleMlDataCacheRetry(keys.soccerFixturesKey);
        return { data: [] as SoccerGame[], lastUpdated: Date.now(), nextRefreshAt: Date.now() + ML_DATA_CACHE_RETRY_MS, ttlMs: ML_DATA_CACHE_RETRY_MS };
      }),
      refreshMlDataCache(keys.golfFixturesKey, fetchTodayGolfTournaments, {
        force: true,
      }).catch((error) => {
        refreshHadFailure = true;
        console.error("Failed to refresh Golf fixtures:", error);
        scheduleMlDataCacheRetry(keys.golfFixturesKey);
        return { data: [] as GolfTournament[], lastUpdated: Date.now(), nextRefreshAt: Date.now() + ML_DATA_CACHE_RETRY_MS, ttlMs: ML_DATA_CACHE_RETRY_MS };
      }),
      refreshMlDataCache(keys.mmaFixturesKey, fetchTodayMmaGames, {
        force: true,
      }).catch((error) => {
        refreshHadFailure = true;
        console.error("Failed to refresh MMA fixtures:", error);
        scheduleMlDataCacheRetry(keys.mmaFixturesKey);
        return { data: [] as MMAMatchup[], lastUpdated: Date.now(), nextRefreshAt: Date.now() + ML_DATA_CACHE_RETRY_MS, ttlMs: ML_DATA_CACHE_RETRY_MS };
      }),
    ]);

    if (racingFixturesEntry && isMountedRef.current) {
      setRaces(racingFixturesEntry.data);
    }

    if (aflFixturesEntry && isMountedRef.current) {
      setAFLGames(aflFixturesEntry.data);
    }

    if (nbaFixturesEntry && isMountedRef.current) {
      setNBAGames(nbaFixturesEntry.data);
    }

    if (nrlFixturesEntry && isMountedRef.current) {
      setNRLGames(nrlFixturesEntry.data);
    }

    if (soccerFixturesEntry && isMountedRef.current) {
      setSoccerGames(soccerFixturesEntry.data);
    }

    if (golfFixturesEntry && isMountedRef.current) {
      setGolfTournaments(golfFixturesEntry.data);
    }

    if (mmaFixturesEntry && isMountedRef.current) {
      setMMAMatchups(mmaFixturesEntry.data);
    }

    if (isMountedRef.current) {
      setLoading(false);
    }

    const racePredictionsPromise = racingFixturesEntry
      ? refreshMlDataCache(
          keys.racingPredictionsKey,
          () => fetchRacePredictions(racingFixturesEntry.data),
          { force: true },
        ).catch((error) => {
          refreshHadFailure = true;
          usedCacheFallback = true;
          console.error("Failed to refresh racing predictions:", error);
          scheduleMlDataCacheRetry(keys.racingPredictionsKey);
          return readMlDataCache<Record<string, RacePrediction>>(
            keys.racingPredictionsKey,
          );
        })
      : Promise.resolve(
          readMlDataCache<Record<string, RacePrediction>>(
            keys.racingPredictionsKey,
          ),
        );

    const aflPredictionsPromise = aflFixturesEntry
      ? refreshMlDataCache(
          keys.aflPredictionsKey,
          () => fetchAflPredictions(aflFixturesEntry.data),
          { force: true },
        ).catch((error) => {
          refreshHadFailure = true;
          usedCacheFallback = true;
          console.error("Failed to refresh AFL predictions:", error);
          scheduleMlDataCacheRetry(keys.aflPredictionsKey);
          return readMlDataCache<Record<string, AFLPrediction>>(
            keys.aflPredictionsKey,
          );
        })
      : Promise.resolve(
          readMlDataCache<Record<string, AFLPrediction>>(keys.aflPredictionsKey),
        );

    const nbaPredictionsPromise = nbaFixturesEntry
      ? refreshMlDataCache(
          keys.nbaPredictionsKey,
          () => fetchNbaPredictions(nbaFixturesEntry.data),
          { force: true },
        ).catch((error) => {
          refreshHadFailure = true;
          usedCacheFallback = true;
          console.error("Failed to refresh NBA predictions:", error);
          scheduleMlDataCacheRetry(keys.nbaPredictionsKey);
          return readMlDataCache<Record<string, NBAPrediction>>(
            keys.nbaPredictionsKey,
          );
        })
      : Promise.resolve(
          readMlDataCache<Record<string, NBAPrediction>>(keys.nbaPredictionsKey),
        );

    const nrlPredictionsPromise = nrlFixturesEntry
      ? refreshMlDataCache(
          keys.nrlPredictionsKey,
          () => fetchNrlPredictions(nrlFixturesEntry.data),
          { force: true },
        ).catch((error) => {
          refreshHadFailure = true;
          usedCacheFallback = true;
          console.error("Failed to refresh NRL predictions:", error);
          scheduleMlDataCacheRetry(keys.nrlPredictionsKey);
          return readMlDataCache<Record<string, NRLPrediction>>(
            keys.nrlPredictionsKey,
          );
        })
      : Promise.resolve(
          readMlDataCache<Record<string, NRLPrediction>>(keys.nrlPredictionsKey),
        );

    const soccerPredictionsPromise = soccerFixturesEntry
      ? refreshMlDataCache(
          keys.soccerPredictionsKey,
          () => fetchSoccerPredictions(soccerFixturesEntry.data),
          { force: true },
        ).catch((error) => {
          refreshHadFailure = true;
          usedCacheFallback = true;
          console.error("Failed to refresh Soccer predictions:", error);
          scheduleMlDataCacheRetry(keys.soccerPredictionsKey);
          return readMlDataCache<Record<string, SoccerPrediction>>(
            keys.soccerPredictionsKey,
          );
        })
      : Promise.resolve(
          readMlDataCache<Record<string, SoccerPrediction>>(keys.soccerPredictionsKey),
        );

    const golfPredictionsPromise = golfFixturesEntry
      ? refreshMlDataCache(
          keys.golfPredictionsKey,
          () => fetchGolfPredictions(golfFixturesEntry.data),
          { force: true },
        ).catch((error) => {
          refreshHadFailure = true;
          usedCacheFallback = true;
          console.error("Failed to refresh Golf predictions:", error);
          scheduleMlDataCacheRetry(keys.golfPredictionsKey);
          return readMlDataCache<Record<string, GolfPrediction>>(
            keys.golfPredictionsKey,
          );
        })
      : Promise.resolve(
          readMlDataCache<Record<string, GolfPrediction>>(keys.golfPredictionsKey),
        );

    const mmaPredictionsPromise = mmaFixturesEntry
      ? refreshMlDataCache(
          keys.mmaPredictionsKey,
          () => fetchMmaPredictions(mmaFixturesEntry.data),
          { force: true },
        ).catch((error) => {
          refreshHadFailure = true;
          usedCacheFallback = true;
          console.error("Failed to refresh MMA predictions:", error);
          scheduleMlDataCacheRetry(keys.mmaPredictionsKey);
          return readMlDataCache<Record<string, MMAPrediction>>(
            keys.mmaPredictionsKey,
          );
        })
      : Promise.resolve(
          readMlDataCache<Record<string, MMAPrediction>>(keys.mmaPredictionsKey),
        );

    const [
      racePredictionsEntry,
      aflPredictionsEntry,
      nbaPredictionsEntry,
      nrlPredictionsEntry,
      soccerPredictionsEntry,
      golfPredictionsEntry,
      mmaPredictionsEntry,
    ] = await Promise.all([
      racePredictionsPromise,
      aflPredictionsPromise,
      nbaPredictionsPromise,
      nrlPredictionsPromise,
      soccerPredictionsPromise,
      golfPredictionsPromise,
      mmaPredictionsPromise,
    ]);

    if (racePredictionsEntry && isMountedRef.current) {
      setRacePredictions(racePredictionsEntry.data);
    }

    if (aflPredictionsEntry && isMountedRef.current) {
      setAFLPredictions(aflPredictionsEntry.data);
    }

    if (nbaPredictionsEntry && isMountedRef.current) {
      setNBAPredictions(nbaPredictionsEntry.data);
    }

    if (nrlPredictionsEntry && isMountedRef.current) {
      setNRLPredictions(nrlPredictionsEntry.data);
    }

    if (soccerPredictionsEntry && isMountedRef.current) {
      setSoccerPredictions(soccerPredictionsEntry.data);
    }

    if (golfPredictionsEntry && isMountedRef.current) {
      setGolfPredictions(golfPredictionsEntry.data);
    }

    if (mmaPredictionsEntry && isMountedRef.current) {
      setMMAPredictions(mmaPredictionsEntry.data);
    }

    await healthPromise;
    syncCacheMetadata();
    refreshingRef.current = false;
    trackRefreshOutcome("/dashboard", refreshStartedAt, {
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
    const cached = hydrateFromCache();
    const hasFixtureCache =
      !!cached.cachedRaces ||
      !!cached.cachedAflGames ||
      !!cached.cachedNbaGames ||
      !!cached.cachedNrlGames ||
      !!cached.cachedSoccerGames ||
      !!cached.cachedGolfTournaments ||
      !!cached.cachedMmaMatchups;

    if (hasFixtureCache) {
      setLoading(false);
    }

    const shouldRefresh =
      !cached.cachedRaces ||
      !cached.cachedRacePredictions ||
      !cached.cachedAflGames ||
      !cached.cachedAflPredictions ||
      !cached.cachedNbaGames ||
      !cached.cachedNbaPredictions ||
      !cached.cachedNrlGames ||
      !cached.cachedNrlPredictions ||
      !cached.cachedSoccerGames ||
      !cached.cachedSoccerPredictions ||
      !cached.cachedGolfTournaments ||
      !cached.cachedGolfPredictions ||
      !cached.cachedMmaMatchups ||
      !cached.cachedMmaPredictions ||
      isMlDataCacheStale(cached.cachedRaces) ||
      isMlDataCacheStale(cached.cachedRacePredictions) ||
      isMlDataCacheStale(cached.cachedAflGames) ||
      isMlDataCacheStale(cached.cachedAflPredictions) ||
      isMlDataCacheStale(cached.cachedNbaGames) ||
      isMlDataCacheStale(cached.cachedNbaPredictions) ||
      isMlDataCacheStale(cached.cachedNrlGames) ||
      isMlDataCacheStale(cached.cachedNrlPredictions) ||
      isMlDataCacheStale(cached.cachedSoccerGames) ||
      isMlDataCacheStale(cached.cachedSoccerPredictions) ||
      isMlDataCacheStale(cached.cachedGolfTournaments) ||
      isMlDataCacheStale(cached.cachedGolfPredictions) ||
      isMlDataCacheStale(cached.cachedMmaMatchups) ||
      isMlDataCacheStale(cached.cachedMmaPredictions);

    if (shouldRefresh) {
      void refreshDashboard();
    } else {
      void refreshEngineHealth();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    trackStaleCache("/dashboard", lastUpdated);
  }, [lastUpdated]);

  // Fallback timer: if live data fetching takes > 2 seconds or stays empty, stop loading guard immediately
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const mainRacePredictionRaces = races.filter(
    (race) => racePredictions[race.race_id] && isPhase2MainRace(race),
  );
  const racingOpportunities = rankOpportunities(
    mainRacePredictionRaces.flatMap((race) => {
      const prediction = racePredictions[race.race_id];
      const confidenceSignal = prediction
        ? getConfidenceSignal(prediction.ai_insights_context)
        : null;
      const urgencySignal = getUrgencySignal({
        startTime: race.start_time,
        eventDate: race.meeting_date,
      });

      if (!prediction) {
        return [];
      }

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
  ).slice(0, 3);

  const aflOpportunities = rankOpportunities(
    aflGames.flatMap((game) => {
      const prediction = aflPredictions[game.game_id];
      if (!prediction) {
        return [];
      }

      const homePct = prediction.predictions.home_win_probability;
      const awayPct = prediction.predictions.away_win_probability;
      const homeWins = homePct > awayPct;

      return [
        {
          id: game.game_id,
          sport: "afl" as const,
          selectionName: homeWins ? game.home_team : game.away_team,
          eventLabel: `${game.home_team} vs ${game.away_team}`,
          probability: homeWins ? homePct : awayPct,
          fairOdds: homeWins
            ? prediction.predictions.fair_odds_home
            : prediction.predictions.fair_odds_away,
          marketOdds: homeWins
            ? prediction.predictions.market_odds_home ?? undefined
            : prediction.predictions.market_odds_away ?? undefined,
          confidenceSignal: getConfidenceSignal(prediction.ai_insights_context),
          urgencySignal: getUrgencySignal({
            startTime: game.date,
            isClosed: (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
            isResultPending: (game.complete ?? 0) >= 100,
          }),
          href: "/afl",
        },
      ];
    }),
  ).slice(0, 2);

  const nbaOpportunities = rankOpportunities(
    nbaGames.flatMap((game) => {
      const prediction = nbaPredictions[game.game_id];
      if (!prediction) {
        return [];
      }

      const homePct = prediction.predictions.home_win_probability;
      const awayPct = prediction.predictions.away_win_probability;
      const homeWins = homePct > awayPct;

      return [
        {
          id: game.game_id,
          sport: "nba" as const,
          selectionName: homeWins ? game.home_team : game.away_team,
          eventLabel: `${game.home_team} vs ${game.away_team}`,
          probability: homeWins ? homePct : awayPct,
          fairOdds: homeWins
            ? prediction.predictions.fair_odds_home
            : prediction.predictions.fair_odds_away,
          marketOdds: homeWins
            ? prediction.predictions.market_odds_home ?? undefined
            : prediction.predictions.market_odds_away ?? undefined,
          confidenceSignal: getConfidenceSignal(prediction.ai_insights_context),
          urgencySignal: getUrgencySignal({
            startTime: game.date,
          }),
          href: "/nba",
        },
      ];
    }),
  ).slice(0, 2);

  const nrlOpportunities = rankOpportunities(
    nrlGames.flatMap((game) => {
      const prediction = nrlPredictions[game.game_id];
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
          marketOdds: homeWins
            ? prediction.predictions.market_odds_home ?? undefined
            : prediction.predictions.market_odds_away ?? undefined,
          confidenceSignal: getConfidenceSignal(prediction.ai_insights_context),
          urgencySignal: getUrgencySignal({
            startTime: game.date,
            isClosed: (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
            isResultPending: (game.complete ?? 0) >= 100,
          }),
          href: "/nrl",
        },
      ];
    }),
  ).slice(0, 2);

  const soccerOpportunities = rankOpportunities(
    soccerGames.flatMap((game) => {
      const prediction = soccerPredictions[game.game_id];
      if (!prediction) {
        return [];
      }

      const homePct = prediction.predictions.home_win_probability;
      const awayPct = prediction.predictions.away_win_probability;
      const drawPct = prediction.predictions.draw_probability ?? 0;
      
      let selectionName = game.home_team;
      let probability = homePct;
      let fairOdds = prediction.predictions.fair_odds_home;
      let marketOdds = prediction.predictions.market_odds_home ?? undefined;

      if (awayPct > homePct && awayPct > drawPct) {
        selectionName = game.away_team;
        probability = awayPct;
        fairOdds = prediction.predictions.fair_odds_away;
        marketOdds = prediction.predictions.market_odds_away ?? undefined;
      } else if (drawPct > homePct && drawPct > awayPct) {
        selectionName = "Draw";
        probability = drawPct;
        fairOdds = prediction.predictions.fair_odds_draw ?? 3.0;
        marketOdds = prediction.predictions.market_odds_draw ?? undefined;
      }

      return [
        {
          id: game.game_id,
          sport: "soccer" as const,
          selectionName,
          eventLabel: `${game.home_team} vs ${game.away_team}`,
          probability,
          fairOdds,
          marketOdds,
          confidenceSignal: getConfidenceSignal(prediction.ai_insights_context),
          urgencySignal: getUrgencySignal({
            startTime: game.date,
            isClosed: (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
            isResultPending: (game.complete ?? 0) >= 100,
          }),
          href: "/soccer",
        },
      ];
    }),
  ).slice(0, 2);

  const golfOpportunities = rankOpportunities(
    golfTournaments.flatMap((tournament) => {
      const prediction = golfPredictions[tournament.tournament_id];
      if (!prediction) {
        return [];
      }

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
          marketOdds: pick.market_odds ?? undefined,
          confidenceSignal: getConfidenceSignal(prediction.ai_insights_context),
          urgencySignal: getUrgencySignal({
            startTime: tournament.start_time,
            eventDate: tournament.meeting_date,
          }),
          href: "/golf",
        };
      });
    }),
  ).slice(0, 2);

  const mmaOpportunities = rankOpportunities(
    mmaMatchups.flatMap((game) => {
      const prediction = mmaPredictions[game.game_id];
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
          marketOdds: homeWins
            ? prediction.predictions.market_odds_home ?? undefined
            : prediction.predictions.market_odds_away ?? undefined,
          confidenceSignal: getConfidenceSignal(prediction.ai_insights_context),
          urgencySignal: getUrgencySignal({
            startTime: game.date,
            isClosed: (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
            isResultPending: (game.complete ?? 0) >= 100,
          }),
          href: "/mma",
        },
      ];
    }),
  ).slice(0, 2);

  const hasDashboardData =
    races.length > 0 ||
    aflGames.length > 0 ||
    nbaGames.length > 0 ||
    nrlGames.length > 0 ||
    soccerGames.length > 0 ||
    golfTournaments.length > 0 ||
    mmaMatchups.length > 0;

  const dashboardStatus = getCachedViewStatus({
    resourceLabel: "Dashboard data",
    hasData: hasDashboardData,
    lastUpdated,
    isRefreshing: refreshing,
    refreshFailed,
  });

  const activeRaces = [...races].sort(
    (left, right) =>
      (left.start_time ?? "").localeCompare(right.start_time ?? ""),
  );

  const allRealOpportunities = rankOpportunities([
    ...racingOpportunities,
    ...aflOpportunities,
    ...nbaOpportunities,
    ...nrlOpportunities,
    ...soccerOpportunities,
    ...golfOpportunities,
    ...mmaOpportunities,
  ]).map((opp) => {
    const edgeVal = getEdgePercent(opp.fairOdds, opp.marketOdds);
    return {
      id: opp.id,
      sport: opp.sport.toUpperCase(),
      event: opp.eventLabel,
      selection: opp.selectionName,
      fairOdds: opp.fairOdds,
      marketOdds: opp.marketOdds ?? undefined,
      edge: edgeVal !== null ? Number(edgeVal.toFixed(1)) : undefined,
      bookie: opp.marketOdds ? "Betfair" : undefined,
    };
  });

  const handleOpenPaperBet = (opp: any) => {
    // Toast notification handles feedback
  };

  const handleOpenBobModal = (ctx: any) => {
    setActiveExplanation(
      buildBobExplanation({
        sport: "afl",
        selectionName: ctx.selection || "Top Value Pick",
        opponentName: ctx.event || "Opponent",
        probability: 0.62,
        fairOdds: 1.61,
        featureImpact: [],
        aiInsightsContext: { notes: [`Value signal triggered with ${ctx.edge || 0}% edge.`] },
      })
    );
  };

  return (
    <div>
      <ExplainDrawer
        open={activeExplanation !== null}
        explanation={activeExplanation}
        onClose={() => setActiveExplanation(null)}
      />

      <VariantA_CyberpunkTerminal
        racesData={activeRaces}
        allOpportunities={allRealOpportunities}
        aflData={aflGames}
        nbaData={nbaGames}
        nrlData={nrlGames}
        soccerData={soccerGames}
        golfData={golfTournaments}
        mmaData={mmaMatchups}
        isLoading={loading}
        onOpenPaperBet={handleOpenPaperBet}
        onOpenBobModal={handleOpenBobModal}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090E]" />}>
      <DashboardContent />
    </Suspense>
  );
}
