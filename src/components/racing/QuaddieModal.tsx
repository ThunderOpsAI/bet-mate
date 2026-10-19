import React, { useState } from "react";
import { X, Layers, Plus, Check, Calculator, Sparkles } from "lucide-react";
import { useBetslip } from "../../context/BetslipContext";
import type { Race } from "../../types";

interface QuaddieModalProps {
  isOpen: boolean;
  onClose: () => void;
  races: Race[];
  venue: string;
}

export const QuaddieModal: React.FC<QuaddieModalProps> = ({ isOpen, onClose, races, venue }) => {
  const { addBet } = useBetslip();

  // Pick up to 4 legs from races (e.g. R4 to R7 or first 4 available)
  const quaddieRaces = races.slice(0, 4);

  const [selectedRunners, setSelectedRunners] = useState<Record<string, string[]>>({
    [quaddieRaces[0]?.race_id || "r1"]: [quaddieRaces[0]?.horses[0]?.name || ""],
    [quaddieRaces[1]?.race_id || "r2"]: [quaddieRaces[1]?.horses[0]?.name || ""],
    [quaddieRaces[2]?.race_id || "r3"]: [quaddieRaces[2]?.horses[0]?.name || ""],
    [quaddieRaces[3]?.race_id || "r4"]: [quaddieRaces[3]?.horses[0]?.name || ""],
  });

  const [quaddieStake, setQuaddieStake] = useState(20);

  if (!isOpen) return null;

  const toggleRunner = (raceId: string, horseName: string) => {
    setSelectedRunners((prev) => {
      const current = prev[raceId] || [];
      const exists = current.includes(horseName);
      if (exists) {
        if (current.length === 1) return prev; // Keep at least one
        return { ...prev, [raceId]: current.filter((n) => n !== horseName) };
      }
      return { ...prev, [raceId]: [...current, horseName] };
    });
  };

  // Calculate combinations
  const comboCounts = quaddieRaces.map((r) => (selectedRunners[r.race_id]?.length || 1));
  const totalCombinations = comboCounts.reduce((acc, c) => acc * c, 1);
  const flexiPct = totalCombinations > 0 ? (quaddieStake / totalCombinations) * 100 : 0;

  const handleAddToSlip = () => {
    const summary = quaddieRaces
      .map((r, i) => `L${i + 1}: ${selectedRunners[r.race_id]?.join(", ")}`)
      .join(" | ");

    addBet(
      {
        sport: "racing",
        event_id: `quaddie_${venue}`,
        event_name: `${venue} Quaddie (${quaddieRaces.map((r) => `R${r.race_number}`).join("-")})`,
        selection: `${totalCombinations} Combos (${flexiPct.toFixed(1)}% Flexi) [${summary}]`,
        bet_type: "win",
        odds: Number((totalCombinations * 8.5).toFixed(2)),
        stake: quaddieStake,
        fair_odds: Number((totalCombinations * 6.5).toFixed(2)),
        edge_pct: 18.0,
      },
      true
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Layers size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{venue} Quaddie Planner</h3>
              <p className="text-xs text-slate-400">Select combinations across 4 consecutive feature legs</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Legs Picker */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {quaddieRaces.map((race, legIdx) => {
            const picked = selectedRunners[race.race_id] || [];
            return (
              <div key={race.race_id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-black flex items-center justify-center">
                      L{legIdx + 1}
                    </span>
                    <span className="text-xs font-bold text-white">
                      Race {race.race_number} • {race.distance}m ({race.track_condition})
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">
                    {picked.length} runner{picked.length !== 1 ? "s" : ""} selected
                  </span>
                </div>

                {/* Runners list */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {race.horses.slice(0, 4).map((horse) => {
                    const isSelected = picked.includes(horse.name);
                    return (
                      <button
                        key={horse.horse_id}
                        type="button"
                        onClick={() => toggleRunner(race.race_id, horse.name)}
                        className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                          isSelected
                            ? "bg-amber-500/20 border-amber-500/50 text-amber-200"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[10px] font-bold text-slate-500 w-4">{horse.saddlecloth}.</span>
                          <span className="text-xs font-semibold truncate">{horse.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-xs font-black font-mono">${horse.betfair_back_price.toFixed(2)}</span>
                          <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                            isSelected ? "bg-amber-500 text-slate-950 font-bold" : "border border-slate-700 text-transparent"
                          }`}>
                            ✓
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Quaddie Maths Summary */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Combos</span>
                <span className="text-sm font-black text-white font-mono">{totalCombinations}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Total Stake</span>
                <span className="text-sm font-black text-amber-400 font-mono">${quaddieStake}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Flexi %</span>
                <span className="text-sm font-black text-emerald-400 font-mono">{flexiPct.toFixed(1)}%</span>
              </div>
            </div>

            {/* Stake Input */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-slate-300">Quaddie Outlay ($):</span>
              <div className="flex gap-1.5">
                {[10, 20, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setQuaddieStake(amt)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      quaddieStake === amt
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Dividend estimate: <strong className="text-emerald-400">~$3,200.00</strong>
          </div>
          <button
            type="button"
            onClick={handleAddToSlip}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-amber-500/20"
          >
            <Plus size={15} />
            <span>Add Quaddie to Betslip</span>
          </button>
        </div>
      </div>
    </div>
  );
};
