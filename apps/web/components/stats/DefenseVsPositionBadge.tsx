"use client";

import React from "react";
import { Shield, ShieldAlert, ShieldCheck, Info } from "lucide-react";

export interface DefenseVsPositionBadgeProps {
  rank: number;
  totalTeams?: number;
  position?: string;
  team?: string;
  statCategory?: string;
  concededAvg?: number;
  variant?: "badge" | "compact" | "card";
  className?: string;
}

export function getMatchupTier(
  rank: number,
  totalTeams: number = 30
): {
  tier: "favorable" | "neutral" | "tough";
  label: string;
  shortLabel: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
  icon: React.ElementType;
} {
  // Defensive ranking: rank 1 is best defense (hardest for offense), rank 30 is worst defense (easiest for offense)
  const ratio = rank / totalTeams;

  if (ratio >= 0.67 || rank >= totalTeams - 9) {
    // Top third of high conceded stats = Favorable matchup for offensive players
    return {
      tier: "favorable",
      label: "Favorable Matchup",
      shortLabel: "Favorable",
      colorClass: "text-emerald-400",
      bgClass: "bg-emerald-500/15",
      borderClass: "border-emerald-500/30",
      badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      icon: ShieldCheck,
    };
  }

  if (ratio <= 0.33 || rank <= 10) {
    // Tough defense = Tough matchup for player props
    return {
      tier: "tough",
      label: "Tough Matchup",
      shortLabel: "Tough",
      colorClass: "text-rose-400",
      bgClass: "bg-rose-500/15",
      borderClass: "border-rose-500/30",
      badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      icon: ShieldAlert,
    };
  }

  return {
    tier: "neutral",
    label: "Neutral Matchup",
    shortLabel: "Neutral",
    colorClass: "text-sky-400",
    bgClass: "bg-sky-500/15",
    borderClass: "border-sky-500/30",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    icon: Shield,
  };
}

function getOrdinalSuffix(i: number): string {
  const j = i % 10;
  const k = i % 100;
  if (j === 1 && k !== 11) return `${i}st`;
  if (j === 2 && k !== 12) return `${i}nd`;
  if (j === 3 && k !== 13) return `${i}rd`;
  return `${i}th`;
}

export function DefenseVsPositionBadge({
  rank,
  totalTeams = 30,
  position = "Position",
  team,
  statCategory,
  concededAvg,
  variant = "badge",
  className = "",
}: DefenseVsPositionBadgeProps) {
  const matchup = getMatchupTier(rank, totalTeams);
  const Icon = matchup.icon;
  const rankDisplay = getOrdinalSuffix(rank);

  if (variant === "compact") {
    return (
      <span
        title={`Rank ${rankDisplay} of ${totalTeams} defense vs ${position} (${matchup.label})`}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${matchup.badgeClass} ${className}`}
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span>#{rank} vs {position}</span>
        <span className="opacity-80">({matchup.shortLabel})</span>
      </span>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={`p-3 rounded-xl border ${matchup.borderClass} ${matchup.bgClass} backdrop-blur-sm ${className}`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Icon className={`w-4 h-4 ${matchup.colorClass}`} />
            <span className={`text-xs font-bold ${matchup.colorClass}`}>
              {matchup.label}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {rankDisplay} / {totalTeams}
          </span>
        </div>

        <p className="text-xs text-slate-300 font-medium">
          {team ? `${team} ranks ` : "Ranks "}
          <strong className="text-white font-bold">{rankDisplay}</strong> against{" "}
          <span className="text-cyan-300">{position}</span>
          {statCategory ? ` for ${statCategory}` : ""}.
        </p>

        {concededAvg !== undefined && (
          <div className="mt-2 pt-2 border-t border-slate-700/40 flex items-center justify-between text-[11px] text-slate-400">
            <span>Avg allowed:</span>
            <span className="font-mono font-semibold text-slate-200">
              {concededAvg.toFixed(1)} {statCategory || ""}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Default "badge" variant: e.g. "Rank 28th vs Guards - Favorable matchup"
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-xs ${matchup.badgeClass} ${className}`}
      data-testid="defense-vs-position-badge"
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>
        Rank <strong className="font-bold">{rankDisplay}</strong> vs{" "}
        <span className="underline decoration-dotted decoration-slate-400/50">{position}</span>
        {" "}&mdash;{" "}
        <span className="font-semibold">{matchup.label}</span>
      </span>
    </div>
  );
}

export default DefenseVsPositionBadge;
