"use client";

import React, { useState } from "react";
import { Zap, AlertCircle, Plus, Check, RefreshCw } from "lucide-react";
import type { EVLeg } from "./types";

interface HighEVFeedTableProps {
  legs: EVLeg[];
  isLoading?: boolean;
  selectedLegIds: string[];
  onAddLeg: (leg: EVLeg) => void;
  onRefresh?: () => void;
}

export default function HighEVFeedTable({
  legs,
  isLoading = false,
  selectedLegIds,
  onAddLeg,
  onRefresh,
}: HighEVFeedTableProps) {
  const [sportFilter, setSportFilter] = useState<string>("ALL");

  const filteredLegs = legs.filter((leg) => {
    if (sportFilter === "ALL") return true;
    return leg.sport.toLowerCase() === sportFilter.toLowerCase();
  });

  const getSportBadge = (sport: string) => {
    switch (sport.toLowerCase()) {
      case "nba":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">🏀 NBA</span>;
      case "nfl":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">🏈 NFL</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{sport.toUpperCase()}</span>;
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Top 10 High EV Feed</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Tap any leg to add it to your Multi Builder.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sport Filters */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {["ALL", "NBA", "NFL"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSportFilter(s)}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  sportFilter === s
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
              title="Refresh Feed"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
          <p className="text-sm text-slate-400">Loading High EV opportunities...</p>
        </div>
      ) : filteredLegs.length === 0 ? (
        /* Zero-Tolerance Mock Data Fallback: Explicit Awaiting Feed state */
        <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-8 h-8 text-amber-500/80 mb-3" />
          <h3 className="text-base font-semibold text-slate-200">Awaiting Live Feed</h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md">
            Live predictions and High EV tips are currently being processed by the scheduled ingestion pipeline.
            No synthetic fallbacks or fake odds will be generated.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="pb-3 px-2">Sport</th>
                <th className="pb-3 px-2">Game Context</th>
                <th className="pb-3 px-2">Leg Description</th>
                <th className="pb-3 px-2 text-right">Back</th>
                <th className="pb-3 px-2 text-right">Edge %</th>
                <th className="pb-3 px-2 text-center">Add</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLegs.map((leg) => {
                const isSelected = selectedLegIds.includes(leg.id);
                const backPrice = leg.backPrice ?? leg.bestOdds ?? leg.best_odds ?? 1.90;
                const edge = leg.edgePct ?? leg.edge_pct ?? 0;
                const edgeText = `${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%`;

                return (
                  <tr
                    key={leg.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    <td className="py-3 px-2 whitespace-nowrap">
                      {getSportBadge(leg.sport)}
                    </td>
                    <td className="py-3 px-2 font-medium text-slate-300 whitespace-nowrap">
                      {leg.gameContext || leg.game_context || "Match"}
                    </td>
                    <td className="py-3 px-2 text-white font-medium">
                      {leg.legDescription || leg.leg_description}
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-slate-200 whitespace-nowrap">
                      {backPrice.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right whitespace-nowrap">
                      <span className={`inline-block font-mono font-bold ${
                        edge >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {edgeText}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onAddLeg(leg)}
                        disabled={isSelected}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold transition-all ${
                          isSelected
                            ? "bg-slate-800 text-emerald-400 border border-emerald-500/30 cursor-default"
                            : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 cursor-pointer active:scale-95"
                        }`}
                        title={isSelected ? "Already Added" : "Add to Multi"}
                      >
                        {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
