"use client";

import React, { useState } from "react";
import { AlertTriangle, Info, CheckCircle2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import type { SGMPriceResult, PairwiseWarning } from "./types";

interface MultiSummaryPanelProps {
  legCount: number;
  pricing: SGMPriceResult | null;
  warnings?: PairwiseWarning[];
  stake: number;
  onStakeChange: (newStake: number) => void;
  onPlaceBet: () => Promise<void>;
  onClearMulti: () => void;
  isPlacing?: boolean;
}

export default function MultiSummaryPanel({
  legCount,
  pricing,
  warnings = [],
  stake,
  onStakeChange,
  onPlaceBet,
  onClearMulti,
  isPlacing = false,
}: MultiSummaryPanelProps) {
  const [quickStakes] = useState([5, 10, 25, 50]);

  // Overall highest warning if any
  const highWarning = warnings.find((w) => w.level === "high" || w.level === "negative" || w.level === "mild");

  // Dynamic EV calculation based on active stake
  const combinedOdds = pricing?.combined_odds ?? 1.0;
  const copulaProb = pricing?.adjusted_probability ?? 0.0;
  const expectedReturn = pricing
    ? (stake * combinedOdds * copulaProb) - stake
    : 0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm sticky top-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Multi Summary Panel</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {legCount} {legCount === 1 ? "leg" : "legs"} selected
          </p>
        </div>
        {legCount > 0 && (
          <button
            type="button"
            onClick={onClearMulti}
            className="text-xs text-slate-400 hover:text-rose-400 transition-colors font-medium px-2 py-1 rounded bg-slate-950 border border-slate-800 cursor-pointer"
          >
            Clear Multi
          </button>
        )}
      </div>

      {/* Global Correlation Warning Banner */}
      {highWarning && (
        <div
          className={`mb-5 p-3.5 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 ${
            highWarning.level === "high"
              ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
              : highWarning.level === "negative"
              ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
              : "bg-amber-500/10 text-amber-300 border-amber-500/30"
          }`}
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5">Correlation Warning</span>
            <span>
              <em>{highWarning.leg_a_desc}</em> and <em>{highWarning.leg_b_desc}</em> have a {highWarning.message.toLowerCase()}.
              The combined true probability has been adjusted via Gaussian Copula.
            </span>
          </div>
        </div>
      )}

      {legCount < 2 ? (
        <div className="py-8 text-center text-slate-500 text-xs sm:text-sm border border-dashed border-slate-800 rounded-xl p-6">
          Add at least 2 legs from the High EV Feed to calculate Same-Game or Cross-Sport Multi pricing.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Table */}
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-850 text-xs sm:text-sm">
            {/* Combined Back Price */}
            <div className="p-3 sm:p-3.5 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200 block">Combined Back Price</span>
                <span className="text-[11px] text-slate-500">Standard parlay cumulative odds</span>
              </div>
              <span className="font-mono font-bold text-base sm:text-lg text-white">
                {combinedOdds.toFixed(2)}
              </span>
            </div>

            {/* Combined True Probability */}
            <div className="p-3 sm:p-3.5 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200 block">Combined True Probability</span>
                <span className="text-[11px] text-emerald-400/90 font-medium">
                  Gaussian Copula Adjusted
                </span>
              </div>
              <span className="font-mono font-bold text-base sm:text-lg text-emerald-400">
                {(copulaProb * 100).toFixed(1)}%
              </span>
            </div>

            {/* Combined Edge % */}
            <div className="p-3 sm:p-3.5 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200 block">Combined Edge %</span>
                <span className="text-[11px] text-slate-500">Mathematical value over bookmaker</span>
              </div>
              <span
                className={`font-mono font-bold text-base sm:text-lg ${
                  (pricing?.combined_edge_pct ?? 0) >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {(pricing?.combined_edge_pct ?? 0) >= 0 ? "+" : ""}
                {(pricing?.combined_edge_pct ?? 0).toFixed(1)}%
              </span>
            </div>

            {/* EV Display */}
            <div className="p-3 sm:p-3.5 flex items-center justify-between bg-slate-900/40">
              <div>
                <span className="font-bold text-slate-200 block">EV Display</span>
                <span className="text-[11px] text-slate-400">Expected net return per ${stake} stake</span>
              </div>
              <span
                className={`font-mono font-black text-base sm:text-xl flex items-center gap-1 ${
                  expectedReturn >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {expectedReturn >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {expectedReturn >= 0 ? "+" : ""}${expectedReturn.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Stake Selector */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
              <span>Stake Amount</span>
              <div className="flex items-center gap-1">
                {quickStakes.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onStakeChange(val)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                      stake === val
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
              <input
                type="number"
                min="1"
                step="1"
                value={stake || ""}
                onChange={(e) => onStakeChange(Math.max(1, Number(e.target.value) || 1))}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="Stake"
              />
            </div>
          </div>

          {/* Place Bet Action Button */}
          <button
            type="button"
            onClick={onPlaceBet}
            disabled={isPlacing || legCount < 2}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-[0.98] ${
              isPlacing
                ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
            }`}
          >
            {isPlacing ? (
              <span>Placing Multi Bet...</span>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Place Bet (${stake})</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
