"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type {
  BobExplanation,
  FeatureImpactItem,
  ModelMetadata,
} from "./lib/bob/explainer";
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
  const response = await fetchWithTimeout(`${ML_API}/api/races/today`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Racing fixtures request failed with ${response.status}`);
  }

  const data = await response.json();
  return (data?.races ?? []) as RaceSummary[];
}

async function fetchUpcomingAflGames() {
  const response = await fetchWithTimeout(`${ML_API}/api/afl/games/upcoming`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`AFL fixtures request failed with ${response.status}`);
  }

  const data = await response.json();
  return (data?.games ?? []) as AFLGame[];
}

async function fetchTodayNbaGames() {
  const response = await fetchWithTimeout(`${ML_API}/api/nba/games/today`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`NBA fixtures request failed with ${response.status}`);
  }

  const data = await response.json();
  return (data?.games ?? []) as NBAGame[];
}

async function fetchUpcomingNrlGames() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/api/nrl/games/upcoming`, {
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`NRL fixtures request failed with ${response.status}`);
    }
    const data = await response.json();
    return (data?.games ?? []) as NRLGame[];
  } catch (error) {
    console.error("fetchUpcomingNrlGames failed:", error);
    return [];
  }
}

async function fetchTodaySoccerGames() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/api/soccer/games/today`, {
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`Soccer fixtures request failed with ${response.status}`);
    }
    const data = await response.json();
    return (data?.games ?? []) as SoccerGame[];
  } catch (error) {
    console.error("fetchTodaySoccerGames failed:", error);
    return [];
  }
}

async function fetchTodayGolfTournaments() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/api/golf/games/today`, {
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`Golf fixtures request failed with ${response.status}`);
    }
    const data = await response.json();
    return (data?.games ?? []) as GolfTournament[];
  } catch (error) {
    console.error("fetchTodayGolfTournaments failed:", error);
    return [];
  }
}

async function fetchTodayMmaGames() {
  try {
    const response = await fetchWithTimeout(`${ML_API}/api/mma/games/today`, {
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`MMA fixtures request failed with ${response.status}`);
    }
    const data = await response.json();
    return (data?.games ?? []) as MMAMatchup[];
  } catch (error) {
    console.error("fetchTodayMmaGames failed:", error);
    return [];
  }
}

async function fetchRacePredictions(races: RaceSummary[]) {
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

export default function DashboardPage() {
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
        usedCacheFallback = true;
        console.error("Failed to refresh racing fixtures:", error);
        scheduleMlDataCacheRetry(keys.racingFixturesKey);
        return readMlDataCache<RaceSummary[]>(keys.racingFixturesKey);
      }),
      refreshMlDataCache(keys.aflFixturesKey, fetchUpcomingAflGames, {
        force: true,
      }).catch((error) => {
        refreshHadFailure = true;
        usedCacheFallback = true;
        console.error("Failed to refresh AFL fixtures:", error);
        scheduleMlDataCacheRetry(keys.aflFixturesKey);
        return readMlDataCache<AFLGame[]>(keys.aflFixturesKey);
      }),
      refreshMlDataCache(keys.nbaFixturesKey, fetchTodayNbaGames, {
        force: true,
      }).catch((error) => {
        refreshHadFailure = true;
        usedCacheFallback = true;
        console.error("Failed to refresh NBA fixtures:", error);
        scheduleMlDataCacheRetry(keys.nbaFixturesKey);
        return readMlDataCache<NBAGame[]>(keys.nbaFixturesKey);
      }),
      refreshMlDataCache(keys.nrlFixturesKey, fetchUpcomingNrlGames, {
        force: true,
      }).catch((error) => {
        refreshHadFailure = true;
        usedCacheFallback = true;
        console.error("Failed to refresh NRL fixtures:", error);
        scheduleMlDataCacheRetry(keys.nrlFixturesKey);
        return readMlDataCache<NRLGame[]>(keys.nrlFixturesKey);
      }),
      refreshMlDataCache(keys.soccerFixturesKey, fetchTodaySoccerGames, {
        force: true,
      }).catch((error) => {
        refreshHadFailure = true;
        usedCacheFallback = true;
        console.error("Failed to refresh Soccer fixtures:", error);
        scheduleMlDataCacheRetry(keys.soccerFixturesKey);
        return readMlDataCache<SoccerGame[]>(keys.soccerFixturesKey);
      }),
      refreshMlDataCache(keys.golfFixturesKey, fetchTodayGolfTournaments, {
        force: true,
      }).catch((error) => {
        refreshHadFailure = true;
        usedCacheFallback = true;
        console.error("Failed to refresh Golf fixtures:", error);
        scheduleMlDataCacheRetry(keys.golfFixturesKey);
        return readMlDataCache<GolfTournament[]>(keys.golfFixturesKey);
      }),
      refreshMlDataCache(keys.mmaFixturesKey, fetchTodayMmaGames, {
        force: true,
      }).catch((error) => {
        refreshHadFailure = true;
        usedCacheFallback = true;
        console.error("Failed to refresh MMA fixtures:", error);
        scheduleMlDataCacheRetry(keys.mmaFixturesKey);
        return readMlDataCache<MMAMatchup[]>(keys.mmaFixturesKey);
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

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <Brain size={48} />
          <p>Loading today's ML snapshots...</p>
        </div>
      </div>
    );
  }

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
          confidenceSignal: getConfidenceSignal(prediction.ai_insights_context),
          urgencySignal: getUrgencySignal({
            startTime: game.date,
            isClosed: (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
            isResultPending: (game.complete ?? 0) >= 100,
          }),
          href: "/afl",
          note:
            "No live market price is attached on this screen, so this ranking stays model-led and confidence-weighted.",
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
          confidenceSignal: getConfidenceSignal(prediction.ai_insights_context),
          urgencySignal: getUrgencySignal({
            startTime: game.date,
          }),
          href: "/nba",
          note:
            "No live market price is attached on this screen, so this ranking stays model-led and confidence-weighted.",
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
          confidenceSignal: getConfidenceSignal(prediction.ai_insights_context),
          urgencySignal: getUrgencySignal({
            startTime: game.date,
            isClosed: (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
            isResultPending: (game.complete ?? 0) >= 100,
          }),
          href: "/nrl",
          note: "No live market price is attached on this screen, so this ranking stays model-led.",
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
          note: "No live market price is attached on this screen, so this ranking stays model-led.",
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
          marketOdds: player?.betfair_back_price ?? null,
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
          confidenceSignal: getConfidenceSignal(prediction.ai_insights_context),
          urgencySignal: getUrgencySignal({
            startTime: game.date,
            isClosed: (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
            isResultPending: (game.complete ?? 0) >= 100,
          }),
          href: "/mma",
          note: "No live market price is attached on this screen, so this ranking stays model-led.",
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

  return (
    <div>
      <ExplainDrawer
        open={activeExplanation !== null}
        explanation={activeExplanation}
        onClose={() => setActiveExplanation(null)}
      />
      <div className={`engine-banner ${engineStatus}`}>
        <Activity size={16} />
        <span>
          ML Prediction Engine:{" "}
          <strong>{engineStatus === "online" ? "Online" : "Offline"}</strong>
        </span>
        {engineStatus === "online" ? (
          <span className="engine-models">7 prediction models active</span>
        ) : null}
      </div>

      <RefreshControls
        lastUpdated={lastUpdated}
        nextRefreshAt={nextRefreshAt}
        isRefreshing={refreshing}
        onRefresh={refreshDashboard}
      />

      {dashboardStatus ? (
        <div className="status-stack">
          <ErrorState
            title={dashboardStatus.title}
            message={dashboardStatus.message}
            tone={dashboardStatus.tone}
            actionLabel="Refresh now"
            onAction={() => void refreshDashboard()}
            compact
          />
        </div>
      ) : null}

      {!hasDashboardData && refreshFailed ? (
        <ErrorState
          title="Today’s predictions are still loading"
          message="The engine did not return a usable snapshot yet. Try again in a moment while BetMate keeps retrying."
          tone="danger"
          actionLabel="Refresh now"
          onAction={() => void refreshDashboard()}
        />
      ) : (
        <>
          {/* Category Browser Hub */}
          <div className="category-hub-container">
            <button
              type="button"
              className={`category-hub-card racing ${activeCategory === "racing" ? "active" : ""}`}
              onClick={() => setActiveCategory("racing")}
            >
              <div className="category-hub-icon-wrap">
                <Trophy size={24} />
              </div>
              <div className="category-hub-info">
                <h4>Racing ({new Set(races.map((r) => r.venue)).size} venues)</h4>
                <p>{races.length} races today ({new Set(races.map((r) => r.venue)).size} venues)</p>
              </div>
              <div className="category-hub-status">
                <span className="category-hub-badge">Select</span>
              </div>
            </button>

            <button
              type="button"
              className={`category-hub-card sports ${activeCategory === "sports" ? "active" : ""}`}
              onClick={() => setActiveCategory("sports")}
            >
              <div className="category-hub-icon-wrap">
                <Zap size={24} />
              </div>
              <div className="category-hub-info">
                <h4>
                  Sports (
                  {
                    new Set([
                      ...aflGames.map((g) => g.venue).filter(Boolean),
                      ...nrlGames.map((g) => g.venue).filter(Boolean),
                      ...golfTournaments.map((t) => t.venue).filter(Boolean),
                      ...mmaMatchups.map((g) => g.venue).filter(Boolean),
                    ]).size
                  }{" "}
                  venues)
                </h4>
                <p>
                  {aflGames.length + nbaGames.length + nrlGames.length + soccerGames.length + golfTournaments.length + mmaMatchups.length} events ({
                    new Set([
                      ...aflGames.map((g) => g.venue).filter(Boolean),
                      ...nrlGames.map((g) => g.venue).filter(Boolean),
                      ...golfTournaments.map((t) => t.venue).filter(Boolean),
                      ...mmaMatchups.map((g) => g.venue).filter(Boolean),
                    ]).size
                  } venues)
                </p>
              </div>
              <div className="category-hub-status">
                <span className="category-hub-badge">Select</span>
              </div>
            </button>
          </div>

          {activeCategory === "racing" ? (
            <div className="card text-center" style={{ padding: "2.5rem 1.5rem" }}>
              <Trophy size={48} style={{ color: "var(--accent)", marginBottom: "1rem" }} />
              <h3>🏇 Racing Dashboard</h3>
              <p className="muted-copy" style={{ maxWidth: "540px", margin: "0.5rem auto 1.5rem" }}>
                All Australian horse racing cards, best opportunities, and AI predictions are hosted on the main Racing page.
              </p>
              <Link href="/racing" className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                Go to Racing Page <ChevronRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                <div className="stat-card green">
                  <div className="stat-label">
                    <CircleDot
                      size={14}
                      style={{ display: "inline", verticalAlign: "middle" }}
                    />{" "}
                    AFL
                  </div>
                  <div className="stat-value">{aflGames.length}</div>
                  <div className="stat-sub">This round</div>
                </div>
                <div className="stat-card blue">
                  <div className="stat-label">
                    <Zap
                      size={14}
                      style={{ display: "inline", verticalAlign: "middle" }}
                    />{" "}
                    NBA
                  </div>
                  <div className="stat-value">{nbaGames.length}</div>
                  <div className="stat-sub">Tonight</div>
                </div>
                <div className="stat-card green" style={{ borderColor: "rgba(59, 130, 246, 0.4)" }}>
                  <div className="stat-label">
                    <Shield
                      size={14}
                      style={{ display: "inline", verticalAlign: "middle" }}
                    />{" "}
                    NRL
                  </div>
                  <div className="stat-value">{nrlGames.length}</div>
                  <div className="stat-sub">This round</div>
                </div>
                <div className="stat-card blue" style={{ borderColor: "rgba(16, 185, 129, 0.4)" }}>
                  <div className="stat-label">
                    <Globe
                      size={14}
                      style={{ display: "inline", verticalAlign: "middle" }}
                    />{" "}
                    Soccer
                  </div>
                  <div className="stat-value">{soccerGames.length}</div>
                  <div className="stat-sub">Today</div>
                </div>
                <div className="stat-card accent">
                  <div className="stat-label">
                    <Flag
                      size={14}
                      style={{ display: "inline", verticalAlign: "middle" }}
                    />{" "}
                    Golf
                  </div>
                  <div className="stat-value">{golfTournaments.length}</div>
                  <div className="stat-sub">Today</div>
                </div>
                <div className="stat-card red" style={{ borderColor: "rgba(239, 68, 68, 0.4)" }}>
                  <div className="stat-label">
                    <Swords
                      size={14}
                      style={{ display: "inline", verticalAlign: "middle" }}
                    />{" "}
                    MMA
                  </div>
                  <div className="stat-value">{mmaMatchups.length}</div>
                  <div className="stat-sub">Today</div>
                </div>
                <div className="stat-card yellow">
                  <div className="stat-label">
                    <Brain
                      size={14}
                      style={{ display: "inline", verticalAlign: "middle" }}
                    />{" "}
                    ML Models
                  </div>
                  <div className="stat-value">7</div>
                  <div className="stat-sub">Shared cached snapshots</div>
                </div>
              </div>

              <ErrorBoundary sectionName="Dashboard opportunities">
                <div className="dashboard-opportunities-grid">
                  <BestAflOpportunities opportunities={aflOpportunities} compact />
                  <BestNbaOpportunities opportunities={nbaOpportunities} compact />
                  <BestNrlOpportunities opportunities={nrlOpportunities} compact />
                  <BestSoccerOpportunities opportunities={soccerOpportunities} compact />
                  <BestGolfOpportunities opportunities={golfOpportunities} compact />
                  <BestMmaOpportunities opportunities={mmaOpportunities} compact />
                </div>
              </ErrorBoundary>

              <div className="section-header" style={{ marginTop: "2rem" }}>
                <h3>🏈 AFL Predictions</h3>
                <Link href="/afl" className="btn btn-sm btn-secondary">
                  View All <ChevronRight size={14} />
                </Link>
              </div>
              <ErrorBoundary sectionName="Dashboard AFL predictions">
                <div className="predictions-grid">
                  {aflGames.slice(0, 3).map((game) => {
                    const prediction = aflPredictions[game.game_id];
                    const homePct = prediction?.predictions?.home_win_probability ?? 50;
                    const awayPct = prediction?.predictions?.away_win_probability ?? 50;
                    const homeWins = homePct > awayPct;
                    const confidenceSignal = prediction
                      ? getConfidenceSignal(prediction.ai_insights_context)
                      : null;
                    const urgencySignal = getUrgencySignal({
                      startTime: game.date,
                      isClosed: (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
                      isResultPending: (game.complete ?? 0) >= 100,
                    });

                    return (
                      <div
                        key={game.game_id}
                        className="prediction-card game-card-variant"
                        onClick={() => router.push("/afl")}
                      >
                        <div className="game-matchup">
                          <div className={`game-team ${homeWins ? "favoured" : ""}`}>
                            <span className="team-name">{game.home_team}</span>
                            <span className="team-prob">{homePct}%</span>
                            {prediction ? (
                              <div
                                onClick={(event) => event.stopPropagation()}
                                style={{ marginTop: "0.75rem" }}
                              >
                                <PaperBetAction
                                  bet={{
                                    sport: "afl",
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
                                    is_closed:
                                      (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                          <div className="game-vs">VS</div>
                          <div className={`game-team ${!homeWins ? "favoured" : ""}`}>
                            <span className="team-name">{game.away_team}</span>
                            <span className="team-prob">{awayPct}%</span>
                            {prediction ? (
                              <div
                                onClick={(event) => event.stopPropagation()}
                                style={{ marginTop: "0.75rem" }}
                              >
                                <PaperBetAction
                                  bet={{
                                    sport: "afl",
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
                                    is_closed:
                                      (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="game-prob-bar">
                          <div className="prob-fill home" style={{ width: `${homePct}%` }} />
                          <div className="prob-fill away" style={{ width: `${awayPct}%` }} />
                        </div>
                        <div className="prediction-card-signals" style={{ marginTop: "0.9rem" }}>
                          {confidenceSignal ? <ConfidenceBadge signal={confidenceSignal} /> : null}
                          {urgencySignal ? <UrgencyBadge signal={urgencySignal} /> : null}
                        </div>
                        {prediction ? (
                          <div className="dashboard-card-actions">
                            <button
                              type="button"
                              className="why-pick-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveExplanation(
                                  buildBobExplanation({
                                    sport: "afl",
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
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </ErrorBoundary>

              <div className="section-header" style={{ marginTop: "2rem" }}>
                <h3>🏈 NBA Predictions</h3>
                <Link href="/nba" className="btn btn-sm btn-secondary">
                  View All <ChevronRight size={14} />
                </Link>
              </div>
              <ErrorBoundary sectionName="Dashboard NBA predictions">
                <div className="predictions-grid">
                  {nbaGames.slice(0, 3).map((game) => {
                    const prediction = nbaPredictions[game.game_id];
                    const homePct = prediction?.predictions?.home_win_probability ?? 50;
                    const awayPct = prediction?.predictions?.away_win_probability ?? 50;
                    const homeWins = homePct > awayPct;
                    const confidenceSignal = prediction
                      ? getConfidenceSignal(prediction.ai_insights_context)
                      : null;
                    const urgencySignal = getUrgencySignal({
                      startTime: game.date,
                    });

                    return (
                      <div
                        key={game.game_id}
                        className="prediction-card game-card-variant"
                        onClick={() => router.push("/nba")}
                      >
                        <div className="game-matchup">
                          <div className={`game-team ${homeWins ? "favoured" : ""}`}>
                            <span className="team-name">{game.home_team}</span>
                            <span className="team-prob">{homePct}%</span>
                            {prediction ? (
                              <div
                                onClick={(event) => event.stopPropagation()}
                                style={{ marginTop: "0.75rem" }}
                              >
                                <PaperBetAction
                                  bet={{
                                    sport: "nba",
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
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                          <div className="game-vs">VS</div>
                          <div className={`game-team ${!homeWins ? "favoured" : ""}`}>
                            <span className="team-name">{game.away_team}</span>
                            <span className="team-prob">{awayPct}%</span>
                            {prediction ? (
                              <div
                                onClick={(event) => event.stopPropagation()}
                                style={{ marginTop: "0.75rem" }}
                              >
                                <PaperBetAction
                                  bet={{
                                    sport: "nba",
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
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="game-prob-bar">
                          <div className="prob-fill home" style={{ width: `${homePct}%` }} />
                          <div className="prob-fill away" style={{ width: `${awayPct}%` }} />
                        </div>
                        <div className="prediction-card-signals" style={{ marginTop: "0.9rem" }}>
                          {confidenceSignal ? <ConfidenceBadge signal={confidenceSignal} /> : null}
                          {urgencySignal ? <UrgencyBadge signal={urgencySignal} /> : null}
                        </div>
                        {prediction ? (
                          <div className="dashboard-card-actions">
                            <button
                              type="button"
                              className="why-pick-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveExplanation(
                                  buildBobExplanation({
                                    sport: "nba",
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
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </ErrorBoundary>

              <div className="section-header" style={{ marginTop: "2rem" }}>
                <h3>🏉 NRL Predictions</h3>
                <Link href="/nrl" className="btn btn-sm btn-secondary">
                  View All <ChevronRight size={14} />
                </Link>
              </div>
              <ErrorBoundary sectionName="Dashboard NRL predictions">
                <div className="predictions-grid">
                  {nrlGames.slice(0, 3).map((game) => {
                    const prediction = nrlPredictions[game.game_id];
                    const homePct = prediction?.predictions?.home_win_probability ?? 50;
                    const awayPct = prediction?.predictions?.away_win_probability ?? 50;
                    const homeWins = homePct > awayPct;
                    const confidenceSignal = prediction
                      ? getConfidenceSignal(prediction.ai_insights_context)
                      : null;
                    const urgencySignal = getUrgencySignal({
                      startTime: game.date,
                      isClosed: (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
                      isResultPending: (game.complete ?? 0) >= 100,
                    });

                    return (
                      <div
                        key={game.game_id}
                        className="prediction-card game-card-variant"
                        onClick={() => router.push("/nrl")}
                      >
                        <div className="game-matchup">
                          <div className={`game-team ${homeWins ? "favoured" : ""}`}>
                            <span className="team-name">{game.home_team}</span>
                            <span className="team-prob">{homePct}%</span>
                            {prediction ? (
                              <div
                                onClick={(event) => event.stopPropagation()}
                                style={{ marginTop: "0.75rem" }}
                              >
                                <PaperBetAction
                                  bet={{
                                    sport: "nrl",
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
                                    is_closed:
                                      (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                          <div className="game-vs">VS</div>
                          <div className={`game-team ${!homeWins ? "favoured" : ""}`}>
                            <span className="team-name">{game.away_team}</span>
                            <span className="team-prob">{awayPct}%</span>
                            {prediction ? (
                              <div
                                onClick={(event) => event.stopPropagation()}
                                style={{ marginTop: "0.75rem" }}
                              >
                                <PaperBetAction
                                  bet={{
                                    sport: "nrl",
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
                                    is_closed:
                                      (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="game-prob-bar">
                          <div className="prob-fill home" style={{ width: `${homePct}%` }} />
                          <div className="prob-fill away" style={{ width: `${awayPct}%` }} />
                        </div>
                        <div className="prediction-card-signals" style={{ marginTop: "0.9rem" }}>
                          {confidenceSignal ? <ConfidenceBadge signal={confidenceSignal} /> : null}
                          {urgencySignal ? <UrgencyBadge signal={urgencySignal} /> : null}
                        </div>
                        {prediction ? (
                          <div className="dashboard-card-actions">
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
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </ErrorBoundary>

              <div className="section-header" style={{ marginTop: "2rem" }}>
                <h3>⚽ Soccer Predictions</h3>
                <Link href="/soccer" className="btn btn-sm btn-secondary">
                  View All <ChevronRight size={14} />
                </Link>
              </div>
              <ErrorBoundary sectionName="Dashboard Soccer predictions">
                <div className="predictions-grid">
                  {soccerGames.slice(0, 3).map((game) => {
                    const prediction = soccerPredictions[game.game_id];
                    const homePct = prediction?.predictions?.home_win_probability ?? 33;
                    const awayPct = prediction?.predictions?.away_win_probability ?? 33;
                    const drawPct = prediction?.predictions?.draw_probability ?? 34;
                    const confidenceSignal = prediction
                      ? getConfidenceSignal(prediction.ai_insights_context)
                      : null;
                    const urgencySignal = getUrgencySignal({
                      startTime: game.date,
                      isClosed: (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
                      isResultPending: (game.complete ?? 0) >= 100,
                    });

                    return (
                      <div
                        key={game.game_id}
                        className="prediction-card game-card-variant"
                        onClick={() => router.push("/soccer")}
                      >
                        <div className="game-matchup">
                          <div className="game-team">
                            <span className="team-name">{game.home_team} (Home)</span>
                            <span className="team-prob">{homePct}%</span>
                            {prediction ? (
                              <div onClick={(event) => event.stopPropagation()} style={{ marginTop: "0.5rem" }}>
                                <PaperBetAction
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
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                          
                          <div className="game-team" style={{ borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)", padding: "0 0.5rem" }}>
                            <span className="team-name" style={{ opacity: 0.8 }}>Draw</span>
                            <span className="team-prob">{drawPct}%</span>
                            {prediction && prediction.predictions.fair_odds_draw ? (
                              <div onClick={(event) => event.stopPropagation()} style={{ marginTop: "0.5rem" }}>
                                <PaperBetAction
                                  bet={{
                                    sport: "soccer",
                                    event_id: game.game_id,
                                    event_name: `${game.home_team} vs ${game.away_team}`,
                                    selection: "Draw",
                                    odds: prediction.predictions.fair_odds_draw,
                                    bet_type: "head_to_head",
                                    stake: 10,
                                    odds_source: "model_fair",
                                    current_odds: prediction.predictions.fair_odds_draw,
                                    can_compare_odds: false,
                                    event_start_time: game.date,
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>

                          <div className="game-team">
                            <span className="team-name">{game.away_team} (Away)</span>
                            <span className="team-prob">{awayPct}%</span>
                            {prediction ? (
                              <div onClick={(event) => event.stopPropagation()} style={{ marginTop: "0.5rem" }}>
                                <PaperBetAction
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
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="game-prob-bar" style={{ display: "grid", gridTemplateColumns: `${homePct}% ${drawPct}% ${awayPct}%` }}>
                          <div className="prob-fill home" style={{ width: "100%" }} />
                          <div className="prob-fill draw" style={{ width: "100%", backgroundColor: "var(--text-muted)" }} />
                          <div className="prob-fill away" style={{ width: "100%" }} />
                        </div>
                        <div className="prediction-card-signals" style={{ marginTop: "0.9rem" }}>
                          {confidenceSignal ? <ConfidenceBadge signal={confidenceSignal} /> : null}
                          {urgencySignal ? <UrgencyBadge signal={urgencySignal} /> : null}
                        </div>
                        {prediction ? (
                          <div className="dashboard-card-actions">
                            <button
                              type="button"
                              className="why-pick-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                const maxPct = Math.max(homePct, drawPct, awayPct);
                                const isHome = maxPct === homePct;
                                const isDraw = maxPct === drawPct;
                                setActiveExplanation(
                                  buildBobExplanation({
                                    sport: "soccer",
                                    selectionName: isHome ? game.home_team : isDraw ? "Draw" : game.away_team,
                                    opponentName: isHome ? game.away_team : isDraw ? `${game.home_team}/${game.away_team}` : game.home_team,
                                    probability: maxPct,
                                    fairOdds: isHome
                                      ? prediction.predictions.fair_odds_home
                                      : isDraw
                                      ? prediction.predictions.fair_odds_draw ?? 3.2
                                      : prediction.predictions.fair_odds_away,
                                    featureImpact: prediction.feature_impact,
                                    aiInsightsContext: prediction.ai_insights_context,
                                    modelMetadata: prediction.model_metadata,
                                  }),
                                );
                              }}
                            >
                              <Brain size={14} /> Explain Leans
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </ErrorBoundary>

              <div className="section-header" style={{ marginTop: "2rem" }}>
                <h3>⛳ Golf Tournament Previews</h3>
                <Link href="/golf" className="btn btn-sm btn-secondary">
                  View All <ChevronRight size={14} />
                </Link>
              </div>
              <ErrorBoundary sectionName="Dashboard Golf predictions">
                <div className="predictions-grid">
                  {golfTournaments.slice(0, 3).map((tournament) => {
                    const prediction = golfPredictions[tournament.tournament_id];
                    const picks = prediction?.predictions?.slice(0, 3) ?? [];
                    const confidenceSignal = prediction
                      ? getConfidenceSignal(prediction.ai_insights_context)
                      : null;
                    const urgencySignal = getUrgencySignal({
                      startTime: tournament.start_time,
                      eventDate: tournament.meeting_date,
                    });

                    return (
                      <div
                        key={tournament.tournament_id}
                        className="prediction-card"
                        onClick={() => router.push("/golf")}
                        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
                      >
                        <div className="prediction-card-header" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
                          <div>
                            <span className="prediction-venue">{tournament.name}</span>
                            <div className="prediction-card-signals" style={{ marginTop: "0.4rem" }}>
                              {confidenceSignal ? <ConfidenceBadge signal={confidenceSignal} /> : null}
                              {urgencySignal ? <UrgencyBadge signal={urgencySignal} /> : null}
                            </div>
                          </div>
                        </div>

                        {picks.length === 0 ? (
                          <div className="muted-copy" style={{ fontSize: "0.85rem" }}>
                            No player predictions simulated yet.
                          </div>
                        ) : (
                          <div className="prediction-picks" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {picks.map((pick, index) => {
                              const player = tournament.players.find(
                                (candidate) => candidate.player_id === pick.player_id,
                              );
                              return (
                                <div key={pick.player_id} className="pick-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <span className="pick-rank">{index + 1}</span>
                                    <span className="pick-name" style={{ fontWeight: 500 }}>{pick.name}</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <div className="pick-odds-group" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                      <span className="fair-odds" style={{ color: "var(--yellow)", fontSize: "0.85rem" }}>Fair: ${pick.fair_odds.toFixed(2)}</span>
                                      {player?.betfair_back_price ? (
                                        <span className="market-odds" style={{ fontSize: "0.75rem", opacity: 0.7 }}>Market: ${player.betfair_back_price.toFixed(2)}</span>
                                      ) : null}
                                    </div>
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <PaperBetAction
                                        bet={{
                                          sport: "golf",
                                          event_id: `${tournament.tournament_id}-${pick.player_id}`,
                                          event_name: tournament.name,
                                          selection: pick.name,
                                          odds: pick.fair_odds,
                                          bet_type: "win",
                                          stake: 10,
                                          odds_source: "model_fair",
                                          current_odds: pick.fair_odds,
                                          can_compare_odds: false,
                                          event_start_time: tournament.start_time,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ErrorBoundary>

              <div className="section-header" style={{ marginTop: "2rem" }}>
                <h3>🥊 MMA Predictions</h3>
                <Link href="/mma" className="btn btn-sm btn-secondary">
                  View All <ChevronRight size={14} />
                </Link>
              </div>
              <ErrorBoundary sectionName="Dashboard MMA predictions">
                <div className="predictions-grid">
                  {mmaMatchups.slice(0, 3).map((game) => {
                    const prediction = mmaPredictions[game.game_id];
                    const homePct = prediction?.predictions?.home_win_probability ?? 50;
                    const awayPct = prediction?.predictions?.away_win_probability ?? 50;
                    const homeWins = homePct > awayPct;
                    const confidenceSignal = prediction
                      ? getConfidenceSignal(prediction.ai_insights_context)
                      : null;
                    const urgencySignal = getUrgencySignal({
                      startTime: game.date,
                      isClosed: (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
                      isResultPending: (game.complete ?? 0) >= 100,
                    });

                    return (
                      <div
                        key={game.game_id}
                        className="prediction-card game-card-variant"
                        onClick={() => router.push("/mma")}
                      >
                        <div className="game-matchup">
                          <div className={`game-team ${homeWins ? "favoured" : ""}`}>
                            <span className="team-name">{game.home_team}</span>
                            <span className="team-prob">{homePct}%</span>
                            {prediction ? (
                              <div
                                onClick={(event) => event.stopPropagation()}
                                style={{ marginTop: "0.75rem" }}
                              >
                                <PaperBetAction
                                  bet={{
                                    sport: "mma",
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
                                    is_closed:
                                      (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                          <div className="game-vs">VS</div>
                          <div className={`game-team ${!homeWins ? "favoured" : ""}`}>
                            <span className="team-name">{game.away_team}</span>
                            <span className="team-prob">{awayPct}%</span>
                            {prediction ? (
                              <div
                                onClick={(event) => event.stopPropagation()}
                                style={{ marginTop: "0.75rem" }}
                              >
                                <PaperBetAction
                                  bet={{
                                    sport: "mma",
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
                                    is_closed:
                                      (game.complete ?? 0) > 0 && (game.complete ?? 0) < 100,
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="game-prob-bar">
                          <div className="prob-fill home" style={{ width: `${homePct}%` }} />
                          <div className="prob-fill away" style={{ width: `${awayPct}%` }} />
                        </div>
                        <div className="prediction-card-signals" style={{ marginTop: "0.9rem" }}>
                          {confidenceSignal ? <ConfidenceBadge signal={confidenceSignal} /> : null}
                          {urgencySignal ? <UrgencyBadge signal={urgencySignal} /> : null}
                        </div>
                        {prediction ? (
                          <div className="dashboard-card-actions">
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
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </ErrorBoundary>
            </>
          )}
        </>
      )}


      <div className="disclaimer">
        ⚠️ <strong>Disclaimer:</strong> This app is for information and tracking
        purposes only. We do not facilitate betting or handle payments.
        Predictions are generated by machine learning models and are not
        guarantees. Past performance does not indicate future results. Please
        gamble responsibly. If you need help, visit{" "}
        <a
          href="https://www.gamblinghelponline.org.au/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--yellow)", textDecoration: "underline" }}
        >
          Gambling Help Online
        </a>
        .
      </div>
    </div>
  );
}
