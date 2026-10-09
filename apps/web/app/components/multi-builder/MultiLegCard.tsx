"use client";

import React from "react";
import { Trash2, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import type { EVLeg, PairwiseWarning } from "./types";

interface MultiLegCardProps {
  leg: EVLeg;
  index: number;
  onRemove: (id: string) => void;
  warnings?: PairwiseWarning[];
}

export default function MultiLegCard({
  leg,
  index,
  onRemove,
  warnings = [],
}: MultiLegCardProps) {
  const sport = leg.sport.toUpperCase();
  const backPrice = leg.backPrice ?? leg.bestOdds ?? leg.best_odds ?? 1.90;
  const layPrice = leg.layPrice ?? leg.lay_price;
  const edge = leg.edgePct ?? leg.edge_pct ?? 0;

  const relevantWarnings = warnings.filter(
    (w) => w.leg_a_index === index || w.leg_b_index === index
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg relative group transition-all hover:border-slate-700">
      {/* Header: Leg number, Sport & Game Context, and Remove button */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            Leg {index + 1}
          </span>
          <span className="text-xs font-semibold text-slate-400">
            {sport === "NBA" ? "🏀 NBA" : sport === "NFL" ? "🏈 NFL" : sport} | {leg.gameContext || leg.game_context}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onRemove(leg.id)}
          className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          title="Remove Leg"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Leg Description */}
      <h3 className="text-base font-bold text-white mb-3">
        {leg.legDescription || leg.leg_description}
      </h3>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
        <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/80">
          <span className="text-slate-400 block mb-0.5">Back Price</span>
          <span className="font-mono font-bold text-slate-200 text-sm">
            {backPrice.toFixed(2)}
          </span>
        </div>

        <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/80">
          <span className="text-slate-400 block mb-0.5">Lay Price</span>
          <span className="font-mono font-bold text-slate-400 text-sm">
            {layPrice ? layPrice.toFixed(2) : "—"}
          </span>
        </div>

        <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/80">
          <span className="text-slate-400 block mb-0.5">Edge</span>
          <span className={`font-mono font-bold text-sm ${edge >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {edge >= 0 ? "+" : ""}{edge.toFixed(1)}%
          </span>
        </div>

        <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block mb-0.5">Status</span>
            <span className="font-semibold text-emerald-400 text-xs flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Added
            </span>
          </div>
        </div>
      </div>

      {/* Correlation Notes / Warnings specific to this leg */}
      {relevantWarnings.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
          {relevantWarnings.map((w, wIdx) => {
            const isPartner = w.leg_a_index === index ? w.leg_b_index : w.leg_a_index;
            const partnerDesc = w.leg_a_index === index ? w.leg_b_desc : w.leg_a_desc;

            let badgeStyle = "bg-slate-800/80 text-slate-300 border-slate-700";
            let IconComponent = Info;

            if (w.level === "high") {
              badgeStyle = "bg-rose-500/10 text-rose-300 border-rose-500/30";
              IconComponent = AlertTriangle;
            } else if (w.level === "mild") {
              badgeStyle = "bg-amber-500/10 text-amber-300 border-amber-500/30";
              IconComponent = AlertTriangle;
            } else if (w.level === "negative") {
              badgeStyle = "bg-blue-500/10 text-blue-300 border-blue-500/30";
              IconComponent = Info;
            }

            return (
              <div
                key={wIdx}
                className={`text-[11px] sm:text-xs rounded-lg p-2 border flex items-start gap-2 ${badgeStyle}`}
              >
                <IconComponent className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Correlation Note:</span>{" "}
                  {w.message} with Leg {isPartner + 1} ({partnerDesc}).
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
