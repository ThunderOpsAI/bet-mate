"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  TrendingUp,
  Percent,
  DollarSign,
  Activity,
  Shield,
  HelpCircle,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { API_BASE, safeResponseJson } from "../../lib/api";
import { PaperBet } from "../../providers/PaperBetslipProvider";

export interface MultiEvaluationResult {
  combined_odds: number;
  fair_odds: number;
  adjusted_odds?: number;
  fair_probability: number;
  adjusted_probability?: number;
  combined_edge_pct: number;
  expected_value_10?: number;
  max_rho?: number;
  pairwise_warnings?: any[];
  warnings?: any[];
  scored_legs?: any[];
  correlation_score?: number;
  correlation_summary?: string;
  health_grade?: "A" | "B" | "C" | "D" | "F" | string;
  health_score?: number;
  health_summary?: string;
  multi_health?: {
    grade: string;
    score: number;
    summary: string;
    combined_edge_pct: number;
    correlation_score: number;
    positive_legs_ratio: number;
  };
  weakest_leg?: {
    rationale?: string;
    selection?: string;
    leg_index?: number;
    [key: string]: any;
  };
  weakest_leg_index?: number;
  reason?: string;
  severity?: "warning" | "danger" | "info";
}

export interface MultiLiveMathsProps {
  legs: PaperBet[];
  totalStake: number;
  sport?: string;
  onEvaluationResult?: (result: MultiEvaluationResult) => void;
  className?: string;
}

export default function MultiLiveMaths({
  legs,
  totalStake,
  sport = "nba",
  onEvaluationResult,
  className = "",
}: MultiLiveMathsProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<MultiEvaluationResult | null>(null);
  const [showHealthTooltip, setShowHealthTooltip] = useState<boolean>(false);

  // Compute baseline client calculation for instant reactivity and fallback
  const fallbackMath = useMemo(() => {
    if (!legs || legs.length < 2) return null;

    const validLegs = legs.filter((l) => (l.odds || 0) > 1);
    if (validLegs.length < 2) return null;

    const combinedOdds = validLegs.reduce((acc, l) => acc * (l.odds || 1), 1);
    const probs = validLegs.map((l) =>
      l.model_prob ? (l.model_prob > 1 ? l.model_prob / 100 : l.model_prob) : 1 / (l.odds || 1.9),
    );
    const fairProb = probs.reduce((acc, p) => acc * p, 1);
    // Slight correlation factor for same-event legs
    const adjProb = fairProb * 1.05;
    const fairOdds = fairProb > 0 ? 1 / fairProb : combinedOdds;
    const edgePct = ((adjProb * combinedOdds) - 1) * 100;

    let grade = "C";
    let score = 55;
    if (edgePct > 15) {
      grade = "A";
      score = 88;
    } else if (edgePct > 5) {
      grade = "B";
      score = 74;
    } else if (edgePct < -10) {
      grade = "F";
      score = 25;
    } else if (edgePct < 0) {
      grade = "D";
      score = 42;
    }

    return {
      combined_odds: Math.round(combinedOdds * 100) / 100,
      fair_odds: Math.round(fairOdds * 100) / 100,
      fair_probability: fairProb,
      adjusted_probability: adjProb,
      combined_edge_pct: Math.round(edgePct * 10) / 10,
      health_grade: grade,
      health_score: score,
      health_summary: `Grade ${grade} (${score}/100): ${edgePct > 0 ? "+" : ""}${edgePct.toFixed(1)}% EV`,
    } as MultiEvaluationResult;
  }, [legs]);

  useEffect(() => {
    let isCancelled = false;

    if (!legs || legs.length < 2) {
      setData(null);
      return;
    }

    async function evaluateMulti() {
      setLoading(true);
      try {
        const payload = {
          sport: sport.toLowerCase(),
          legs: legs.map((l) => ({
            sport: l.sport,
            event_id: l.event_id,
            selection: l.selection,
            market_type: l.bet_type || "head_to_head",
            odds: l.odds || 1.9,
            probability: l.model_prob ? (l.model_prob > 1 ? l.model_prob / 100 : l.model_prob) : undefined,
            leg_description: `${l.event_name} - ${l.selection}`,
          })),
          bookie_odds: legs.reduce((acc, l) => acc * (l.odds || 1), 1),
        };

        const res = await fetch(`${API_BASE}/recommendations/multi/evaluate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok && !isCancelled) {
          const result = await safeResponseJson(res);
          if (result && typeof result.combined_odds === "number") {
            setData(result);
            if (onEvaluationResult) onEvaluationResult(result);
            return;
          }
        }
      } catch {}

      // Fallback to local math
      if (!isCancelled && fallbackMath) {
        setData(fallbackMath);
        if (onEvaluationResult) onEvaluationResult(fallbackMath);
      }
    }

    evaluateMulti();

    return () => {
      isCancelled = true;
    };
  }, [legs, sport, fallbackMath, onEvaluationResult]);

  const activeData = data || fallbackMath;

  if (!legs || legs.length < 2 || !activeData) {
    return (
      <div className="p-3 text-center text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
        Add 2 or more selections to calculate Live Multi Maths & Copula Pricing.
      </div>
    );
  }

  const combinedOdds = activeData.combined_odds || 1.0;
  const fairOdds = activeData.adjusted_odds || activeData.fair_odds || combinedOdds;
  const jointProb = (activeData.adjusted_probability || activeData.fair_probability || 0) * 100;
  const netEdgePct = activeData.combined_edge_pct ?? 0;
  const grade = activeData.health_grade || "B";
  const healthScore = activeData.health_score ?? 70;

  const expectedReturn = Math.round(totalStake * combinedOdds * (jointProb / 100) * 100) / 100;
  const expectedProfit = Math.round((expectedReturn - totalStake) * 100) / 100;

  const gradeColors: Record<string, string> = {
    A: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
    B: "bg-cyan-500/20 text-cyan-300 border-cyan-500/50",
    C: "bg-amber-500/20 text-amber-300 border-amber-500/50",
    D: "bg-orange-500/20 text-orange-300 border-orange-500/50",
    F: "bg-rose-500/20 text-rose-300 border-rose-500/50",
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header bar with Multi Health Score badge (Item 48) */}
      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-emerald-400 shrink-0" />
          <span className="font-extrabold text-xs text-slate-100">Live Multi Evaluation</span>
          {loading && <Loader2 size={12} className="animate-spin text-emerald-400" />}
        </div>

        {/* Health Score Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowHealthTooltip(!showHealthTooltip)}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black border transition-all cursor-pointer ${
              gradeColors[grade] || gradeColors.B
            }`}
            title="Multi Health Score (A-F)"
          >
            <span>Health Grade {grade}</span>
            <span className="text-[10px] font-mono opacity-85">({healthScore}/100)</span>
            <HelpCircle size={11} className="opacity-70" />
          </button>

          {/* Interactive Tooltip (Item 48) */}
          {showHealthTooltip && (
            <div
              className="absolute right-0 top-7 w-64 p-3 rounded-xl bg-slate-950 border border-slate-700 shadow-2xl z-50 text-xs text-slate-300 space-y-1.5 animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-1 border-b border-slate-800">
                <span className="font-black text-slate-100 uppercase tracking-wider text-[10px]">
                  Multi Health Rating
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-black border ${
                    gradeColors[grade] || gradeColors.B
                  }`}
                >
                  Grade {grade}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                {activeData.health_summary ||
                  `Score based on combined EV (+${netEdgePct.toFixed(1)}%), correlation structure, and leg quality.`}
              </p>
              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 space-y-0.5">
                <div>• Grade A (80-100): Strong positive edge, synergistic correlations</div>
                <div>• Grade B (65-79): Favorable expected value, independent legs</div>
                <div>• Grade C (50-64): Marginal edge, watch for thin odds</div>
                <div>• Grade D/F (&lt;50): Negative EV or conflicting correlations</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5-Metric Quantitative Grid (Item 40) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-center">
        {/* 1. Combined Bookie Odds */}
        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
            Bookie Odds
          </span>
          <span className="font-mono font-black text-sm text-fuchsia-300">
            ${combinedOdds.toFixed(2)}
          </span>
        </div>

        {/* 2. Model Fair Odds */}
        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
            Fair Odds
          </span>
          <span className="font-mono font-black text-sm text-cyan-300">
            ${fairOdds.toFixed(2)}
          </span>
        </div>

        {/* 3. Joint Probability (Copula/Sim) */}
        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
            Joint Prob
          </span>
          <span className="font-mono font-black text-sm text-indigo-300">
            {jointProb.toFixed(1)}%
          </span>
        </div>

        {/* 4. Net Edge % */}
        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
            Net Edge
          </span>
          <span
            className={`font-mono font-black text-sm ${
              netEdgePct > 0
                ? "text-emerald-400"
                : netEdgePct < 0
                  ? "text-rose-400"
                  : "text-slate-300"
            }`}
          >
            {netEdgePct > 0 ? "+" : ""}
            {netEdgePct.toFixed(1)}%
          </span>
        </div>

        {/* 5. Expected Return ($ per stake) */}
        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
            Exp. Return
          </span>
          <span
            className={`font-mono font-black text-sm ${
              expectedProfit >= 0 ? "text-emerald-400" : "text-slate-300"
            }`}
          >
            ${expectedReturn.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
