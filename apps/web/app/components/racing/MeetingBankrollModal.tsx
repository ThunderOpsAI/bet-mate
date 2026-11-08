"use client";

import React, { useState } from "react";
import {
  X,
  DollarSign,
  Sparkles,
  Trophy,
  Sliders,
  CheckCircle2,
  Layers,
  Zap,
} from "lucide-react";
import { usePaperBetslip } from "../../providers/PaperBetslipProvider";

interface MeetingBankrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingName: string;
  races: Array<{
    race_id: string;
    race_number: number;
    horses: Array<{ name: string; betfair_back_price?: number }>;
  }>;
}

export default function MeetingBankrollModal({
  isOpen,
  onClose,
  meetingName,
  races,
}: MeetingBankrollModalProps) {
  const { addBet, addToast } = usePaperBetslip();
  const [strategyType, setStrategyType] = useState<
    "balanced_100" | "banker_hammer" | "exotic_quaddie" | "custom"
  >("balanced_100");
  const [bankerRaceNum, setBankerRaceNum] = useState<number>(races[0]?.race_number || 1);
  const [isDeployed, setIsDeployed] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleDeploy = () => {
    if (strategyType === "balanced_100") {
      // $100 per race across up to 10 races = $1000 total spend
      const perRaceBudget = Math.floor(1000 / Math.max(1, races.length));
      races.forEach((r) => {
        const topHorse = r.horses[0]?.name || `Race ${r.race_number} Top Pick`;
        const odds = r.horses[0]?.betfair_back_price || 3.0;
        addBet({
          sport: "racing",
          event_id: r.race_id,
          event_name: `${meetingName} R${r.race_number}`,
          selection: topHorse,
          bet_type: "WIN",
          odds,
          stake: perRaceBudget,
          notes: `$1,000 Meeting Strategy: Balanced Race Allocator ($${perRaceBudget}/race)`,
        });
      });
      addToast(`Deployed $1,000 Meeting Bankroll across ${races.length} races`, "success");
    } else if (strategyType === "banker_hammer") {
      // $1,000 on the nose on the standout anchor
      const targetRace = races.find((r) => r.race_number === bankerRaceNum) || races[0];
      const topHorse = targetRace?.horses[0]?.name || "Standout Anchor";
      const odds = targetRace?.horses[0]?.betfair_back_price || 2.40;
      addBet({
        sport: "racing",
        event_id: targetRace?.race_id || "race-banker",
        event_name: `${meetingName} R${targetRace?.race_number}`,
        selection: topHorse,
        bet_type: "WIN",
        odds,
        stake: 1000.0,
        notes: `$1,000 Meeting Strategy: 'On The Nose' Hammer Bet on ${topHorse}`,
      });
      addToast(`Deployed $1,000 on the nose on ${topHorse} (R${targetRace?.race_number})!`, "success");
    } else if (strategyType === "exotic_quaddie") {
      // $500 Quaddie + 2x $250 Standout Straight Trifectas
      addBet({
        sport: "racing",
        event_id: `meeting-${meetingName}-quaddie`,
        event_name: `${meetingName} Quaddie`,
        selection: `Major Quaddie: Top 2 Selections Races 7-10 (16 combos)`,
        bet_type: "QUADDIE",
        odds: 45.0,
        stake: 500.0,
        notes: `$1,000 Meeting Strategy: $500 Major Quaddie (3,125% Flexi)`,
      });
      addBet({
        sport: "racing",
        event_id: races[0]?.race_id || "race-1",
        event_name: `${meetingName} R${races[0]?.race_number}`,
        selection: `Unboxed Trifecta Key`,
        bet_type: "TRIFECTA",
        odds: 22.0,
        stake: 250.0,
        notes: `$1,000 Meeting Strategy: $250 Standout Straight Trifecta`,
      });
      addBet({
        sport: "racing",
        event_id: races[races.length - 1]?.race_id || "race-last",
        event_name: `${meetingName} R${races[races.length - 1]?.race_number}`,
        selection: `Feature First 4 Flexi`,
        bet_type: "FIRST4",
        odds: 55.0,
        stake: 250.0,
        notes: `$1,000 Meeting Strategy: $250 Feature First 4 Flexi`,
      });
      addToast(`Deployed $1,000 Meeting Exotic Strategy (Quaddie + Trifecta + First 4)`, "success");
    }

    setIsDeployed(true);
    setTimeout(() => {
      setIsDeployed(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-white space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">
                $1,000 Meeting Bankroll Strategy
              </h2>
              <p className="text-xs text-slate-400">{meetingName} • Total Meeting Outlay</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Strategy Presets */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">
            Select Allocation Strategy
          </label>

          <div className="grid grid-cols-1 gap-2.5">
            <button
              type="button"
              onClick={() => setStrategyType("balanced_100")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                strategyType === "balanced_100"
                  ? "bg-amber-500/10 border-amber-500/40 text-white"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sm text-amber-300">
                  Card-Wide Spread ($100 per race)
                </span>
                <span className="font-mono text-xs font-bold text-slate-300">10 x $100</span>
              </div>
              <p className="text-xs text-slate-400">
                Spreads $1,000 evenly across all {races.length} races on the card on primary win anchors.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStrategyType("banker_hammer")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                strategyType === "banker_hammer"
                  ? "bg-amber-500/10 border-amber-500/40 text-white"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sm text-amber-300">
                  On The Nose ($1,000 Hammer Bet)
                </span>
                <span className="font-mono text-xs font-bold text-slate-300">1 x $1,000</span>
              </div>
              <p className="text-xs text-slate-400">
                Dumps the entire $1,000 meeting bankroll onto the single highest-conviction banker of the day.
              </p>
              {strategyType === "banker_hammer" && (
                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
                  <span className="text-xs text-slate-300 font-medium">Select Target Race:</span>
                  <select
                    value={bankerRaceNum}
                    onChange={(e) => setBankerRaceNum(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  >
                    {races.map((r) => (
                      <option key={r.race_number} value={r.race_number}>
                        Race {r.race_number}: {r.horses[0]?.name || "Top Runner"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setStrategyType("exotic_quaddie")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                strategyType === "exotic_quaddie"
                  ? "bg-amber-500/10 border-amber-500/40 text-white"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sm text-amber-300">
                  Exotic Leverage ($500 Quaddie + $250 Trifecta + $250 First 4)
                </span>
                <span className="font-mono text-xs font-bold text-slate-300">3 Wagers</span>
              </div>
              <p className="text-xs text-slate-400">
                Heavy flexi dividend exotic strategy targeting massive pool returns without retail takeouts.
              </p>
            </button>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleDeploy}
            disabled={isDeployed}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              isDeployed
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 hover:from-amber-400 hover:to-yellow-400 font-extrabold shadow-lg shadow-amber-500/30"
            }`}
          >
            {isDeployed ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Strategy Deployed to Slip!</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                <span>Deploy $1,000 Meeting Strategy to Paper Slip</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
