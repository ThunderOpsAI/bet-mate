"use client";

import React, { useState } from "react";
import { Sparkles, TrendingUp, ChevronDown, ChevronUp, Check, ExternalLink } from "lucide-react";

export interface BestPriceBadgeProps {
  currentOdds: number;
  selection: string;
  bookiePrices?: Record<string, number>;
  source?: "market" | "model_fair" | "missing";
  className?: string;
}

export default function BestPriceBadge({
  currentOdds,
  selection,
  bookiePrices,
  source = "market",
  className = "",
}: BestPriceBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // If bookie prices are passed, find the max and compare
  const priceEntries = bookiePrices ? Object.entries(bookiePrices) : [];
  const maxPrice = priceEntries.length > 0
    ? Math.max(...priceEntries.map(([, price]) => price))
    : currentOdds;

  const bestBookie = priceEntries.find(([, p]) => p === maxPrice)?.[0] || "Sportsbet";
  const isCurrentBest = currentOdds >= maxPrice;

  const averagePrice = priceEntries.length > 0
    ? priceEntries.reduce((sum, [, p]) => sum + p, 0) / priceEntries.length
    : currentOdds;

  const diffPct = averagePrice > 0 && currentOdds > averagePrice
    ? Math.round(((currentOdds - averagePrice) / averagePrice) * 100)
    : 0;

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 transition-all cursor-pointer shadow-xs"
        title="Click to view bookmaker price comparison"
      >
        <Sparkles size={11} className="text-emerald-400 shrink-0 animate-pulse" />
        <span>Best Price</span>
        {diffPct > 0 && (
          <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 px-1 rounded">
            +{diffPct}%
          </span>
        )}
        {isExpanded ? (
          <ChevronUp size={10} className="text-emerald-400/80" />
        ) : (
          <ChevronDown size={10} className="text-emerald-400/80" />
        )}
      </button>

      {/* Popover comparison drawer */}
      {isExpanded && (
        <div
          className="absolute left-0 mt-1 w-56 rounded-xl bg-slate-900 border border-slate-700/90 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Odds Comparison
            </span>
            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
              <Check size={11} /> Live Best
            </span>
          </div>

          {priceEntries.length > 0 ? (
            <div className="space-y-1.5">
              {priceEntries.map(([bookie, price]) => {
                const isBest = price === maxPrice;
                return (
                  <div
                    key={bookie}
                    className={`flex items-center justify-between px-2 py-1 rounded-lg text-xs ${
                      isBest
                        ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 font-bold"
                        : "bg-slate-950/60 text-slate-400"
                    }`}
                  >
                    <span className="truncate">{bookie}</span>
                    <span className="font-mono font-black">
                      ${Number(price).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1 text-xs text-slate-300">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Current Best:</span>
                <span className="font-mono font-bold text-emerald-400">
                  ${currentOdds.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Source:</span>
                <span className="capitalize text-slate-300">{source}</span>
              </div>
              <p className="text-[10px] text-slate-500 pt-1 leading-tight">
                Top bookmaker market rates synchronized via Betfair and official feeds.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
