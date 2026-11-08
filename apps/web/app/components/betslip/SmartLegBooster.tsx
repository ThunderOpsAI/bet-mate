"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, ChevronDown, ChevronUp, Plus, Zap, TrendingUp, CheckCircle2 } from "lucide-react";
import type { PaperBet } from "../../providers/PaperBetslipProvider";

interface BoosterLeg {
  sport: string;
  event_id: string;
  event_name: string;
  market_type: string;
  selection: string;
  odds: number;
  model_probability: number;
  edge: number;
  confidence: string;
  start_time?: string;
  boost_odds: number;
  boost_edge: number;
  recommendation_reason: string;
}

interface SmartLegBoosterProps {
  bets: PaperBet[];
  onAddLeg: (leg: BoosterLeg) => void;
}

export default function SmartLegBooster({ bets, onAddLeg }: SmartLegBoosterProps) {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [boosters, setBoosters] = useState<BoosterLeg[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  const fetchBoosters = useCallback(async () => {
    if (bets.length === 0) {
      setBoosters([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/multis/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_legs: bets.map((b) => ({
            sport: b.sport || "racing",
            event_id: b.event_id,
            event_name: b.event_name,
            selection: b.selection,
            market_type: b.market_type || (b.bet_type?.toLowerCase() === "place" ? "place" : "win"),
            odds: b.odds && b.odds > 1 ? b.odds : 1.90,
            model_probability: b.model_prob || (b.odds && b.odds > 1 ? 1 / b.odds : 0.5),
            edge: b.model_edge_pct ? b.model_edge_pct / 100 : 0.05,
          })),
          win_legs: 1,
          place_legs: 2,
          sport_mode: "combined",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBoosters(data.booster_legs || []);
      }
    } catch (err) {
      console.error("Failed to fetch smart leg boosters:", err);
    } finally {
      setIsLoading(false);
    }
  }, [bets]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBoosters();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchBoosters]);

  if (bets.length === 0 || boosters.length === 0) {
    return null;
  }

  const handleAdd = (leg: BoosterLeg) => {
    onAddLeg(leg);
    setAddedIds((prev) => ({ ...prev, [leg.event_id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = { ...prev };
        delete next[leg.event_id];
        return next;
      });
    }, 2500);
  };

  return (
    <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 backdrop-blur-sm overflow-hidden transition-all shadow-md">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full p-2.5 px-3 flex items-center justify-between bg-purple-950/40 hover:bg-purple-950/60 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-purple-500/20 flex items-center justify-center text-purple-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Smart Leg Booster</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-500/30 text-purple-200">
                AI EV
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400 text-xs">
          {isLoading ? (
            <span className="text-[10px] text-purple-400 animate-pulse font-mono">Syncing...</span>
          ) : (
            <span className="text-[10px] text-purple-300 font-mono">{boosters.length} suggestions</span>
          )}
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Suggested Complementary Legs */}
      {isOpen && (
        <div className="p-2.5 space-y-2 divide-y divide-purple-900/20">
          {boosters.slice(0, 3).map((leg) => {
            const isAdded = !!addedIds[leg.event_id];
            const isPlace = leg.market_type === "place";

            return (
              <div
                key={leg.event_id}
                className="pt-2 first:pt-0 flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${
                        isPlace
                          ? "bg-purple-500/30 text-purple-200 border border-purple-500/40"
                          : "bg-emerald-500/30 text-emerald-200 border border-emerald-500/40"
                      }`}
                    >
                      {isPlace ? "Place" : "Win"}
                    </span>
                    <span className="text-[10px] font-bold text-slate-200 truncate">
                      {leg.selection}
                    </span>
                    <span className="text-[10px] font-mono text-purple-300 font-bold">
                      ${leg.odds.toFixed(2)}
                    </span>
                  </div>

                  <p className="text-[10px] text-purple-300/90 font-medium truncate">
                    {leg.recommendation_reason}
                  </p>
                </div>

                {/* 1-Click Plus Button */}
                <button
                  type="button"
                  onClick={() => handleAdd(leg)}
                  disabled={isAdded}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isAdded
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-purple-600 hover:bg-purple-500 text-white shadow-sm shadow-purple-900/40"
                  }`}
                  title="Add to slip"
                >
                  {isAdded ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
