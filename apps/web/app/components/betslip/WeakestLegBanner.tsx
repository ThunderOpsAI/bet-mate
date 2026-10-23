"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  TrendingUp,
  Check,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import { API_BASE, safeResponseJson } from "../../lib/api";
import { PaperBet } from "../../providers/PaperBetslipProvider";

export interface SwapCandidate {
  original_leg_index?: number;
  original_leg?: any;
  recommended_leg?: any;
  ev_improvement?: number;
  score_improvement?: number;
  rationale?: string;
  selection?: string;
  odds?: number;
  event_name?: string;
  sport?: string;
}

export interface WeakestLegBannerProps {
  isWeakest: boolean;
  reason?: string;
  severity?: "critical" | "warning" | "minor" | string;
  legId: string;
  legSelection: string;
  allLegs: PaperBet[];
  sport?: string;
  onApplySwap: (oldLegId: string, replacement: Partial<PaperBet>) => void;
}

export default function WeakestLegBanner({
  isWeakest,
  reason,
  severity = "warning",
  legId,
  legSelection,
  allLegs,
  sport = "nba",
  onApplySwap,
}: WeakestLegBannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [swaps, setSwaps] = useState<SwapCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!isWeakest) return null;

  const handleFetchSwaps = async () => {
    setIsOpen(true);
    setLoading(true);
    setError(null);

    try {
      const payload = {
        sport: sport.toLowerCase(),
        legs: allLegs.map((l) => ({
          sport: l.sport,
          event_id: l.event_id,
          selection: l.selection,
          market_type: l.bet_type || "head_to_head",
          odds: l.odds || 1.9,
          leg_description: `${l.event_name} - ${l.selection}`,
        })),
        max_swaps: 3,
      };

      const res = await fetch(`${API_BASE}/recommendations/leg-swaps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await safeResponseJson(res);
        if (data?.swaps && Array.isArray(data.swaps)) {
          setSwaps(data.swaps);
        } else {
          setSwaps([]);
        }
      } else {
        setError("Unable to retrieve swap candidates right now.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to fetch swaps");
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSwap = (swap: SwapCandidate) => {
    const cand = swap.recommended_leg || swap;
    const replacement: Partial<PaperBet> = {
      selection: cand.selection || cand.runner_name || cand.selectionLabel || "Replacement Pick",
      event_name: cand.event_name || cand.matchup || cand.race_name || "Upcoming Event",
      odds: Number(cand.odds || cand.best_odds || 1.9),
      sport: cand.sport || sport,
      bet_type: cand.market_type || cand.bet_type || "win",
      event_id: String(cand.event_id || cand.gameId || cand.raceId || Date.now()),
      notes: cand.rationale || `Swapped in for +${swap.ev_improvement || 0}% EV boost`,
    };

    onApplySwap(legId, replacement);
    setIsOpen(false);
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          <AlertTriangle size={14} className="text-rose-400 shrink-0" />
          <span className="font-extrabold uppercase text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-500/30 shrink-0">
            Weakest Leg
          </span>
          <span className="text-[11px] text-rose-200/90 truncate">
            {reason || "Lowest EV contribution"}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) {
              setIsOpen(false);
            } else {
              handleFetchSwaps();
            }
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <ArrowLeftRight size={12} />
          <span>1-Tap Swap</span>
        </button>
      </div>

      {/* Slide-out Candidate Swap Drawer */}
      {isOpen && (
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2 text-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="font-bold text-slate-200 flex items-center gap-1">
              <Sparkles size={13} className="text-amber-400" />
              <span>Recommended Replacements</span>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              <X size={14} />
            </button>
          </div>

          {loading ? (
            <div className="py-4 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-emerald-400" />
              <span>Scanning high-EV swap candidates...</span>
            </div>
          ) : error ? (
            <div className="p-2 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-[11px]">
              {error}
            </div>
          ) : swaps.length === 0 ? (
            <div className="py-3 text-center text-slate-400 text-[11px]">
              No higher-EV candidate replacements currently active in feed.
            </div>
          ) : (
            <div className="space-y-2">
              {swaps.map((swap, idx) => {
                const cand = swap.recommended_leg || swap;
                const candSel = cand.selection || cand.selectionLabel || cand.leg_description || "Value Leg";
                const candOdds = Number(cand.odds || cand.best_odds || 1.9).toFixed(2);
                const evLift = swap.ev_improvement ?? cand.edge_pct ?? 0;

                return (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/40 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-100 truncate text-[12px]">
                        {candSel}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono font-bold text-emerald-400">${candOdds}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">
                          +{Number(evLift).toFixed(1)}% EV lift
                        </span>
                      </div>
                      {swap.rationale && (
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                          {swap.rationale}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleExecuteSwap(swap)}
                      className="px-2.5 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 font-bold text-[11px] transition-all shrink-0 cursor-pointer flex items-center gap-1"
                    >
                      <Check size={12} />
                      <span>Swap</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
