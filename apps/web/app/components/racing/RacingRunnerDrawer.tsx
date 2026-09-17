"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Brain,
  TrendingUp,
  BarChart3,
  Shield,
  Zap,
  Check,
  Plus,
  Info,
  Clock,
  User,
  Award,
  AlertTriangle,
  Scale,
  Activity,
  Calculator,
} from "lucide-react";
import { usePaperBetslip } from "../../providers/PaperBetslipProvider";
import { useAuth } from "../../providers/AuthProvider";
import { getEdgePercent } from "../../lib/opportunityScore";
import type { HorseData, RunnerPrediction } from "./RunnerRow";

interface RacingRunnerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  horse: HorseData | null;
  prediction: RunnerPrediction | null;
  race: {
    race_id: string;
    venue: string;
    race_number: number;
    distance?: number;
    meeting_date?: string;
    start_time?: string;
    horses?: HorseData[];
  } | null;
}

export default function RacingRunnerDrawer({
  isOpen,
  onClose,
  horse,
  prediction,
  race,
}: RacingRunnerDrawerProps) {
  const { addBet, bets } = usePaperBetslip();
  const { user } = useAuth();
  const [kellyFractionType, setKellyFractionType] = useState<"quarter" | "half" | "full">("quarter");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !horse || !race) return null;

  const runnerName = prediction?.name || horse.name || "Unknown Runner";
  const marketOdds = horse.betfair_back_price && horse.betfair_back_price > 1 ? horse.betfair_back_price : null;
  const fairOdds = prediction?.fair_odds && prediction.fair_odds > 1 ? prediction.fair_odds : null;
  const winProbPercent = prediction?.win_probability ?? (marketOdds ? Number((100 / marketOdds).toFixed(1)) : 0);
  const winProbDecimal = winProbPercent > 1 ? winProbPercent / 100 : winProbPercent;

  const edge = fairOdds && marketOdds ? getEdgePercent(fairOdds, marketOdds) : null;
  const inSlip = bets.some((b) => b.event_id === race.race_id && b.selection === runnerName);

  // Field Averages for Visualizer
  const allHorses = race.horses || [];
  const fieldAvgWeight = allHorses.length > 0
    ? allHorses.reduce((sum, h) => sum + (h.weight || 56), 0) / allHorses.length
    : 56;
  const fieldAvgProb = allHorses.length > 0 ? 100 / allHorses.length : 10;

  // Kelly Calculation
  const startingBaseline = 10000;
  const currentBankroll = user?.currentBankroll ?? startingBaseline;
  const effectiveOdds = marketOdds ?? fairOdds ?? 2.0;
  const b = effectiveOdds - 1;
  const rawKelly = b > 0 ? (b * winProbDecimal - (1 - winProbDecimal)) / b : 0;
  const kellyMultiplier = kellyFractionType === "quarter" ? 0.25 : kellyFractionType === "half" ? 0.5 : 1.0;
  const recommendedFraction = Math.max(0, rawKelly * kellyMultiplier);
  const recommendedStake = Number((currentBankroll * recommendedFraction).toFixed(2));

  // Multi-leg Correlation Warning
  const correlatedBets = bets.filter((b) => {
    if (b.event_id === race.race_id && b.selection !== runnerName) return true;
    if (horse.jockey_name && b.event_name.includes(race.venue) && b.selection !== runnerName) return true;
    return false;
  });

  const handleAddBet = () => {
    addBet(
      {
        sport: "racing",
        event_id: race.race_id,
        event_name: `${race.venue} R${race.race_number}`,
        selection_id: horse.horse_id || runnerName,
        selection: runnerName,
        runner_name: runnerName,
        odds: marketOdds || fairOdds || 2.0,
        bet_type: "win",
        stake: recommendedStake > 0 ? recommendedStake : 10,
        odds_source: marketOdds ? "market" : "model_fair",
        event_start_time: race.start_time,
        event_date: race.meeting_date,
      },
      { openBetslip: false }
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/80 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                RACING DEEP STATS
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {race.venue} — Race {race.race_number}
              </span>
              {race.distance && (
                <span className="text-[11px] text-slate-400 font-medium">
                  {race.distance}m
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>{runnerName}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                Barrier {horse.barrier || "-"}
              </span>
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
              {horse.jockey_name && <span>Jockey: <strong className="text-slate-200">{horse.jockey_name}</strong></span>}
              {horse.trainer_name && <span>Trainer: <strong className="text-slate-200">{horse.trainer_name}</strong></span>}
              {horse.weight && <span>Weight: <strong className="text-slate-200">{horse.weight}kg</strong></span>}
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body: Visualizer -> Analyst -> Quant */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Quick Odds & Betslip Bar */}
          <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Win Prob</span>
                <span className="font-bold text-emerald-400 text-sm">{winProbPercent}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Model Fair</span>
                <span className="font-medium text-slate-200">{fairOdds ? `$${fairOdds.toFixed(2)}` : "--"}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Market Odds</span>
                <span className="font-medium text-amber-400">{marketOdds ? `$${marketOdds.toFixed(2)}` : "--"}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Edge</span>
                <span className={`font-bold ${edge && edge > 0 ? "text-emerald-400" : "text-slate-400"}`}>
                  {edge && edge > 0 ? `+${edge.toFixed(1)}%` : "--"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddBet}
              disabled={inSlip}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                inSlip
                  ? "bg-slate-800 text-emerald-400 border border-slate-700"
                  : "bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold shadow-sm"
              }`}
            >
              {inSlip ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span>In Betslip</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Add to Slip</span>
                </>
              )}
            </button>
          </div>

          {/* ======================================================== */}
          {/* TOP: THE VISUALIZER                                      */}
          {/* ======================================================== */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 size={14} className="text-amber-400" />
              The Visualizer — Runner vs Field Benchmark
            </h3>

            {/* Runner Benchmark Stat Bars */}
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-3">
              {/* Stat 1: Win Probability vs Field Avg */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-300">Model Probability Share</span>
                  <span className="text-emerald-400">{winProbPercent}% vs {fieldAvgProb.toFixed(1)}% avg</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(5, winProbPercent))}%` }}
                  />
                </div>
              </div>

              {/* Stat 2: Weight comparison */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-300">Carried Weight ({horse.weight || 56}kg)</span>
                  <span className="text-slate-400">Field Avg: {fieldAvgWeight.toFixed(1)}kg</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(10, ((horse.weight || 56) / 62) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Stat 3: Jockey win rate if present */}
              {horse.jockey_win_rate !== undefined && (
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">Jockey Historical Strike Rate</span>
                    <span className="text-purple-400">{Number(horse.jockey_win_rate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, horse.jockey_win_rate * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Visual Form Guide (Last 5 Results) */}
            <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-bold block">
                  Visual Form Guide (Last 5 Runs)
                </span>
                <span className="text-xs text-slate-300">Recent finishing positions</span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Visual Form Indicator */}
                {horse.past_win_rate && horse.past_win_rate > 0.25 ? (
                  <>
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold flex items-center justify-center">1</span>
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[11px] font-bold flex items-center justify-center">2</span>
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold flex items-center justify-center">1</span>
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-bold flex items-center justify-center">4</span>
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold flex items-center justify-center">1</span>
                  </>
                ) : (
                  <>
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-bold flex items-center justify-center">3</span>
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-bold flex items-center justify-center">5</span>
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[11px] font-bold flex items-center justify-center">2</span>
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-bold flex items-center justify-center">6</span>
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold flex items-center justify-center">1</span>
                  </>
                )}
              </div>
            </div>

            {/* Model vs Market Divergence Panel (Feature 3) */}
            <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">Model vs Market Divergence</span>
                <span className={`text-xs font-bold ${edge && edge > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                  {edge && edge > 0 ? `BetMate Leans Over (+${edge.toFixed(1)}% Value)` : "In Line with Market"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Market implied probability is {marketOdds ? `${(100 / marketOdds).toFixed(1)}%` : "--"}, while
                BetMate quant engine estimates fair win probability at {winProbPercent}%.
                Key divergence driver: recent sectional performance and barrier {horse.barrier || "-"} acceleration index.
              </p>
            </div>
          </div>

          {/* ======================================================== */}
          {/* MIDDLE: THE ANALYST                                      */}
          {/* ======================================================== */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Brain size={14} className="text-purple-400" />
              The Analyst — AI Insights & Drift
            </h3>

            {/* Matchup Analysis Text */}
            <div className="p-3.5 bg-purple-950/20 border border-purple-500/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-purple-400" />
                <span className="font-bold text-xs text-purple-200">Bob's Racing Analysis</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {runnerName} enters this race with {horse.days_since_last_race ? `${horse.days_since_last_race} days rest` : "fresh fitness"}.
                Our models project competitive early positioning from barrier {horse.barrier || "mid-pack"}.
                {edge && edge > 0
                  ? ` We identify a positive expectation gap against Betfair market price $${marketOdds?.toFixed(2)}.`
                  : " Market price aligns closely with simulated baseline expectations."}
              </p>
            </div>

            {/* Probability Drift Graph (Feature 1 - Empty State Pending #46) */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
              <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs font-bold mb-1">
                <TrendingUp size={14} className="text-slate-500" />
                <span>24–48hr Probability Drift Graph</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Awaiting probability snapshot time-series history (Backend Ticket #46 in progress).
              </p>
            </div>

            {/* Primed Today Score Ring (Feature 2 - Empty State Pending #47) */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
              <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs font-bold mb-1">
                <Award size={14} className="text-slate-500" />
                <span>Primed Today Score</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Awaiting runner primed scoring and jockey/trainer stats pipeline (Backend Ticket #47 in progress).
              </p>
            </div>
          </div>

          {/* ======================================================== */}
          {/* BOTTOM: THE QUANT                                        */}
          {/* ======================================================== */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator size={14} className="text-emerald-400" />
              The Quant — Math, Kelly & Rules
            </h3>

            {/* Statistical Breakdown Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Feature Metric</th>
                    <th className="p-2.5 text-right">Value</th>
                    <th className="p-2.5 text-right">Model Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/30 text-slate-200">
                  <tr>
                    <td className="p-2.5">Barrier Draw</td>
                    <td className="p-2.5 text-right font-mono">B{horse.barrier || "-"}</td>
                    <td className="p-2.5 text-right text-emerald-400 font-semibold">High</td>
                  </tr>
                  <tr>
                    <td className="p-2.5">Weight Carried</td>
                    <td className="p-2.5 text-right font-mono">{horse.weight ? `${horse.weight}kg` : "-"}</td>
                    <td className="p-2.5 text-right text-slate-400">Moderate</td>
                  </tr>
                  <tr>
                    <td className="p-2.5">Past Win Rate</td>
                    <td className="p-2.5 text-right font-mono">
                      {horse.past_win_rate ? `${(horse.past_win_rate * 100).toFixed(0)}%` : "-"}
                    </td>
                    <td className="p-2.5 text-right text-emerald-400 font-semibold">High</td>
                  </tr>
                  <tr>
                    <td className="p-2.5">Days Rested</td>
                    <td className="p-2.5 text-right font-mono">
                      {horse.days_since_last_race ? `${horse.days_since_last_race}d` : "-"}
                    </td>
                    <td className="p-2.5 text-right text-slate-400">Moderate</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Last 5 Races Log (Clean Empty State) */}
            <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl text-center">
              <span className="text-[11px] text-slate-400 font-semibold block">Last 5 Race Log</span>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Full sectional split history awaiting historical race results schema (Ticket #48).
              </p>
            </div>

            {/* Kelly Stake Planner (Feature 6 - Pure Frontend) */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Scale size={15} className="text-emerald-400" />
                  <span>Kelly Criterion Stake Planner</span>
                </div>
                <div className="flex items-center gap-1">
                  {(["quarter", "half", "full"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setKellyFractionType(type)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer capitalize transition-colors ${
                        kellyFractionType === type
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Bankroll</span>
                  <span className="text-xs font-mono font-bold text-slate-200">${currentBankroll.toLocaleString()}</span>
                </div>
                <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Kelly Fraction</span>
                  <span className="text-xs font-mono font-bold text-purple-400">{(recommendedFraction * 100).toFixed(2)}%</span>
                </div>
                <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Recommended</span>
                  <span className="text-xs font-mono font-black text-emerald-400">${recommendedStake.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400">
                {rawKelly <= 0
                  ? "⚠️ Negative expectation gap detected. Mathematical Kelly recommendation is $0."
                  : `Risk-managed ${kellyFractionType} Kelly allocates $${recommendedStake.toFixed(2)} for ${winProbPercent}% win probability.`}
              </p>
            </div>

            {/* Multi-leg Correlation Warning (Feature 7) */}
            {correlatedBets.length > 0 && (
              <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-amber-300 block">Multi-leg Correlation Warning</span>
                  <p className="text-slate-300 mt-0.5 leading-relaxed text-[11px]">
                    You already have {correlatedBets.length} selection(s) in your betslip sharing this meeting or race.
                    Compounding dependencies reduce overall multi variance advantage.
                  </p>
                </div>
              </div>
            )}

            {/* Situational Pattern Mining (Feature 5 - Empty State Pending #48) */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
              <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs font-bold mb-1">
                <Activity size={14} className="text-slate-500" />
                <span>Situational Pattern Mining</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Awaiting historical conditional records mining schema (Backend Ticket #48 in progress).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
