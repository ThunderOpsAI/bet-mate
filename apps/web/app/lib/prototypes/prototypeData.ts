export interface HorseData {
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
  trainer_name?: string | null;
  form?: string;
}

export interface Race {
  race_id: string;
  venue: string;
  race_number: number;
  distance: number;
  start_time?: string;
  meeting_type?: "metro" | "provincial" | "country" | "unknown";
  meeting_region?: string;
  meeting_date?: string;
  race_name?: string;
  status?: "open" | "closed" | "resulted";
  horses: HorseData[];
}

export interface Prediction {
  horse_id: string;
  name: string;
  win_probability: number;
  fair_odds: number;
  ev_score?: number;
  confidence_rating?: "High" | "Medium" | "Low";
  urgency_signal?: "Imminent" | "Upcoming" | "Normal";
}

export interface RacePrediction {
  race_id: string;
  predictions: Prediction[];
}

export interface Meeting {
  venue: string;
  region: string;
  code: "T" | "G" | "H";
  races: Race[];
}

export const FALLBACK_MEETINGS: Meeting[] = [
  {
    venue: "Flemington",
    region: "VIC",
    code: "T",
    races: [
      {
        race_id: "flem-r1",
        venue: "Flemington",
        race_number: 1,
        distance: 1200,
        start_time: new Date(Date.now() + 15 * 60000).toISOString(),
        meeting_type: "metro",
        meeting_region: "VIC",
        race_name: "3YO Handicap",
        status: "open",
        horses: [
          { horse_id: "h1", name: "Bold Command", barrier: 1, weight: 58.5, past_win_rate: 0.35, jockey_win_rate: 0.18, track_condition: 2, days_since_last_race: 14, betfair_back_price: 3.20, jockey_name: "J. Kah", trainer_name: "C. Maher", form: "112x1" },
          { horse_id: "h2", name: "Shadow King", barrier: 4, weight: 56.0, past_win_rate: 0.28, jockey_win_rate: 0.15, track_condition: 2, days_since_last_race: 21, betfair_back_price: 4.80, jockey_name: "D. Lane", trainer_name: "J. Cummings", form: "314x2" },
          { horse_id: "h3", name: "Apex Warrior", barrier: 2, weight: 57.0, past_win_rate: 0.22, jockey_win_rate: 0.14, track_condition: 2, days_since_last_race: 7, betfair_back_price: 6.50, jockey_name: "C. Williams", trainer_name: "M. Price", form: "22134" },
          { horse_id: "h4", name: "Velocita", barrier: 5, weight: 55.0, past_win_rate: 0.18, jockey_win_rate: 0.12, track_condition: 2, days_since_last_race: 28, betfair_back_price: 9.00, jockey_name: "B. Shinn", trainer_name: "A. Neasham", form: "4512x" },
          { horse_id: "h5", name: "Star Sentinel", barrier: 3, weight: 54.0, past_win_rate: 0.12, jockey_win_rate: 0.10, track_condition: 2, days_since_last_race: 35, betfair_back_price: 15.00, jockey_name: "M. Dee", trainer_name: "G. Waterhouse", form: "6x342" },
        ]
      },
      {
        race_id: "flem-r2",
        venue: "Flemington",
        race_number: 2,
        distance: 1400,
        start_time: new Date(Date.now() + 50 * 60000).toISOString(),
        meeting_type: "metro",
        meeting_region: "VIC",
        race_name: "BM84 Handicap",
        status: "open",
        horses: [
          { horse_id: "h6", name: "Ironclad Spirit", barrier: 3, weight: 59.0, past_win_rate: 0.40, jockey_win_rate: 0.20, track_condition: 2, days_since_last_race: 14, betfair_back_price: 2.80, jockey_name: "J. McDonald", trainer_name: "C. Waller", form: "111x2" },
          { horse_id: "h7", name: "Northern Glow", barrier: 1, weight: 55.5, past_win_rate: 0.25, jockey_win_rate: 0.16, track_condition: 2, days_since_last_race: 12, betfair_back_price: 5.50, jockey_name: "J. Kah", trainer_name: "M. Freedman", form: "2131" },
          { horse_id: "h8", name: "Desert Storm", barrier: 6, weight: 57.0, past_win_rate: 0.20, jockey_win_rate: 0.13, track_condition: 2, days_since_last_race: 18, betfair_back_price: 7.00, jockey_name: "C. Williams", trainer_name: "P. Moody", form: "43211" },
          { horse_id: "h9", name: "Golden Monarch", barrier: 2, weight: 54.5, past_win_rate: 0.15, jockey_win_rate: 0.11, track_condition: 2, days_since_last_race: 30, betfair_back_price: 12.00, jockey_name: "D. Lane", trainer_name: "K. Lees", form: "56x14" },
        ]
      },
      {
        race_id: "flem-r3",
        venue: "Flemington",
        race_number: 3,
        distance: 1600,
        start_time: new Date(Date.now() + 85 * 60000).toISOString(),
        meeting_type: "metro",
        meeting_region: "VIC",
        race_name: "VRC Spring Trophy",
        status: "open",
        horses: [
          { horse_id: "h10", name: "Titanium Knight", barrier: 2, weight: 58.0, past_win_rate: 0.32, jockey_win_rate: 0.19, track_condition: 2, days_since_last_race: 10, betfair_back_price: 3.60, jockey_name: "B. Shinn", trainer_name: "C. Maher", form: "1214" },
          { horse_id: "h11", name: "Royal Sapphire", barrier: 5, weight: 56.5, past_win_rate: 0.27, jockey_win_rate: 0.15, track_condition: 2, days_since_last_race: 14, betfair_back_price: 4.20, jockey_name: "M. Dee", trainer_name: "A. & S. Freedman", form: "3121" },
        ]
      }
    ]
  },
  {
    venue: "Randwick",
    region: "NSW",
    code: "T",
    races: [
      {
        race_id: "rand-r1",
        venue: "Randwick",
        race_number: 1,
        distance: 1000,
        start_time: new Date(Date.now() + 25 * 60000).toISOString(),
        meeting_type: "metro",
        meeting_region: "NSW",
        race_name: "2YO Sprint",
        status: "open",
        horses: [
          { horse_id: "hr1", name: "Cyber Streak", barrier: 1, weight: 57.0, past_win_rate: 0.45, jockey_win_rate: 0.22, track_condition: 2, days_since_last_race: 14, betfair_back_price: 2.50, jockey_name: "J. McDonald", trainer_name: "C. Waller", form: "11" },
          { horse_id: "hr2", name: "Vanguard", barrier: 3, weight: 56.0, past_win_rate: 0.30, jockey_win_rate: 0.17, track_condition: 2, days_since_last_race: 10, betfair_back_price: 4.00, jockey_name: "T. Berry", trainer_name: "G. Waterhouse", form: "21" },
          { horse_id: "hr3", name: "Midnight Echo", barrier: 2, weight: 54.5, past_win_rate: 0.20, jockey_win_rate: 0.12, track_condition: 2, days_since_last_race: 20, betfair_back_price: 8.50, jockey_name: "K. McEvoy", trainer_name: "P. & P. Snowden", form: "34" },
        ]
      },
      {
        race_id: "rand-r2",
        venue: "Randwick",
        race_number: 2,
        distance: 1200,
        start_time: new Date(Date.now() + 60 * 60000).toISOString(),
        meeting_type: "metro",
        meeting_region: "NSW",
        race_name: "Silver Slipper Prelude",
        status: "open",
        horses: [
          { horse_id: "hr4", name: "Apex Thunder", barrier: 4, weight: 58.0, past_win_rate: 0.33, jockey_win_rate: 0.18, track_condition: 2, days_since_last_race: 14, betfair_back_price: 3.10, jockey_name: "J. McDonald", trainer_name: "C. Waller", form: "121" },
          { horse_id: "hr5", name: "Solar Flare", barrier: 2, weight: 55.0, past_win_rate: 0.25, jockey_win_rate: 0.14, track_condition: 2, days_since_last_race: 21, betfair_back_price: 5.00, jockey_name: "Z. Purton", trainer_name: "J. Pride", form: "312" },
        ]
      }
    ]
  },
  {
    venue: "Eagle Farm",
    region: "QLD",
    code: "T",
    races: [
      {
        race_id: "ef-r1",
        venue: "Eagle Farm",
        race_number: 1,
        distance: 1300,
        start_time: new Date(Date.now() + 35 * 60000).toISOString(),
        meeting_type: "metro",
        meeting_region: "QLD",
        race_name: "Brisbane Mile Qualifier",
        status: "open",
        horses: [
          { horse_id: "he1", name: "Sunshine Express", barrier: 2, weight: 57.5, past_win_rate: 0.38, jockey_win_rate: 0.19, track_condition: 2, days_since_last_race: 14, betfair_back_price: 2.90, jockey_name: "R. Maloney", trainer_name: "T. Gollan", form: "113" },
          { horse_id: "he2", name: "Queenslander", barrier: 1, weight: 56.0, past_win_rate: 0.28, jockey_win_rate: 0.15, track_condition: 2, days_since_last_race: 18, betfair_back_price: 4.50, jockey_name: "B. Thompson", trainer_name: "R. Heathcote", form: "214" },
        ]
      }
    ]
  },
  {
    venue: "Albion Park",
    region: "QLD",
    code: "H",
    races: [
      {
        race_id: "alb-r1",
        venue: "Albion Park",
        race_number: 1,
        distance: 1660,
        start_time: new Date(Date.now() + 40 * 60000).toISOString(),
        meeting_type: "metro",
        meeting_region: "QLD",
        race_name: "Pacing Championship",
        status: "open",
        horses: [
          { horse_id: "ha1", name: "Leap To Fame", barrier: 1, weight: 0, past_win_rate: 0.85, jockey_win_rate: 0.40, track_condition: 1, days_since_last_race: 7, betfair_back_price: 1.35, jockey_name: "G. Dixon", trainer_name: "G. Dixon", form: "11111" },
          { horse_id: "ha2", name: "Swayzee", barrier: 2, weight: 0, past_win_rate: 0.60, jockey_win_rate: 0.30, track_condition: 1, days_since_last_race: 14, betfair_back_price: 3.80, jockey_name: "C. Geary", trainer_name: "J. Grimson", form: "12112" },
        ]
      }
    ]
  },
  {
    venue: "Angle Park",
    region: "SA",
    code: "G",
    races: [
      {
        race_id: "ap-r1",
        venue: "Angle Park",
        race_number: 1,
        distance: 530,
        start_time: new Date(Date.now() + 10 * 60000).toISOString(),
        meeting_type: "metro",
        meeting_region: "SA",
        race_name: "Sprint Grade 5",
        status: "open",
        horses: [
          { horse_id: "g1", name: "Victa Damian", barrier: 1, weight: 32.5, past_win_rate: 0.70, jockey_win_rate: 0, track_condition: 1, days_since_last_race: 5, betfair_back_price: 1.80, form: "11121" },
          { horse_id: "g2", name: "Adhana Zip", barrier: 2, weight: 28.0, past_win_rate: 0.45, jockey_win_rate: 0, track_condition: 1, days_since_last_race: 7, betfair_back_price: 4.20, form: "2131" },
        ]
      }
    ]
  }
];

export function getMockPredictions(race: Race): RacePrediction {
  const totalImplied = race.horses.reduce((sum, h) => sum + (h.betfair_back_price ? (1 / h.betfair_back_price) : 0.1), 0);
  const predictions: Prediction[] = race.horses.map((h, idx) => {
    const rawProb = h.betfair_back_price ? (1 / h.betfair_back_price) / totalImplied : (0.5 / (idx + 1));
    // Apply slight model edge
    const modelProb = Math.min(0.95, Math.max(0.05, rawProb * (idx === 0 ? 1.15 : 0.95)));
    const fairOdds = Number((1 / modelProb).toFixed(2));
    const marketOdds = h.betfair_back_price ?? (fairOdds * 1.1);
    const ev = Number((((modelProb * marketOdds) - 1) * 100).toFixed(1));
    return {
      horse_id: h.horse_id,
      name: h.name,
      win_probability: Number(modelProb.toFixed(3)),
      fair_odds: fairOdds,
      ev_score: ev,
      confidence_rating: modelProb > 0.35 ? "High" : modelProb > 0.20 ? "Medium" : "Low",
      urgency_signal: idx === 0 ? "Imminent" : "Normal"
    };
  });
  return { race_id: race.race_id, predictions };
}
