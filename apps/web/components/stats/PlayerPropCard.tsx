"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Users,
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  ArrowUpRight,
  Shield,
  Clock,
  Sparkles,
} from "lucide-react";
import type { PlayerProp, PlayerProfile } from "./types";
import { HitRateTable, HitRateBadge } from "./HitRateTable";
import { DefenseVsPositionBadge } from "./DefenseVsPositionBadge";
import { useBetslip } from "./useBetslip";

export interface PlayerPropCardProps {
  prop: PlayerProp;
  onCompare?: (player: PlayerProfile) => void;
  defaultExpanded?: boolean;
  className?: string;
}

export function PlayerPropCard({
  prop,
  onCompare,
  defaultExpanded = false,
  className = "",
}: PlayerPropCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { addPropBet, isPropInSlip } = useBetslip();

  const isOverInSlip = isPropInSlip(prop, "Over");
  const isUnderInSlip = isPropInSlip(prop, "Under");

  const player = prop.player;
  const bestOdds = prop.bestOdds;
  const hitRate = prop.hitRate;
  const edgePct = bestOdds?.edgePct ?? null;
  const edgeFormatted =
    edgePct !== null
      ? (edgePct > 1 ? edgePct : edgePct * 100).toFixed(1)
      : null;

  // Extract over and under odds
  const overOdds =
    prop.odds?.find((o) => o.selection.toLowerCase().includes("over"))?.price ||
    (bestOdds?.selection.toLowerCase().includes("over") ? bestOdds.price : 1.90);

  const underOdds =
    prop.odds?.find((o) => o.selection.toLowerCase().includes("under"))?.price ||
    (bestOdds?.selection.toLowerCase().includes("under") ? bestOdds.price : 1.85);

  const marketDisplayName =
    prop.marketType.charAt(0).toUpperCase() + prop.marketType.slice(1).toLowerCase();

  return (
    <div
      className={`group relative flex flex-col rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 p-4 sm:p-5 shadow-lg shadow-black/30 backdrop-blur-md transition-all duration-200 hover:shadow-cyan-950/20 ${className}`}
      data-testid={`player-prop-card-${prop.id}`}
    >
      {/* Top Header: Player Avatar, Name, Position, Team, Matchup */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {/* Player avatar initial badge */}
          <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center font-black text-slate-200 text-sm shadow-inner shrink-0 group-hover:border-cyan-500/40 transition-colors">
            {player.fullName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
            {player.jerseyNum && (
              <span className="absolute -bottom-1 -right-1 text-[9px] font-mono px-1 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                #{player.jerseyNum}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-white text-base tracking-tight leading-snug group-hover:text-cyan-300 transition-colors">
                {player.fullName}
              </h4>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span className="font-semibold text-slate-300">
                {player.team || "Team"}
              </span>
              {player.position && (
                <>
                  <span className="text-slate-600">&bull;</span>
                  <span>{player.position}</span>
                </>
              )}
              {prop.matchup && (
                <>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-slate-400">{prop.matchup}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls: Compare button */}
        {onCompare && (
          <button
            type="button"
            onClick={() => onCompare(player)}
            title={`Compare ${player.fullName} with another player`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/60 transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Compare</span>
          </button>
        )}
      </div>

      {/* Market, Line, Edge Pill, Hit Rate Pill */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 py-2.5 px-3 rounded-xl bg-slate-950/60 border border-slate-800/70 mb-3.5">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
            {marketDisplayName}
          </span>
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-xs text-slate-400">Line:</span>
            <span className="text-base font-black text-white">{prop.line}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Edge % Badge */}
          {edgeFormatted !== null && (
            <div
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                Number(edgeFormatted) > 0
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-xs shadow-emerald-950"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
              title="Mathematical Expected Value edge against fair probability"
            >
              <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
              <span>+{edgeFormatted}% Edge</span>
            </div>
          )}

          {/* Hit-Rate Pill */}
          {hitRate && (
            <div
              className="flex items-center gap-1.5"
              title={`Hit rate: ${hitRate.hits}/${hitRate.totalGames} games over this line`}
            >
              <HitRateBadge hitRate={hitRate.hitRate} />
              <span className="text-[11px] font-mono text-slate-400">
                ({hitRate.hits}/{hitRate.totalGames})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Defense vs Position context if available */}
      {prop.defenseVsPosition && (
        <div className="mb-3.5">
          <DefenseVsPositionBadge
            rank={prop.defenseVsPosition.rank}
            totalTeams={prop.defenseVsPosition.totalTeams}
            position={prop.defenseVsPosition.position || player.position || "Position"}
            concededAvg={prop.defenseVsPosition.concededAvg}
            statCategory={marketDisplayName}
          />
        </div>
      )}

      {/* One-Tap Over/Under Buttons connecting to Betslip */}
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        {/* Over Button */}
        <button
          type="button"
          onClick={() => addPropBet(prop, "Over", overOdds)}
          className={`relative flex items-center justify-between px-3.5 py-2.5 rounded-xl border font-medium text-xs transition-all duration-200 active:scale-[0.98] ${
            isOverInSlip
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-xs shadow-emerald-950"
              : "bg-slate-800/90 hover:bg-slate-750 text-slate-200 hover:text-white border-slate-700 hover:border-slate-600 shadow-sm"
          }`}
          data-testid={`bet-over-btn-${prop.id}`}
        >
          <div className="flex items-center gap-1.5">
            {isOverInSlip ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            )}
            <span className="font-bold">Over {prop.line}</span>
          </div>
          <span className="font-mono font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/50">
            ${overOdds.toFixed(2)}
          </span>
        </button>

        {/* Under Button */}
        <button
          type="button"
          onClick={() => addPropBet(prop, "Under", underOdds)}
          className={`relative flex items-center justify-between px-3.5 py-2.5 rounded-xl border font-medium text-xs transition-all duration-200 active:scale-[0.98] ${
            isUnderInSlip
              ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-xs shadow-rose-950"
              : "bg-slate-800/90 hover:bg-slate-750 text-slate-200 hover:text-white border-slate-700 hover:border-slate-600 shadow-sm"
          }`}
          data-testid={`bet-under-btn-${prop.id}`}
        >
          <div className="flex items-center gap-1.5">
            {isUnderInSlip ? (
              <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span className="font-bold">Under {prop.line}</span>
          </div>
          <span className="font-mono font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/50">
            ${underOdds.toFixed(2)}
          </span>
        </button>
      </div>

      {/* Expandable Hit Rate Table Drawer */}
      <div className="mt-1">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-cyan-300 transition-colors"
        >
          <span>{isExpanded ? "Hide Hit Rate Details" : "View Hit Rates (L5, L10, L20)"}</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {isExpanded && (
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 animate-in fade-in duration-200">
            <HitRateTable
              hitRates={
                prop.hitRates ||
                (hitRate
                  ? {
                      l10: hitRate,
                      season: hitRate,
                    }
                  : undefined)
              }
              line={prop.line}
              market={marketDisplayName}
              opponent={prop.matchup?.split(" ")[1] || null}
              compact={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default PlayerPropCard;
