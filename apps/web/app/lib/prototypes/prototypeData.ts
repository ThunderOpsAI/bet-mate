export type Horse = {
  horse_id: string;
  name: string;
  barrier: number;
  weight: number;
  past_win_rate: number;
  jockey_win_rate: number;
  track_condition: number;
  days_since_last_race: number;
  betfair_back_price?: number;
  jockey_name?: string;
  trainer_name?: string;
  form?: string;
};

export type Race = {
  race_id: string;
  venue: string;
  race_number: number;
  distance: number;
  start_time: string;
  meeting_type: string;
  meeting_region: string;
  race_name: string;
  status: "open" | "closed" | "suspended";
  horses: Horse[];
};

export type Meeting = {
  venue: string;
  region: string;
  code: string;
  races: Race[];
};

export type Prediction = {
  horse_id: string;
  name: string;
  win_probability: number;
  fair_odds: number;
  ev_score: number;
  confidence_rating: "High" | "Medium" | "Low";
  urgency_signal: "Imminent" | "Normal";
};

export type RacePrediction = {
  race_id: string;
  predictions: Prediction[];
};

export const FALLBACK_MEETINGS: Meeting[] = [];

export function getMockPredictions(race: Race): RacePrediction {
  return { race_id: race.race_id, predictions: [] };
}
