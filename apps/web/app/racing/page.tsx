"use client";
import { useEffect, useState } from "react";
import { Brain, Trophy, MapPin, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import Link from "next/link";
import RecommendationDisclaimer, { RECOMMENDATION_DISCLAIMER } from "../components/RecommendationDisclaimer";
import { ML_API } from "../lib/mlApi";

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
  feature_impact: Record<string, number>;
  ai_insights_context: string;
};

const trackConditions: Record<number, string> = {
  1: "Fast",
  2: "Good",
  3: "Soft",
  4: "Heavy"
};

export default function RacingPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [predictions, setPredictions] = useState<Record<string, RacePrediction>>({});
  const [loading, setLoading] = useState(true);
  const [expandedRace, setExpandedRace] = useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${ML_API}/api/races/today`);
        const data = await res.json();
        const fetchedRaces: Race[] = data?.races ?? [];
        setRaces(fetchedRaces);

        // Fetch predictions for ALL races
        const predsMap: Record<string, RacePrediction> = {};
        await Promise.all(
          fetchedRaces.map(async (race) => {
            try {
              const predRes = await fetch(`${ML_API}/api/predict/racing`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(race),
              });
              if (predRes.ok) {
                predsMap[race.race_id] = await predRes.json();
              }
            } catch { /* skip */ }
          })
        );
        setPredictions(predsMap);
      } catch (e) {
        console.error("Failed to load racing data:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <Trophy size={48} />
          <p>Running XGBoost Racing Model...</p>
        </div>
      </div>
    );
  }

  const venues = Array.from(new Set(races.map(r => r.venue)));
  const filteredRaces = selectedVenue === "all" ? races : races.filter(r => r.venue === selectedVenue);

  return (
    <div>
      {/* Venue Filter */}
      <div className="filter-bar">
        <button
          className={`filter-chip ${selectedVenue === "all" ? "active" : ""}`}
          onClick={() => setSelectedVenue("all")}
        >
          All Venues
        </button>
        {venues.map(v => (
          <button
            key={v}
            className={`filter-chip ${selectedVenue === v ? "active" : ""}`}
            onClick={() => setSelectedVenue(v)}
          >
            <MapPin size={12} /> {v}
          </button>
        ))}
      </div>

      {/* Race Cards */}
      <div className="race-list">
        {filteredRaces.map(race => {
          const pred = predictions[race.race_id];
          const top3 = pred?.predictions?.slice(0, 3) ?? [];
          const isExpanded = expandedRace === race.race_id;

          return (
            <div key={race.race_id} className={`race-detail-card ${isExpanded ? "expanded" : ""}`}>
              <div
                className="race-detail-header"
                onClick={() => setExpandedRace(isExpanded ? null : race.race_id)}
              >
                <div className="race-detail-title">
                  <span className="race-venue-badge">{race.venue}</span>
                  <span className="race-number-lg">R{race.race_number}</span>
                  <span className="badge badge-accent">{race.distance}m</span>
                  <span className="badge badge-muted">{race.horses.length} runners</span>
                  <span className="badge badge-blue">{trackConditions[race.horses[0]?.track_condition] ?? "Good"}</span>
                  {race.meeting_type && race.meeting_type !== "unknown" && (
                    <span className="badge badge-green">{race.meeting_type.toUpperCase()}</span>
                  )}
                  {race.meeting_region && race.meeting_region !== "unknown" && (
                    <span className="badge badge-muted">{race.meeting_region}</span>
                  )}
                  {race.meeting_date && (
                    <span className="badge badge-muted">{race.meeting_date}</span>
                  )}
                </div>
                <div className="race-detail-preview">
                  {top3.map((p, i) => (
                    <span key={p.horse_id} className={`preview-pick rank-${i + 1}-text`}>
                      {i + 1}. {p.name} ({p.win_probability}%)
                    </span>
                  ))}
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {isExpanded && pred && (
                <div className="race-detail-body">
                  {/* Full Field */}
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
                        {pred.predictions.map((p, i) => {
                          const horse = race.horses.find(h => h.horse_id === p.horse_id);
                          return (
                            <tr key={p.horse_id} className={i < 3 ? `top-pick-row rank-${i+1}-row` : ""}>
                              <td><span className={`pick-rank rank-${Math.min(i + 1, 4)}`}>{i + 1}</span></td>
                              <td className="horse-name-cell">{p.name}</td>
                              <td>{horse?.jockey_name ?? "TBA"}</td>
                              <td>{horse?.barrier ?? "-"}</td>
                              <td>{horse?.weight ?? "-"}kg</td>
                              <td>{((horse?.past_win_rate ?? 0) * 100).toFixed(1)}%</td>
                              <td>{((horse?.jockey_win_rate ?? 0) * 100).toFixed(1)}%</td>
                              <td>{formatMarketPrice(horse)}</td>
                              <td>
                                <span className={`prob-badge ${i === 0 ? "prob-top" : ""}`}>
                                  {p.win_probability}%
                                </span>
                              </td>
                              <td className="fair-odds">${p.fair_odds}</td>
                              <td>
                                <Link
                                  className="btn btn-sm btn-secondary"
                                  href={paperBetHref({
                                    sport: "racing",
                                    eventId: race.race_id,
                                    eventName: `${race.venue} R${race.race_number}`,
                                    selection: p.name,
                                    odds: p.fair_odds,
                                    betType: "win",
                                  })}
                                >
                                  Paper Bet
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Feature Impact */}
                  <div className="feature-impact-section">
                    <h4><BarChart3 size={16} /> ML Feature Impact</h4>
                    <div className="feature-bars">
                      {Object.entries(pred.feature_impact)
                        .sort(([, a], [, b]) => b - a)
                        .map(([feature, importance]) => (
                          <div key={feature} className="feature-bar-row">
                            <span className="feature-label">{formatFeatureName(feature)}</span>
                            <div className="feature-bar-track">
                              <div
                                className="feature-bar-fill"
                                style={{ width: `${(importance / Math.max(...Object.values(pred.feature_impact))) * 100}%` }}
                              />
                            </div>
                            <span className="feature-value">{(importance * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* AI Insight */}
                  {pred.ai_insights_context && (
                    <div className="ai-insight-card">
                      <Brain size={16} />
                      <span>{pred.ai_insights_context}</span>
                    </div>
                  )}
                </div>
              )}
              <RecommendationDisclaimer compact />
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="disclaimer">
        <strong>Disclaimer:</strong> {RECOMMENDATION_DISCLAIMER} Predictions are generated by XGBoost machine learning models trained on historical patterns and are not guarantees.
      </div>
    </div>
  );
}

function formatFeatureName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatMarketPrice(horse?: HorseData): string {
  if (!horse?.betfair_back_price || horse.betfair_back_price <= 1) {
    return "-";
  }

  return `$${horse.betfair_back_price.toFixed(2)}`;
}

function paperBetHref(params: {
  sport: string;
  eventId: string;
  eventName: string;
  selection: string;
  odds: number;
  betType: string;
}): string {
  const search = new URLSearchParams({
    sport: params.sport,
    event_id: params.eventId,
    event_name: params.eventName,
    selection: params.selection,
    odds: String(params.odds),
    bet_type: params.betType,
  });

  return `/bets/new?${search.toString()}`;
}
