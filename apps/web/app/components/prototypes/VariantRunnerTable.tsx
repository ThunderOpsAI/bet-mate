"use client";
import React from "react";
import { Race, RacePrediction } from "../../lib/prototypes/prototypeData";
import { usePaperBetslip } from "../../providers/PaperBetslipProvider";
import { Flame, ShieldCheck } from "lucide-react";
import "./prototypes.css";

interface VariantRunnerTableProps {
  race: Race;
  prediction?: RacePrediction;
  variant: "a" | "b" | "c";
}

export default function VariantRunnerTable({ race, prediction, variant }: VariantRunnerTableProps) {
  const { addBet } = usePaperBetslip();

  const handleOddsClick = (horseName: string, odds: number, horseId: string) => {
    addBet(
      {
        sport: "racing",
        event_id: race.race_id,
        event_name: `${race.venue} R${race.race_number}`,
        selection_id: horseId,
        bet_type: "win",
        selection: horseName,
        odds: odds,
        stake: 10,
        odds_source: "market",
      },
      { openBetslip: true }
    );
  };

  return (
    <div className={`runner-table-container runner-table-variant-${variant}`}>
      <div className="runner-table-header">
        <span className="col-num">#</span>
        <span className="col-horse">RUNNER</span>
        <span className="col-form">FORM / JOCKEY</span>
        <span className="col-fair">MODEL FAIR</span>
        <span className="col-odds">WIN ODDS</span>
      </div>

      <div className="runner-list">
        {race.horses.map((horse, idx) => {
          const pred = prediction?.predictions.find((p) => p.horse_id === horse.horse_id);
          const fairOdds = pred?.fair_odds ? `$${pred.fair_odds.toFixed(2)}` : "-";
          const winOdds = horse.betfair_back_price ? `$${horse.betfair_back_price.toFixed(2)}` : "$5.00";
          const numericOdds = horse.betfair_back_price ?? 5.0;

          // EV & Confidence for Variant C
          const evScore = pred?.ev_score ?? (idx === 0 ? 14.5 : idx === 1 ? 8.2 : -5.0);
          const isPositiveEv = evScore > 0;

          return (
            <div key={horse.horse_id} className={`runner-row runner-row-${variant}`}>
              <div className="col-num">
                <span className="saddle-cloth">{idx + 1}</span>
              </div>

              <div className="col-horse">
                <div className="horse-name">{horse.name}</div>
                <div className="horse-meta">
                  Barrier {horse.barrier} • {horse.weight}kg
                </div>
              </div>

              <div className="col-form">
                <div className="jockey-name">{horse.jockey_name || "TBA"}</div>
                <div className="form-str">{horse.form || "12x3"}</div>
              </div>

              <div className="col-fair">
                <span className="fair-odds-tag">{fairOdds}</span>
              </div>

              <div className="col-odds">
                {/* Variant C: Integrated EV Signal Badge */}
                {variant === "c" && (
                  <div className={`ev-badge ${isPositiveEv ? "positive" : "negative"}`}>
                    {isPositiveEv ? <Flame size={10} /> : <ShieldCheck size={10} />}
                    <span>{isPositiveEv ? `+${evScore}% EV` : `${evScore}%`}</span>
                  </div>
                )}

                <button
                  type="button"
                  className={`odds-btn odds-btn-${variant}`}
                  onClick={() => handleOddsClick(horse.name, numericOdds, horse.horse_id)}
                >
                  <span className="odds-label">WIN</span>
                  <span className="odds-val">{winOdds}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { VariantRunnerTable };
