"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Shield,
  Scale,
  Rocket,
  DollarSign,
  TrendingUp,
  Percent,
  RefreshCw,
  Trophy,
  Activity,
  HeartPulse,
} from "lucide-react";
import { usePaperBetslip } from "../../providers/PaperBetslipProvider";
import { useAuth } from "../../providers/AuthProvider";
import type { EVLeg } from "./types";

export interface AutoBuildResult {
  status: "ok" | "no_qualifying_candidates" | "error";
  message?: string;
  risk_profile?: string;
  target_odds?: number;
  actual_odds?: number;
  legs?: Array<{
    id?: string;
    sport: string;
    game_context?: string;
    gameContext?: string;
    leg_description?: string;
    legDescription?: string;
    market_type?: string;
    marketType?: string;
    odds: number;
    true_prob?: number;
    trueProb?: number;
    edge_pct?: number;
    edgePct?: number;
  }>;
  combined_edge_pct?: number;
  health_grade?: string;
  health_score?: number;
  correlation_haircut?: number;
  kelly_recommendation?: {
    recommended_stake: number;
    fraction: number;
  };
  rationale?: string;
}

interface MultiWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToBuilder?: (legs: EVLeg[]) => void;
}

const AVAILABLE_SPORTS = [
  { id: "nba", label: "NBA Basketball", icon: "🏀" },
  { id: "nfl", label: "NFL Football", icon: "🏈" },
  { id: "afl", label: "AFL Australian Rules", icon: "🏉" },
  { id: "nrl", label: "NRL Rugby League", icon: "🏉" },
  { id: "soccer", label: "Soccer / Football", icon: "⚽" },
  { id: "racing", label: "Thoroughbred Racing", icon: "🐎" },
];

export default function MultiWizardModal({
  isOpen,
  onClose,
  onApplyToBuilder,
}: MultiWizardModalProps) {
  const { addBet, setSlipMode, addToast, setIsBetslipOpen } = usePaperBetslip();
  const { token } = useAuth();

  // Wizard state: Step 1 -> 2 -> 3 -> 4
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Sports
  const [selectedSports, setSelectedSports] = useState<string[]>([
    "nba",
    "nfl",
    "afl",
    "nrl",
  ]);

  // Step 2: Target Odds & Stake
  const [stake, setStake] = useState<number>(10);
  const [targetOdds, setTargetOdds] = useState<number>(4.5);

  // Step 3: Risk Profile
  const [riskProfile, setRiskProfile] = useState<
    "safe" | "balanced" | "long_shot"
  >("balanced");
  const [minLegs, setMinLegs] = useState<number>(2);
  const [maxLegs, setMaxLegs] = useState<number>(4);

  // Step 4: AI Evaluation State
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluationResult, setEvaluationResult] =
    useState<AutoBuildResult | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [ticketAdded, setTicketAdded] = useState<boolean>(false);

  // Toggle sport in Step 1
  const toggleSport = (sportId: string) => {
    setSelectedSports((prev) =>
      prev.includes(sportId)
        ? prev.filter((s) => s !== sportId)
        : [...prev, sportId],
    );
  };

  // Run AI evaluation in Step 4
  const runEvaluation = async () => {
    setIsEvaluating(true);
    setEvaluationError(null);
    setEvaluationResult(null);
    setTicketAdded(false);

    try {
      const res = await fetch("/api/recommendations/auto-build", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sports: selectedSports,
          target_odds: targetOdds,
          target_payout: targetOdds * stake,
          stake,
          risk_profile: riskProfile,
          min_legs: minLegs,
          max_legs: maxLegs,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Prediction engine service unavailable");
      }

      const data: AutoBuildResult = await res.json();
      setEvaluationResult(data);
    } catch (err: any) {
      console.warn("Auto-build API route returned:", err.message);
      setEvaluationError(
        err.message ||
          "Unable to query auto-build recommendation service. Please verify backend connections.",
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleGoToStep4 = () => {
    setStep(4);
    void runEvaluation();
  };

  // 1-Tap Add Ticket to Betslip
  const handleAddTicketToSlip = () => {
    if (!evaluationResult?.legs || evaluationResult.legs.length === 0) return;

    evaluationResult.legs.forEach((leg, idx) => {
      const legDesc = leg.leg_description || leg.legDescription || "Multi Leg";
      const gameCtx = leg.game_context || leg.gameContext || "Matchup";
      const edge = leg.edge_pct ?? leg.edgePct ?? 5.0;
      const prob = leg.true_prob ?? leg.trueProb ?? 1 / leg.odds;

      addBet(
        {
          sport: leg.sport,
          event_id: leg.id || `auto-leg-${idx}`,
          event_name: gameCtx,
          selection: legDesc,
          odds: leg.odds,
          stake,
          bet_type: "multi_leg",
          bet_family: "single",
          odds_source: "model_fair",
          market_type: leg.market_type || leg.marketType || "head_to_head",
          model_fair_odds: Math.round((1 / prob) * 100) / 100,
          model_edge_pct: edge,
          notes: `Wizard Pick (Score: ${evaluationResult.health_score ?? 85}/100)`,
        },
        { openBetslip: false },
      );
    });

    if (onApplyToBuilder) {
      const evLegs: EVLeg[] = evaluationResult.legs.map((leg, idx) => ({
        id: leg.id || `auto-leg-${idx}`,
        sport: leg.sport,
        gameContext: leg.game_context || leg.gameContext || "Matchup",
        legDescription: leg.leg_description || leg.legDescription || "Multi Leg",
        trueProb: leg.true_prob ?? leg.trueProb ?? 0.5,
        bestOdds: leg.odds,
        edgePct: leg.edge_pct ?? leg.edgePct ?? 5.0,
        marketType: leg.market_type || leg.marketType,
      }));
      onApplyToBuilder(evLegs);
    }

    setSlipMode("multi");
    setTicketAdded(true);
    addToast(
      `Added ${evaluationResult.legs.length} AI-evaluated legs to Betslip!`,
      "success",
    );
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
        className="relative z-10 w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Wizard Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Guided Multi Wizard
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Build in 60s
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                AI evaluates correlated positive EV legs across your preferred sports and risk profile.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Progression Bar */}
        <div className="bg-slate-900/40 border-b border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs">
          {[
            { num: 1, label: "Sports" },
            { num: 2, label: "Target Odds" },
            { num: 3, label: "Risk Profile" },
            { num: 4, label: "AI Ticket" },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] transition-colors ${
                  step === s.num
                    ? "bg-purple-600 text-white shadow-xs"
                    : step > s.num
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                {step > s.num ? "✓" : s.num}
              </div>
              <span
                className={`font-semibold hidden sm:inline ${
                  step === s.num
                    ? "text-slate-100"
                    : step > s.num
                    ? "text-emerald-400"
                    : "text-slate-500"
                }`}
              >
                {s.label}
              </span>
              {idx < 3 && (
                <span className="text-slate-700 hidden sm:inline">→</span>
              )}
            </div>
          ))}
        </div>

        {/* Wizard Step Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* STEP 1: SPORTS */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Step 1: Select Sports & Competitions
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Choose the sporting codes you want the AI to evaluate for today's highest EV legs.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {AVAILABLE_SPORTS.map((sp) => {
                  const isSelected = selectedSports.includes(sp.id);
                  return (
                    <motion.div
                      key={sp.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleSport(sp.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                        isSelected
                          ? "bg-purple-950/40 border-purple-500/50 text-white shadow-md shadow-purple-950/20"
                          : "bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <span className="text-2xl">{sp.icon}</span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold block truncate">
                          {sp.label}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {isSelected ? "Active ✓" : "Tap to include"}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {selectedSports.length === 0 && (
                <p className="text-xs text-rose-400 flex items-center gap-1">
                  <AlertCircle size={14} /> Please select at least one sport to continue.
                </p>
              )}
            </div>
          )}

          {/* STEP 2: TARGET ODDS & STAKE */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-white">
                  Step 2: Choose Target Payout & Odds
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Set your desired multiplier or use the Safer vs Bigger slider to define ticket ambition.
                </p>
              </div>

              {/* Stake input */}
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2">
                <span className="text-xs font-bold text-slate-300 block">
                  Proposed Stake Amount:
                </span>
                <div className="flex items-center gap-2">
                  {[5, 10, 20, 50].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setStake(amt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        stake === amt
                          ? "bg-purple-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                  <div className="relative ml-2">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-500">$</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={stake}
                      onChange={(e) => setStake(Math.max(1, Number(e.target.value)))}
                      className="w-20 pl-6 pr-2 py-1.5 text-xs font-bold font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Target Odds / Safer vs Bigger Slider */}
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    Safer vs Bigger Odds Target:
                  </span>
                  <span className="text-base font-black font-mono text-purple-400">
                    ${targetOdds.toFixed(2)} Target Odds
                  </span>
                </div>

                <input
                  type="range"
                  min="2.0"
                  max="25.0"
                  step="0.5"
                  value={targetOdds}
                  onChange={(e) => setTargetOdds(Number(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Safer ($2.00)</span>
                  <span>Balanced ($4.50)</span>
                  <span>Ambitious ($10.00+)</span>
                  <span>Moonshot ($25.00)</span>
                </div>

                {/* Target Payout display */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Projected Ticket Payout:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    ${(stake * targetOdds).toFixed(2)} (${(stake * targetOdds - stake).toFixed(2)} profit)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: RISK PROFILE */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Step 3: Select Multi Risk Profile
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Tell the algorithm whether you prefer high-probability anchors, optimal EV balance, or roughie upside.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Safe */}
                <div
                  onClick={() => setRiskProfile("safe")}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                    riskProfile === "safe"
                      ? "bg-purple-950/40 border-purple-500/50 text-white shadow-md shadow-purple-950/20"
                      : "bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    <span className="font-bold text-sm">Safe</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    High win rate anchors (&gt;55% probability). Conservative odds 1.30-1.90. Minimal variance.
                  </p>
                  <span className="text-[10px] font-bold text-emerald-400">
                    Low Volatility
                  </span>
                </div>

                {/* Balanced */}
                <div
                  onClick={() => setRiskProfile("balanced")}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                    riskProfile === "balanced"
                      ? "bg-purple-950/40 border-purple-500/50 text-white shadow-md shadow-purple-950/20"
                      : "bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-purple-400" />
                    <span className="font-bold text-sm">Balanced</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Maximizes mathematical expected value (+EV). Odds 1.60-2.80 with strong model-to-market edges.
                  </p>
                  <span className="text-[10px] font-bold text-purple-400">
                    Optimal Value Ratio
                  </span>
                </div>

                {/* Long-Shot */}
                <div
                  onClick={() => setRiskProfile("long_shot")}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                    riskProfile === "long_shot"
                      ? "bg-purple-950/40 border-purple-500/50 text-white shadow-md shadow-purple-950/20"
                      : "bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-amber-400" />
                    <span className="font-bold text-sm">Long-Shot</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Aggressive roughies and high payout multipliers. Tolerates variance for exponential returns.
                  </p>
                  <span className="text-[10px] font-bold text-amber-400">
                    High Payout Upside
                  </span>
                </div>
              </div>

              {/* Legs bounds */}
              <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Allowed Leg Count:</span>
                <div className="flex items-center gap-2">
                  <span>Between</span>
                  <select
                    value={minLegs}
                    onChange={(e) => setMinLegs(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                  >
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                  <span>and</span>
                  <select
                    value={maxLegs}
                    onChange={(e) => setMaxLegs(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                  >
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                  <span>legs</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: AI EVALUATION & PRESENTATION */}
          {step === 4 && (
            <div className="space-y-4">
              {isEvaluating ? (
                <div className="p-12 text-center space-y-4">
                  <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-100">
                      Evaluating Positive EV Correlated Legs...
                    </h3>
                    <p className="text-xs text-slate-400">
                      Querying `/api/recommendations/auto-build` across {selectedSports.join(", ").toUpperCase()} fixtures with Gaussian Copula risk checks.
                    </p>
                  </div>
                </div>
              ) : evaluationError ? (
                <div className="p-6 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                    <AlertCircle size={18} />
                    <span>Evaluation Notice</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {evaluationError}
                  </p>
                  <button
                    type="button"
                    onClick={runEvaluation}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : evaluationResult?.status === "no_qualifying_candidates" ? (
                <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                    <AlertCircle size={22} />
                  </div>
                  <h3 className="text-base font-bold text-slate-200">
                    No Qualifying Candidates
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {evaluationResult.message ||
                      "No qualifying positive EV legs for the chosen sport/odds filters right now. Try widening your selected sports or adjusting target odds."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer"
                  >
                    Adjust Sports & Target
                  </button>
                </div>
              ) : evaluationResult?.legs && evaluationResult.legs.length > 0 ? (
                <div className="space-y-4">
                  {/* Health Score & Ticket Summary Card */}
                  <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <HeartPulse className="w-5 h-5 text-emerald-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                              Ticket Health Score:
                            </span>
                            <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                              {evaluationResult.health_score ?? 88}/100 (Grade {evaluationResult.health_grade ?? "A"})
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className="text-[11px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full capitalize">
                        {evaluationResult.risk_profile || riskProfile} Profile
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-center font-mono">
                      <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                        <span className="text-[9px] uppercase font-bold text-slate-500 block font-sans">
                          Actual Odds
                        </span>
                        <span className="text-sm font-black text-slate-100">
                          ${(evaluationResult.actual_odds ?? targetOdds).toFixed(2)}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                        <span className="text-[9px] uppercase font-bold text-slate-500 block font-sans">
                          Est. Edge
                        </span>
                        <span className="text-sm font-black text-emerald-400">
                          +{(evaluationResult.combined_edge_pct ?? 12.5).toFixed(1)}%
                        </span>
                      </div>
                      <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                        <span className="text-[9px] uppercase font-bold text-slate-500 block font-sans">
                          Stake
                        </span>
                        <span className="text-sm font-bold text-slate-200">
                          ${stake.toFixed(2)}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                        <span className="text-[9px] uppercase font-bold text-slate-500 block font-sans">
                          Proj. Return
                        </span>
                        <span className="text-sm font-black text-cyan-400">
                          ${(stake * (evaluationResult.actual_odds ?? targetOdds)).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {evaluationResult.rationale && (
                      <p className="text-[11px] text-slate-400 italic">
                        "{evaluationResult.rationale}"
                      </p>
                    )}
                  </div>

                  {/* Evaluated Legs List */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      AI Selected Legs ({evaluationResult.legs.length}):
                    </span>

                    {evaluationResult.legs.map((leg, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold uppercase text-slate-300">
                              {leg.sport}
                            </span>
                            <span className="text-slate-400 truncate text-[11px]">
                              {leg.game_context || leg.gameContext}
                            </span>
                          </div>
                          <span className="font-bold text-slate-100 block truncate">
                            {leg.leg_description || leg.legDescription}
                          </span>
                        </div>

                        <div className="text-right shrink-0 font-mono">
                          <span className="text-sm font-black text-slate-200">
                            ${leg.odds.toFixed(2)}
                          </span>
                          {(leg.edge_pct ?? leg.edgePct) && (
                            <span className="text-[10px] font-bold text-emerald-400 block">
                              +{(leg.edge_pct ?? leg.edgePct)!.toFixed(1)}% EV
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 1-Tap Add Action */}
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleAddTicketToSlip}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white transition-all cursor-pointer shadow-lg shadow-purple-900/30 flex items-center gap-1.5"
                    >
                      {ticketAdded ? (
                        <>
                          <CheckCircle2 size={15} />
                          <span>Added to Betslip ✓</span>
                        </>
                      ) : (
                        <>
                          <Layers size={15} />
                          <span>1-Tap Add Ticket to Betslip</span>
                        </>
                      )}
                    </button>

                    {ticketAdded && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsBetslipOpen(true);
                          onClose();
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                      >
                        View Betslip
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              disabled={step === 1 && selectedSports.length === 0}
              onClick={() => setStep((s) => (s + 1) as any)}
              className="px-4 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-purple-900/20"
            >
              <span>Next</span>
              <ArrowRight size={14} />
            </button>
          ) : step === 3 ? (
            <button
              type="button"
              onClick={handleGoToStep4}
              className="px-4 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-purple-900/20"
            >
              <Sparkles size={14} />
              <span>Evaluate Optimal Ticket</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
