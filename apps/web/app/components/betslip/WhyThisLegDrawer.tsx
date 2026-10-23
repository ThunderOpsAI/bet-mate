"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Flame,
  Gauge,
} from "lucide-react";

export interface WhyThisLegDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  selection: string;
  eventName: string;
  odds: number;
  modelFairOdds?: number;
  modelProb?: number;
  edgePct?: number;
  confidence?: "high" | "medium" | "low";
  rationale?: string;
  recentForm?: string;
  sport?: string;
}

export default function WhyThisLegDrawer({
  isOpen,
  onToggle,
  selection,
  eventName,
  odds,
  modelFairOdds,
  modelProb,
  edgePct,
  confidence = "medium",
  rationale,
  recentForm,
  sport = "nba",
}: WhyThisLegDrawerProps) {
  const impliedProb = odds > 0 ? (1 / odds) * 100 : 0;
  const trueProbPct = modelProb ? (modelProb > 1 ? modelProb : modelProb * 100) : impliedProb;

  const calculatedEdge = edgePct !== undefined
    ? edgePct
    : modelFairOdds && modelFairOdds > 0
      ? Math.round(((odds / modelFairOdds) - 1) * 1000) / 10
      : Math.round(((trueProbPct / Math.max(1, impliedProb)) - 1) * 1000) / 10;

  const fairOddsVal = modelFairOdds
    ? modelFairOdds
    : trueProbPct > 0
      ? Math.round((100 / trueProbPct) * 100) / 100
      : odds;

  const confidenceColor =
    confidence === "high"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : confidence === "low"
        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
        : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";

  return (
    <div className="mt-2 border-t border-slate-800/80 pt-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="w-full flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-slate-200 py-1 transition-colors group cursor-pointer"
      >
        <span className="flex items-center gap-1.5 text-cyan-400/90 group-hover:text-cyan-300">
          <Brain size={13} className="text-cyan-400 animate-pulse" />
          <span>Why This Leg?</span>
          {calculatedEdge > 0 && (
            <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/30">
              +{calculatedEdge.toFixed(1)}% EV
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 text-slate-500 group-hover:text-slate-300">
          <span className="text-[10px] uppercase font-semibold">
            {isOpen ? "Hide Analysis" : "View Insights"}
          </span>
          {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 text-xs">
              {/* Top stats bar */}
              <div className="grid grid-cols-3 gap-2 text-center pb-2 border-b border-slate-800">
                <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
                    Net Edge
                  </span>
                  <span
                    className={`font-mono font-black text-xs ${
                      calculatedEdge > 0
                        ? "text-emerald-400"
                        : calculatedEdge < 0
                          ? "text-rose-400"
                          : "text-slate-300"
                    }`}
                  >
                    {calculatedEdge > 0 ? "+" : ""}
                    {calculatedEdge.toFixed(1)}%
                  </span>
                </div>

                <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
                    Model Fair
                  </span>
                  <span className="font-mono font-black text-xs text-cyan-300">
                    ${fairOddsVal.toFixed(2)}
                  </span>
                </div>

                <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
                    Model Hit %
                  </span>
                  <span className="font-mono font-black text-xs text-indigo-300">
                    {trueProbPct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Probability Comparison Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">
                    Model Win Prob ({trueProbPct.toFixed(1)}%) vs Market ({impliedProb.toFixed(1)}%)
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase border ${confidenceColor}`}
                  >
                    {confidence} Confidence
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(5, trueProbPct))}%` }}
                  />
                </div>
              </div>

              {/* Quantitative Rationale */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
                  <Flame size={12} className="text-amber-400" />
                  <span>Model Rationale</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
                  {rationale ||
                    `Model estimates true probability at ${trueProbPct.toFixed(1)}% against bookmaker implied probability of ${impliedProb.toFixed(1)}%, generating positive mathematical expected value.`}
                </p>
              </div>

              {/* Recent Form / Context */}
              {recentForm && (
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
                    <TrendingUp size={12} className="text-emerald-400" />
                    <span>Recent Form & Trends</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
                    {recentForm}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
