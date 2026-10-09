"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Layers,
  Calculator,
  Percent,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Trophy,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { usePaperBetslip } from "../../providers/PaperBetslipProvider";

export interface QuaddieRunner {
  horse_id: string;
  name: string;
  barrier?: number;
  modelRank?: number;
  winProbability?: number; // 0..1 or 0..100
  fairOdds?: number;
  marketOdds?: number;
  edgePercent?: number | null;
}

export interface QuaddieRace {
  race_id: string;
  race_number: number;
  venue: string;
  distance?: number;
  start_time?: string;
  runners: QuaddieRunner[];
}

export interface QuaddiePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  venue: string;
  races: QuaddieRace[];
  selectedRaceNumbers?: number[]; // e.g. [5, 6, 7, 8]
}

export default function QuaddiePlannerModal({
  isOpen,
  onClose,
  venue,
  races,
  selectedRaceNumbers,
}: QuaddiePlannerModalProps) {
  const { addBet, setSlipMode, addToast, setIsBetslipOpen } = usePaperBetslip();

  // Pick the 4 quaddie races:
  // Either user provided race numbers, or last 4 races of the meeting, or first 4 available
  const quaddieRaces = useMemo(() => {
    const sorted = [...races].sort((a, b) => a.race_number - b.race_number);
    if (selectedRaceNumbers && selectedRaceNumbers.length === 4) {
      const filtered = sorted.filter((r) =>
        selectedRaceNumbers.includes(r.race_number),
      );
      if (filtered.length === 4) return filtered;
    }
    // Default to last 4 races (traditional Victorian/NSW quaddie e.g. R5-R8 or R7-R10)
    if (sorted.length >= 4) {
      return sorted.slice(-4);
    }
    return sorted;
  }, [races, selectedRaceNumbers]);

  // Selected runners per leg (Map leg index 0..3 -> Set of runner horse_ids)
  const [selectedLegRunners, setSelectedLegRunners] = useState<
    Record<number, string[]>
  >({
    0: [],
    1: [],
    2: [],
    3: [],
  });

  const [investment, setInvestment] = useState<number>(20);
  const [ticketPlaced, setTicketPlaced] = useState<boolean>(false);

  // Toggle runner selection in a leg
  const toggleRunner = (legIdx: number, horseId: string) => {
    setSelectedLegRunners((prev) => {
      const current = prev[legIdx] || [];
      const updated = current.includes(horseId)
        ? current.filter((id) => id !== horseId)
        : [...current, horseId];
      return { ...prev, [legIdx]: updated };
    });
    setTicketPlaced(false);
  };

  // Quick select presets for a leg
  const quickSelect = (
    legIdx: number,
    mode: "top2" | "top3" | "value" | "clear",
  ) => {
    const race = quaddieRaces[legIdx];
    if (!race) return;

    if (mode === "clear") {
      setSelectedLegRunners((prev) => ({ ...prev, [legIdx]: [] }));
      return;
    }

    // Sort runners by model probability or rank
    const sortedRunners = [...race.runners].sort((a, b) => {
      const probA =
        a.winProbability !== undefined
          ? a.winProbability > 1
            ? a.winProbability / 100
            : a.winProbability
          : a.marketOdds
          ? 1 / a.marketOdds
          : 0;
      const probB =
        b.winProbability !== undefined
          ? b.winProbability > 1
            ? b.winProbability / 100
            : b.winProbability
          : b.marketOdds
          ? 1 / b.marketOdds
          : 0;
      return probB - probA;
    });

    let targetIds: string[] = [];
    if (mode === "top2") {
      targetIds = sortedRunners.slice(0, 2).map((r) => r.horse_id);
    } else if (mode === "top3") {
      targetIds = sortedRunners.slice(0, 3).map((r) => r.horse_id);
    } else if (mode === "value") {
      // Top 1 pick + any runner with edge > 3%
      const top1 = sortedRunners[0]?.horse_id;
      const valueRunners = sortedRunners
        .filter((r) => (r.edgePercent ?? 0) >= 3.0)
        .map((r) => r.horse_id);
      targetIds = Array.from(new Set([top1, ...valueRunners].filter(Boolean) as string[]));
    }

    setSelectedLegRunners((prev) => ({ ...prev, [legIdx]: targetIds }));
    setTicketPlaced(false);
  };

  // Auto-fill entire quaddie with AI Top 2 in each leg
  const handleAutoFillTop2 = () => {
    const newPicks: Record<number, string[]> = {};
    quaddieRaces.forEach((race, idx) => {
      const sortedRunners = [...race.runners].sort((a, b) => {
        const probA =
          a.winProbability !== undefined
            ? a.winProbability > 1
              ? a.winProbability / 100
              : a.winProbability
            : a.marketOdds
            ? 1 / a.marketOdds
            : 0;
        const probB =
          b.winProbability !== undefined
            ? b.winProbability > 1
              ? b.winProbability / 100
              : b.winProbability
            : b.marketOdds
            ? 1 / b.marketOdds
            : 0;
        return probB - probA;
      });
      newPicks[idx] = sortedRunners.slice(0, 2).map((r) => r.horse_id);
    });
    setSelectedLegRunners(newPicks);
    setTicketPlaced(false);
  };

  // Math Calculations:
  // Combinations = N1 * N2 * N3 * N4
  const counts = [
    selectedLegRunners[0]?.length || 0,
    selectedLegRunners[1]?.length || 0,
    selectedLegRunners[2]?.length || 0,
    selectedLegRunners[3]?.length || 0,
  ];

  const totalCombinations =
    counts.every((c) => c > 0) ? counts[0] * counts[1] * counts[2] * counts[3] : 0;

  // Flexi percentage: (investment / combinations) * 100
  const flexiPercentage =
    totalCombinations > 0 ? (investment / totalCombinations) * 100 : 0;

  // Leg probabilities: sum of selected win probabilities in each leg
  const legProbabilities = quaddieRaces.map((race, idx) => {
    const selectedIds = selectedLegRunners[idx] || [];
    if (selectedIds.length === 0) return 0;
    const legSum = selectedIds.reduce((sum, id) => {
      const runner = race.runners.find((r) => r.horse_id === id);
      if (!runner) return sum;
      const p =
        runner.winProbability !== undefined
          ? runner.winProbability > 1
            ? runner.winProbability / 100
            : runner.winProbability
          : runner.marketOdds
          ? 1 / runner.marketOdds
          : 0.1;
      return sum + p;
    }, 0);
    return Math.min(0.99, legSum);
  });

  // Joint quaddie success probability: prod(leg_prob)
  const jointSuccessProbability =
    counts.every((c) => c > 0)
      ? legProbabilities.reduce((acc, p) => acc * p, 1)
      : 0;

  const estimatedFairDividend =
    jointSuccessProbability > 0 ? 1 / jointSuccessProbability : 0;

  const estimatedFlexiPayout =
    totalCombinations > 0
      ? (estimatedFairDividend * flexiPercentage) / 100
      : 0;

  // Handle Add to Betslip
  const handleAddToSlip = () => {
    if (totalCombinations <= 0) return;

    const legDescriptions = quaddieRaces.map((r, i) => {
      const selected = (selectedLegRunners[i] || [])
        .map((id) => r.runners.find((runner) => runner.horse_id === id)?.name)
        .filter(Boolean);
      return `R${r.race_number}: [${selected.join(", ")}]`;
    });

    const raceNumbersStr = quaddieRaces.map((r) => r.race_number).join("-");

    addBet({
      sport: "racing",
      event_id: `quaddie-${venue}-${raceNumbersStr}`,
      event_name: `${venue} Quaddie (R${quaddieRaces.map((r) => r.race_number).join(", ")})`,
      selection: `${totalCombinations} Combos @ ${flexiPercentage.toFixed(1)}% Flexi`,
      odds: Math.max(1.0, Math.round(estimatedFairDividend * 10) / 10),
      bet_type: "quaddie",
      bet_family: "exotic",
      exotic_bet_type: "QUADDIE",
      stake: investment,
      odds_source: "model_fair",
      notes: `Ticket: ${legDescriptions.join(" | ")} | Model Prob: ${(jointSuccessProbability * 100).toFixed(1)}%`,
    });

    setSlipMode("exotics");
    addToast(
      `Added ${venue} Quaddie ticket ($${investment} @ ${flexiPercentage.toFixed(1)}% Flexi) to Betslip!`,
      "success",
    );
    setTicketPlaced(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="fixed inset-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-5xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {venue} Quaddie Planner
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  4-Leg Exotic Grid
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Build your flexi ticket with model win probabilities, joint success rates & combination pricing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoFillTop2}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-500/30 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Top 2 per Leg</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        {quaddieRaces.length < 4 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <AlertCircle size={28} />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-200">
                Awaiting 4 Scheduled Races
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Quaddie planning requires 4 scheduled races from {venue}. Currently only {quaddieRaces.length} race(s) have available fields. Check back once meeting fields are released.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
            {/* 4-Leg Interactive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quaddieRaces.map((race, legIdx) => {
                const selected = selectedLegRunners[legIdx] || [];
                const legProb = legProbabilities[legIdx] || 0;

                return (
                  <div
                    key={race.race_id}
                    className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex flex-col space-y-3"
                  >
                    {/* Leg Header */}
                    <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                            Leg {legIdx + 1}
                          </span>
                          <span className="text-xs font-black text-white">
                            Race {race.race_number}
                          </span>
                        </div>
                        {race.distance && (
                          <span className="text-[10px] text-slate-500">
                            {race.distance}m
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] font-mono font-bold text-emerald-400">
                          {(legProb * 100).toFixed(0)}% cover
                        </span>
                        <div className="text-[9px] text-slate-500">
                          {selected.length} selected
                        </div>
                      </div>
                    </div>

                    {/* Quick Selection Buttons */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => quickSelect(legIdx, "top2")}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      >
                        Top 2
                      </button>
                      <button
                        type="button"
                        onClick={() => quickSelect(legIdx, "top3")}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      >
                        Top 3
                      </button>
                      <button
                        type="button"
                        onClick={() => quickSelect(legIdx, "value")}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 transition-colors"
                      >
                        Value
                      </button>
                      <button
                        type="button"
                        onClick={() => quickSelect(legIdx, "clear")}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800/60 hover:bg-slate-800 text-slate-400 transition-colors ml-auto"
                      >
                        Clear
                      </button>
                    </div>

                    {/* Runners List */}
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {race.runners.map((runner) => {
                        const isSelected = selected.includes(runner.horse_id);
                        const winProb =
                          runner.winProbability !== undefined
                            ? runner.winProbability > 1
                              ? runner.winProbability
                              : runner.winProbability * 100
                            : runner.marketOdds
                            ? (1 / runner.marketOdds) * 100
                            : 0;

                        return (
                          <div
                            key={runner.horse_id}
                            onClick={() => toggleRunner(legIdx, runner.horse_id)}
                            className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs ${
                              isSelected
                                ? "bg-purple-950/40 border-purple-500/50 text-white"
                                : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? "bg-purple-500 text-white"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {runner.barrier ?? "-"}
                              </span>
                              <span className="font-semibold truncate">
                                {runner.name}
                              </span>
                            </div>

                            <div className="text-right shrink-0 flex items-center gap-1.5 font-mono">
                              {winProb > 0 && (
                                <span className="text-[11px] font-bold text-purple-300">
                                  {winProb.toFixed(0)}%
                                </span>
                              )}
                              {runner.marketOdds && runner.marketOdds > 1 && (
                                <span className="text-[11px] text-slate-400">
                                  ${runner.marketOdds.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calculations & Flexi Planner Panel */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Quaddie Ticket Calculations & Flexi Optimization
                  </span>
                </div>

                {/* Investment Input & Presets */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Investment:</span>
                  <div className="flex items-center gap-1">
                    {[10, 20, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setInvestment(amt)}
                        className={`px-2 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${
                          investment === amt
                            ? "bg-purple-600 text-white"
                            : "bg-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                    <div className="relative">
                      <span className="absolute left-2 top-1 text-xs text-slate-500">$</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={investment}
                        onChange={(e) => setInvestment(Math.max(1, Number(e.target.value)))}
                        className="w-16 pl-5 pr-2 py-1 text-xs font-bold font-mono bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Core Calculation Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                {/* 1. Ticket Combination Count */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Combinations
                  </span>
                  <div className="text-lg font-black font-mono text-slate-100 mt-0.5">
                    {totalCombinations}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {counts.join(" × ")}
                  </span>
                </div>

                {/* 2. Flexi Percentage */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Flexi Percentage
                  </span>
                  <div
                    className={`text-lg font-black font-mono mt-0.5 ${
                      flexiPercentage >= 100
                        ? "text-emerald-400"
                        : flexiPercentage >= 20
                        ? "text-purple-400"
                        : "text-amber-400"
                    }`}
                  >
                    {flexiPercentage > 0 ? `${flexiPercentage.toFixed(1)}%` : "0%"}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    ${investment} / {totalCombinations || 1}
                  </span>
                </div>

                {/* 3. Model Joint Success Probability */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Joint Success Prob
                  </span>
                  <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
                    {jointSuccessProbability > 0
                      ? `${(jointSuccessProbability * 100).toFixed(1)}%`
                      : "--"}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Model joint hit rate
                  </span>
                </div>

                {/* 4. Est. Model Dividend & Payout */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Est. Flexi Return
                  </span>
                  <div className="text-lg font-black font-mono text-cyan-400 mt-0.5">
                    {estimatedFlexiPayout > 0
                      ? `$${estimatedFlexiPayout.toFixed(2)}`
                      : "--"}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Dividend: ${estimatedFairDividend.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Status Note & Action */}
              <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
                <div className="text-xs text-slate-400">
                  {totalCombinations === 0 ? (
                    <span className="text-amber-400 font-medium flex items-center gap-1.5">
                      <AlertCircle size={14} /> Please select at least 1 runner in every leg to calculate your ticket.
                    </span>
                  ) : (
                    <span className="text-slate-300">
                      ✓ Valid ticket: <strong>{totalCombinations} combinations</strong> at <strong>{flexiPercentage.toFixed(1)}% flexi</strong> for ${investment}.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={totalCombinations === 0}
                    onClick={handleAddToSlip}
                    className={`px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-lg ${
                      totalCombinations > 0
                        ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30"
                        : "bg-slate-800 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    {ticketPlaced ? (
                      <>
                        <CheckCircle2 size={15} className="text-white" />
                        <span>Ticket Added ✓</span>
                      </>
                    ) : (
                      <>
                        <Layers size={15} />
                        <span>Add Quaddie to Betslip</span>
                      </>
                    )}
                  </button>

                  {ticketPlaced && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsBetslipOpen(true);
                        onClose();
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                    >
                      View Slip
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
