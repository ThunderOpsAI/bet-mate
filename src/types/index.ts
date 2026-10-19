export type SportCode = "racing" | "afl" | "nba" | "nrl" | "soccer" | "golf" | "mma";

export type RacingCode = "T" | "H" | "G"; // Thoroughbred, Harness, Greyhound

export type TrackCondition = "Fast" | "Good 4" | "Good 3" | "Soft 5" | "Soft 6" | "Heavy 8" | "Heavy 9";

export type SpeedMapPosition = "Leader" | "On Pace" | "Midfield" | "Backmarker";

export interface Runner {
  horse_id: string;
  saddlecloth: number;
  name: string;
  barrier: number;
  weight: number;
  jockey_name: string;
  trainer_name: string;
  past_win_rate: number;
  jockey_win_rate: number;
  track_condition_rating: number;
  days_since_last_race: number;
  speed_rating: number;
  speed_map_position: SpeedMapPosition;
  form: string;
  betfair_back_price: number;
  fair_odds: number;
  win_probability: number;
  edge_pct: number;
  data_quality?: "strong" | "moderate" | "thin";
  feature_impact?: Record<string, number>;
  notes?: string;
}

export interface Race {
  race_id: string;
  venue: string;
  race_number: number;
  distance: number;
  race_type: RacingCode;
  track_condition: TrackCondition;
  start_time: string; // ISO string
  meeting_date: string;
  prize_money: string;
  weather: string;
  horses: Runner[];
}

export interface SportMatchup {
  game_id: string;
  sport: SportCode;
  sport_label: string;
  home_team: string;
  away_team: string;
  venue: string;
  date: string; // ISO string
  status: "scheduled" | "live" | "completed";
  home_win_probability: number;
  away_win_probability: number;
  fair_odds_home: number;
  fair_odds_away: number;
  market_odds_home: number;
  market_odds_away: number;
  edge_home_pct: number;
  edge_away_pct: number;
  home_score?: number;
  away_score?: number;
  home_form?: string[];
  away_form?: string[];
  head_to_head_note?: string;
  player_props?: Array<{
    id: string;
    player_name: string;
    prop_type: string;
    line: string;
    market_odds: number;
    fair_odds: number;
    true_prob: number;
    edge_pct: number;
    correlation_group?: string;
  }>;
  feature_impact?: Record<string, number>;
  key_matchup_analysis?: string;
}

export interface EVLeg {
  id: string;
  sport: SportCode;
  game_context: string;
  market_type: string;
  selection: string;
  best_odds: number;
  true_prob: number;
  fair_odds: number;
  edge_pct: number;
  correlation_group?: string;
  confidence?: "high" | "medium" | "lean";
}

export interface SGMPriceResult {
  fair_probability: number;
  fair_odds: number;
  adjusted_probability: number;
  adjusted_odds: number;
  correlation_haircut: number;
  combined_odds: number;
  combined_edge_pct: number;
  expected_value_10: number;
  warnings: Array<{
    legA: string;
    legB: string;
    correlation: number;
    type: "conflict" | "synergy" | "neutral";
    message: string;
  }>;
}

export interface PaperBetItem {
  id: string;
  sport: SportCode;
  event_id: string;
  event_name: string;
  selection: string;
  bet_type: "win" | "place" | "prop" | "each-way" | "h2h" | "multi";
  odds: number;
  stake: number;
  fair_odds?: number;
  edge_pct?: number;
  added_at: string;
  status: "active" | "won" | "lost" | "void";
  payout?: number;
  settled_at?: string;
  settlement_notes?: string;
  notes?: string;
  probability?: number;
}

export interface BlackbookRule {
  id: string;
  target_name: string;
  entity_type: "RUNNER" | "JOCKEY" | "TRAINER" | "COMBINATION";
  sport: SportCode;
  bet_type: "win" | "place";
  stake: number;
  probability_threshold: number;
  notes: string;
  jockey_name?: string;
  trainer_name?: string;
  track_name?: string;
  metro_strike_rate?: number;
  roi_12m?: number;
  created_at: string;
  enabled: boolean;
  alerts: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

export interface SyndicateMember {
  id: string;
  username: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  buy_in_amount: number;
  joined_at: string;
}

export interface SyndicateLedgerEntry {
  id: string;
  type: "BUY_IN" | "PAPER_BET" | "DIVIDEND" | "ADJUSTMENT";
  amount: number;
  description: string;
  created_at: string;
  author: string;
}

export interface Syndicate {
  id: string;
  name: string;
  code: string;
  buy_in_tier: number;
  balance: number;
  max_stake_limit: number;
  members: SyndicateMember[];
  ledgers: SyndicateLedgerEntry[];
  created_at: string;
}

export interface QuantStrategy {
  id: string;
  name: string;
  description: string;
  tag: string;
  win_rate: number;
  yield_roi: number;
  total_trades: number;
  avg_odds: number;
  profit_100u: number;
  min_prob: number;
  min_edge: number;
  max_odds: number;
  staking_model: "Kelly (25%)" | "Flat 1.0u" | "Confidence Weighted";
  active: boolean;
}
