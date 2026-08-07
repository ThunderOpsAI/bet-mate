"use client";

import { useState } from "react";
import { Bookmark, Check, Plus, User, Award, X } from "lucide-react";
import { useBlackbookQuickAdd } from "../../lib/useBlackbookQuickAdd";
import PaperBetAction from "../PaperBetAction";
import { usePaperBetslip } from "../../providers/PaperBetslipProvider";
import { getEdgePercent } from "../../lib/opportunityScore";
import { calculatePlaceOdds } from "./LiveOddsButton";

export type HorseData = {
  horse_id: string;
  name: string;
  barrier: number;
  weight: number;
  past_win_rate?: number;
  jockey_win_rate?: number;
  track_condition?: number;
  days_since_last_race?: number;
  betfair_back_price?: number;
  betfair_place_price?: number;
  betfair_implied_prob?: number;
  jockey_name?: string | null;
  trainer_name?: string | null;
  data_source?: "betfair" | "racing_australia";
};

export type RunnerPrediction = {
  horse_id: string;
  name: string;
  win_probability: number;
  fair_odds: number;
};

interface RunnerRowProps {
  horse?: HorseData;
  prediction?: RunnerPrediction;
  index: number;
  hasTopPrediction?: boolean;
  race: {
    race_id: string;
    venue: string;
    race_number: number;
    start_time?: string;
    meeting_date?: string;
  };
}

export default function RunnerRow({
  horse,
  prediction,
  index,
  hasTopPrediction = false,
  race,
}: RunnerRowProps) {
  const { isSaved, addToBlackbook } = useBlackbookQuickAdd();
  const { addBet } = usePaperBetslip();

  // State for Jockey/Trainer micro-modal
  const [microModalTarget, setMicroModalTarget] = useState<{
    name: string;
    type: "jockey" | "trainer";
  } | null>(null);

  const runnerName = prediction?.name || horse?.name || "Unknown Runner";
  const isHorseSaved = isSaved(runnerName);

  const jockeyName = horse?.jockey_name || null;
  const trainerName = horse?.trainer_name || null;

  const edgePercent =
    prediction && horse?.betfair_back_price
      ? getEdgePercent(prediction.fair_odds, horse.betfair_back_price)
      : null;
  const hasMarketPrice =
    typeof horse?.betfair_back_price === "number" &&
    horse.betfair_back_price > 1;

  const handleQuickAddHorse = () => {
    void addToBlackbook({
      runner: runnerName,
      type: "runner",
      sport: "racing",
    });
  };

  const addExoticRunner = (
    exotic_bet_type: "QUINELLA" | "EXACTA" | "TRIFECTA" | "FIRST4",
  ) => {
    addBet({
      sport: "racing",
      event_id: race.race_id,
      event_name: `${race.venue} R${race.race_number}`,
      selection_id: horse?.horse_id || runnerName,
      selection: runnerName,
      runner_name: runnerName,
      odds: 1,
      bet_type: `exotic_${exotic_bet_type.toLowerCase()}`,
      bet_family: "exotic",
      exotic_bet_type,
      stake: 10,
      odds_source: "missing",
      event_start_time: race.start_time,
      event_date: race.meeting_date,
    });
  };

  const handleQuickAddMicroTarget = () => {
    if (!microModalTarget) return;
    void addToBlackbook({
      runner: microModalTarget.name,
      type: microModalTarget.type,
      sport: "racing",
    });
    setMicroModalTarget(null);
  };

  return (
    <div
      className={`runner-row relative p-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        index < 3 && hasTopPrediction
          ? "runner-top border-purple-500/30 bg-purple-950/10"
          : ""
      }`}
    >
      {/* Left section: Rank/Barrier & Runner Details */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="runner-number flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 font-bold text-xs text-slate-300">
          <span
            className={`runner-rank ${index < 3 && hasTopPrediction ? `rank-${index + 1} text-amber-400` : ""}`}
          >
            {horse?.barrier ?? index + 1}
          </span>
        </div>

        <div className="runner-info flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="runner-name font-bold text-sm text-slate-100 truncate">
              {runnerName}
            </span>

            {/* Inline + Blackbook Button */}
            {isHorseSaved ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                <Check size={11} /> Saved ✓
              </span>
            ) : (
              <button
                type="button"
                onClick={handleQuickAddHorse}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-300 hover:text-purple-100 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 px-2 py-0.5 rounded-full transition-colors"
                title="Quick add horse to Blackbook"
              >
                <Plus size={11} /> Blackbook
              </button>
            )}
          </div>

          {/* Meta line: Jockey, Trainer, Barrier, Weight */}
          <div className="runner-meta flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
            {jockeyName ? (
              <button
                type="button"
                onClick={() =>
                  setMicroModalTarget({ name: jockeyName, type: "jockey" })
                }
                className="inline-flex items-center gap-1 text-slate-300 hover:text-purple-300 hover:underline cursor-pointer transition-colors"
                title="Click to bookmark Jockey to Blackbook"
              >
                <User size={11} className="text-slate-400" />
                <span>J: {jockeyName}</span>
                {isSaved(jockeyName) && (
                  <Check size={10} className="text-emerald-400 ml-0.5" />
                )}
              </button>
            ) : (
              <span className="text-slate-500">J: TBA</span>
            )}

            {trainerName ? (
              <button
                type="button"
                onClick={() =>
                  setMicroModalTarget({ name: trainerName, type: "trainer" })
                }
                className="inline-flex items-center gap-1 text-slate-300 hover:text-purple-300 hover:underline cursor-pointer transition-colors"
                title="Click to bookmark Trainer to Blackbook"
              >
                <Award size={11} className="text-slate-400" />
                <span>T: {trainerName}</span>
                {isSaved(trainerName) && (
                  <Check size={10} className="text-emerald-400 ml-0.5" />
                )}
              </button>
            ) : null}

            <span>B{horse?.barrier ?? "-"}</span>
            <span>{horse?.weight ? `${horse.weight}kg` : "-"}</span>

            {prediction && prediction.win_probability > 0 ? (
              <span className="runner-prob text-purple-400 font-semibold">
                {prediction.win_probability}% win
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Right section: Odds & Betslip Action */}
      <div className="runner-odds-section flex items-center justify-between md:justify-end gap-2.5 min-w-[200px]">
        <div className="hidden lg:flex items-center gap-1 mr-1">
          {(["QUINELLA", "EXACTA", "TRIFECTA", "FIRST4"] as const).map(
            (type) => (
              <button
                key={type}
                type="button"
                onClick={() => addExoticRunner(type)}
                className="px-2 py-1 rounded border border-amber-500/30 bg-amber-950/30 text-[10px] font-bold text-amber-200 hover:bg-amber-900/40"
                title={`Add ${runnerName} to ${type} exotic slip`}
              >
                {type === "FIRST4" ? "F4" : type.slice(0, 3)}
              </button>
            ),
          )}
        </div>
        {hasMarketPrice ? (
          <div className="runner-odds-buttons flex items-center gap-2">
            <PaperBetAction
              variant="odds-button"
              label={`WIN $${horse!.betfair_back_price!.toFixed(2)}`}
              loggedLabel="✓ WIN"
              cancelLabel="✕"
              openBetslipOnAdd={true}
              bet={{
                sport: "racing",
                event_id: race.race_id,
                event_name: `${race.venue} R${race.race_number}`,
                selection_id: horse?.horse_id || runnerName,
                selection: runnerName,
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
            <PaperBetAction
              variant="odds-button"
              label={`PLACE $${calculatePlaceOdds(horse!.betfair_back_price!, horse?.betfair_place_price).toFixed(2)}`}
              loggedLabel="✓ PLACE"
              cancelLabel="✕"
              openBetslipOnAdd={true}
              bet={{
                sport: "racing",
                event_id: race.race_id,
                event_name: `${race.venue} R${race.race_number}`,
                selection_id: horse?.horse_id || runnerName,
                selection: runnerName,
                odds: calculatePlaceOdds(
                  horse!.betfair_back_price!,
                  horse?.betfair_place_price,
                ),
                bet_type: "place",
                stake: 10,
                odds_source: "market",
                current_odds: calculatePlaceOdds(
                  horse!.betfair_back_price!,
                  horse?.betfair_place_price,
                ),
                can_compare_odds: true,
                event_start_time: race.start_time,
                event_date: race.meeting_date,
              }}
            />
          </div>
        ) : prediction && prediction.fair_odds > 0 ? (
          <div className="runner-odds-buttons flex items-center gap-2">
            <PaperBetAction
              variant="odds-button"
              label={`WIN $${prediction.fair_odds.toFixed(2)}`}
              loggedLabel="✓ WIN"
              cancelLabel="✕"
              openBetslipOnAdd={true}
              bet={{
                sport: "racing",
                event_id: race.race_id,
                event_name: `${race.venue} R${race.race_number}`,
                selection_id: horse?.horse_id || runnerName,
                selection: runnerName,
                odds: prediction.fair_odds,
                bet_type: "win",
                stake: 10,
                odds_source: "model_fair",
                current_odds: prediction.fair_odds,
                can_compare_odds: false,
                event_start_time: race.start_time,
                event_date: race.meeting_date,
              }}
            />
            <PaperBetAction
              variant="odds-button"
              label={`PLACE $${calculatePlaceOdds(prediction.fair_odds).toFixed(2)}`}
              loggedLabel="✓ PLACE"
              cancelLabel="✕"
              openBetslipOnAdd={true}
              bet={{
                sport: "racing",
                event_id: race.race_id,
                event_name: `${race.venue} R${race.race_number}`,
                selection_id: horse?.horse_id || runnerName,
                selection: runnerName,
                odds: prediction.fair_odds,
                bet_type: "place",
                stake: 10,
                odds_source: "model_fair",
                current_odds: calculatePlaceOdds(prediction.fair_odds),
                can_compare_odds: false,
                event_start_time: race.start_time,
                event_date: race.meeting_date,
              }}
            />
          </div>
        ) : (
          <span className="runner-odds-pending text-slate-500 text-sm">—</span>
        )}

        {edgePercent ? (
          <span className="runner-edge text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-1.5 py-0.5 rounded">
            +{edgePercent.toFixed(0)}%
          </span>
        ) : null}
      </div>

      {/* Quick-Add Micro-Modal for Jockey/Trainer */}
      {microModalTarget && (
        <div className="absolute top-0 left-0 w-full h-full bg-slate-950/90 backdrop-blur-xs rounded-lg z-20 flex items-center justify-between px-4 py-2 border border-purple-500/40 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Bookmark size={14} className="text-purple-400" />
            <span className="text-xs text-slate-200">
              Add{" "}
              <strong className="text-purple-300">
                {microModalTarget.name}
              </strong>{" "}
              ({microModalTarget.type}) to Blackbook?
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isSaved(microModalTarget.name) ? (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <Check size={12} /> Saved ✓
              </span>
            ) : (
              <button
                type="button"
                onClick={handleQuickAddMicroTarget}
                className="btn btn-xs btn-primary text-xs bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 rounded"
              >
                + Add
              </button>
            )}
            <button
              type="button"
              onClick={() => setMicroModalTarget(null)}
              className="text-slate-400 hover:text-slate-200 p-1"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
