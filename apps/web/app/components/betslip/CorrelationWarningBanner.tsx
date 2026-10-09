"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  AlertTriangle,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";

export interface PairwiseWarning {
  leg_a_index: number;
  leg_b_index: number;
  leg_a_desc: string;
  leg_b_desc: string;
  rho: number;
  level: "high" | "mild" | "negative" | "none" | string;
  color?: string;
  message: string;
}

export interface CorrelationWarningBannerProps {
  warnings: PairwiseWarning[];
  correlationScore?: number;
  correlationSummary?: string;
  className?: string;
}

export default function CorrelationWarningBanner({
  warnings = [],
  correlationScore,
  correlationSummary,
  className = "",
}: CorrelationWarningBannerProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!warnings || warnings.length === 0) {
    if (correlationScore !== undefined && correlationScore > 0.05) {
      return (
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold ${className}`}
        >
          <Zap size={14} className="text-emerald-400 shrink-0" />
          <span>Positive Correlation Boost (+{Math.round(correlationScore * 100)}% copula lift)</span>
        </div>
      );
    }
    return null;
  }

  const positiveBoosts = warnings.filter(
    (w) => w.rho > 0.15 || w.level === "high" || (w.level === "mild" && w.rho > 0),
  );
  const negativeConflicts = warnings.filter(
    (w) => w.rho < -0.10 || w.level === "negative",
  );

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* 1. Negative Conflict Warning Banner */}
      {negativeConflicts.length > 0 && (
        <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between font-bold">
            <div className="flex items-center gap-1.5 text-rose-300">
              <AlertTriangle size={15} className="text-rose-400 shrink-0 animate-bounce" />
              <span>Correlation Conflict Warning</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-950/80 text-[10px] font-mono border border-rose-500/40">
                ρ = {negativeConflicts[0].rho.toFixed(2)}
              </span>
            </div>
            {warnings.length > 1 && (
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-[11px] text-rose-300/80 hover:text-rose-100 flex items-center gap-0.5 cursor-pointer"
              >
                {showDetails ? "Hide" : "Details"}
                {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>
          <p className="text-[11px] text-rose-200/90 leading-tight">
            {negativeConflicts[0].leg_a_desc} and {negativeConflicts[0].leg_b_desc} negatively correlate in the game script, reducing the combined probability.
          </p>
        </div>
      )}

      {/* 2. Positive Correlation Boost Pill */}
      {positiveBoosts.length > 0 && (
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between font-bold">
            <div className="flex items-center gap-1.5 text-emerald-300">
              <Zap size={15} className="text-emerald-400 shrink-0" />
              <span>Positive Correlation Boost</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-[10px] font-mono border border-emerald-500/40">
                ρ = +{positiveBoosts[0].rho.toFixed(2)}
              </span>
            </div>
            {warnings.length > 1 && !negativeConflicts.length && (
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-[11px] text-emerald-300/80 hover:text-emerald-100 flex items-center gap-0.5 cursor-pointer"
              >
                {showDetails ? "Hide" : "Details"}
                {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>
          <p className="text-[11px] text-emerald-200/90 leading-tight">
            {positiveBoosts[0].leg_a_desc} & {positiveBoosts[0].leg_b_desc} reinforce each other, lifting joint hit rate above independent odds.
          </p>
        </div>
      )}

      {/* 3. Expandable Pairwise Matrix Details */}
      {showDetails && warnings.length > 0 && (
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs animate-in fade-in duration-150">
          <div className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1">
            All Pairwise Leg Correlations
          </div>
          {warnings.map((w, idx) => {
            const isPos = w.rho > 0.05;
            const isNeg = w.rho < -0.05;
            return (
              <div
                key={idx}
                className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px]"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-semibold text-slate-200 truncate block">
                    {w.leg_a_desc} × {w.leg_b_desc}
                  </span>
                  <span className="text-[10px] text-slate-400">{w.message}</span>
                </div>
                <span
                  className={`font-mono font-black shrink-0 px-1.5 py-0.5 rounded text-[10px] ${
                    isNeg
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : isPos
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400"
                  }`}
                >
                  ρ = {w.rho > 0 ? "+" : ""}{w.rho.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
