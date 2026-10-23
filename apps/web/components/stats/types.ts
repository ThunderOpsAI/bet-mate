export interface HitRateStats {
  totalGames: number;
  hits: number;
  overs: number;
  unders: number;
  pushes: number;
  hitRate: number; // 0 to 100
  averageValue: number;
  values?: number[];
}

export interface PlayerHitRatesData {
  l5?: HitRateStats;
  l10?: HitRateStats;
  l20?: HitRateStats;
  season?: HitRateStats;
  vsOpponent?: HitRateStats;
}

export interface PlayerProfile {
  id: string;
  externalId?: string;
  fullName: string;
  team: string;
  position?: string;
  jerseyNum?: number | string;
  sport?: string;
  status?: string;
}

export interface PropOdds {
  id?: string;
  bookmaker?: string;
  selection: "Over" | "Under" | string;
  price: number;
  fairPrice?: number | null;
  edgePct?: number | null;
  trueProb?: number | null;
  capturedAt?: string;
}

export interface PlayerProp {
  id: string;
  sport: string;
  gameId: string;
  marketType: string;
  line: number;
  status?: string;
  matchup?: string; // e.g. "BOS vs MIA" or "@ MIA"
  gameDate?: string;
  player: PlayerProfile;
  hitRate?: HitRateStats | null;
  hitRates?: PlayerHitRatesData | null;
  bestOdds?: PropOdds | null;
  odds?: PropOdds[];
  defenseVsPosition?: {
    rank: number;
    totalTeams: number;
    position?: string;
    concededAvg?: number;
  } | null;
}

export interface DefenseVsPositionData {
  team: string;
  position: string;
  rank: number;
  totalTeams: number;
  sampleGames?: number;
  avgConceded?: number;
  sport?: string;
  metricAverages?: Record<string, number>;
}

export interface PlayerComparisonStatGroup {
  games: number;
  minutes: number;
  averages: Record<string, number>;
}

export interface PlayerComparisonProfile {
  profile: PlayerProfile;
  seasonStats: PlayerComparisonStatGroup;
  l5Stats: PlayerComparisonStatGroup;
  homeAwaySplits: {
    home: PlayerComparisonStatGroup;
    away: PlayerComparisonStatGroup;
  };
}

export interface PlayerComparisonData {
  playerA: PlayerComparisonProfile;
  playerB: PlayerComparisonProfile;
  headToHead?: Array<{
    gameId: string;
    gameDate?: string;
    playerAStats: { minutes?: number; stats?: Record<string, any> };
    playerBStats: { minutes?: number; stats?: Record<string, any> };
  }>;
}

export interface PropsFilterState {
  sport: string; // "ALL", "NBA", "AFL", "NRL", "NFL", "SOCCER"
  marketType: string; // "ALL", "POINTS", "DISPOSALS", "REBOUNDS", etc.
  minEdge: number; // e.g. 0 to 25
  minHitRate: number; // e.g. 0, 50, 60, 70, 80
  searchQuery: string;
}
