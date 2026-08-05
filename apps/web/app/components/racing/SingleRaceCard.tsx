"use client";
import { useState } from "react";
import PaperBetAction from "../PaperBetAction";
import { ConfidenceBadge, UrgencyBadge } from "../PredictionSignalBadges";
import { getEdgePercent } from "../../lib/opportunityScore";
import { getConfidenceSignal, getUrgencySignal } from "../../lib/predictionSignals";
import type { BobExplanation, FeatureImpactItem, ModelMetadata } from "../../lib/bob/explainer";

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
  ai_insights_context?: { data_quality?: "strong" | "moderate" | "thin"; calibration_confidence?: number; market_agreement?: boolean; notes?: string[] } | string;
  model_metadata?: ModelMetadata;
};

interface RaceData {
  race_id: string;
  venue: string;
  race_number: number;
  distance: number;
  start_time?: string;
  meeting_type?: string;
  meeting_region?: string;
  meeting_date?: string;
  horses: HorseData[];
}

interface SingleRaceCardProps {
  race: RaceData;
  prediction?: RacePrediction | null;
  siblingRaces: { race_id: string; race_number: number }[];
  onSwitchRace: (raceId: string) => void;
  onExplain: (explanation: BobExplanation) => void;
}

const trackConditions: Record<number, string> = { 1: "Fast", 2: "Good", 3: "Soft", 4: "Heavy" };

export default function SingleRaceCard({ race, prediction, siblingRaces, onSwitchRace }: SingleRaceCardProps) {
  const [activeTab, setActiveTab] = useState<"win" | "multi" | "exotics">("win");
  const sorted = [...siblingRaces].sort((a, b) => a.race_number - b.race_number);
  const trackCond = race.horses[0]?.track_condition;
  const confidenceSignal = prediction ? getConfidenceSignal(prediction.ai_insights_context) : null;
  const urgencySignal = getUrgencySignal({ startTime: race.start_time, eventDate: race.meeting_date });

  return (
    <div className="single-race-card">
      {/* Race switcher bar */}
      <div className="race-switcher-bar">
        {sorted.map((r) => (
          <button
            key={r.race_id}
            type="button"
            className={`race-switcher-chip ${r.race_id === race.race_id ? "active" : ""}`}
            onClick={() => onSwitchRace(r.race_id)}
          >
            R{r.race_number}
          </button>
        ))}
      </div>

      {/* Race info header */}
      <div className="single-race-info">
        <h3 className="single-race-title">
          {race.venue} — Race {race.race_number}
        </h3>
        <div className="single-race-badges">
          <span className="badge badge-accent">{race.distance}m</span>
          {trackCond ? <span className="badge badge-blue">{trackConditions[trackCond] ?? "Good"}</span> : null}
          <span className="badge badge-muted">{race.horses.length} runners</span>
          {race.meeting_type && race.meeting_type !== "unknown" ? (
            <span className="badge badge-green">{race.meeting_type.toUpperCase()}</span>
          ) : null}
          {confidenceSignal ? <ConfidenceBadge signal={confidenceSignal} /> : null}
          {urgencySignal ? <UrgencyBadge signal={urgencySignal} /> : null}
        </div>
      </div>

      {/* Betting tabs */}
      <div className="race-bet-tabs">
        <button type="button" className={`race-bet-tab ${activeTab === "win" ? "active" : ""}`} onClick={() => setActiveTab("win")}>
          Win / Place
        </button>
        <button type="button" className={`race-bet-tab ${activeTab === "multi" ? "active" : ""}`} onClick={() => setActiveTab("multi")}>
          Same Race Multi
        </button>
        <button type="button" className={`race-bet-tab ${activeTab === "exotics" ? "active" : ""}`} onClick={() => setActiveTab("exotics")}>
          Exotics
        </button>
      </div>

      {/* Runner list */}
      {activeTab === "win" ? (
        <div className="runner-list">
          {(prediction?.predictions ?? race.horses.map((h) => ({ horse_id: h.horse_id, name: h.name, win_probability: 0, fair_odds: 0 }))).map((pick, index) => {
            const horse = race.horses.find((h) => h.horse_id === pick.horse_id);
            const edgePercent = getEdgePercent(pick.fair_odds, horse?.betfair_back_price);
            const hasMarketPrice = typeof horse?.betfair_back_price === "number" && horse.betfair_back_price > 1;

            return (
              <div key={pick.horse_id} className={`runner-row ${index < 3 && prediction ? "runner-top" : ""}`}>
                <div className="runner-number">
                  <span className={`runner-rank ${index < 3 && prediction ? `rank-${index + 1}` : ""}`}>
                    {horse?.barrier ?? index + 1}
                  </span>
                </div>
                <div className="runner-info">
                  <div className="runner-name">{pick.name}</div>
                  <div className="runner-meta">
                    <span>{horse?.jockey_name ?? "TBA"}</span>
                    <span>B{horse?.barrier ?? "-"}</span>
                    <span>{horse?.weight ?? "-"}kg</span>
                    {pick.win_probability > 0 ? (
                      <span className="runner-prob">{pick.win_probability}%</span>
                    ) : null}
                  </div>
                </div>
                <div className="runner-odds-section">
                  {hasMarketPrice ? (
                    <div className="runner-odds-buttons">
                      <PaperBetAction
                        variant="odds-button"
                        label={`$${horse!.betfair_back_price!.toFixed(2)}`}
                        loggedLabel="✓"
                        cancelLabel="✕"
                        openBetslipOnAdd={true}
                        bet={{
                          sport: "racing",
                          event_id: race.race_id,
                          event_name: `${race.venue} R${race.race_number}`,
                          selection_id: pick.horse_id,
                          selection: pick.name,
                          odds: horse!.betfair_back_price!,
                          bet_type: "win",
                          stake: 10,
                          odds_source: "market",
                          current_odds: horse!.betfair_back_price,
                          can_compare_odds: true,
                          event_start_time: race.start_time,
                          event_date: race.meeting_date,
                        }}
                      />
                    </div>
                  ) : pick.fair_odds > 0 ? (
                    <div className="runner-odds-buttons">
                      <PaperBetAction
                        variant="odds-button"
                        label={`$${pick.fair_odds.toFixed(2)}`}
                        loggedLabel="✓"
                        cancelLabel="✕"
                        openBetslipOnAdd={true}
                        bet={{
                          sport: "racing",
                          event_id: race.race_id,
                          event_name: `${race.venue} R${race.race_number}`,
                          selection_id: pick.horse_id,
                          selection: pick.name,
                          odds: pick.fair_odds,
                          bet_type: "win",
                          stake: 10,
                          odds_source: "model_fair",
                          current_odds: pick.fair_odds,
                          can_compare_odds: false,
                          event_start_time: race.start_time,
                          event_date: race.meeting_date,
                        }}
                      />
                    </div>
                  ) : (
                    <span className="runner-odds-pending">—</span>
                  )}
                  {edgePercent ? (
                    <span className="runner-edge">+{edgePercent.toFixed(0)}%</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="race-tab-placeholder">
          <p className="muted-copy">Same Race Multi and Exotics are coming soon.</p>
        </div>
      )}
    </div>
  );
}
