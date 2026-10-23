"use client";

import React from "react";
import type { PlayerHitRatesData, HitRateStats } from "./types";
import { TrendingUp, TrendingDown, Target, Shield, HelpCircle } from "lucide-react";

export interface HitRateTableProps {
  hitRates?: PlayerHitRatesData | null;
  line?: number;
  market?: string;
  opponent?: string | null;
  compact?: boolean;
  className?: string;
}

export function getHitRateBadgeStyle(hitRate: number): {
  badgeClass: string;
  dotClass: string;
  textClass: string;
  label: string;
} {
  if (hitRate >= 70) {
    return {
      badgeClass: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-emerald-950/20",
      dotClass: "bg-emerald-400",
      textClass: "text-emerald-400",
      label: "Strong Hit",
    };
  }
  if (hitRate >= 50) {
    return {
      badgeClass: "bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-amber-950/20",
      dotClass: "bg-amber-400",
      textClass: "text-amber-400",
      label: "Moderate",
    };
  }
  return {
    badgeClass: "bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-rose-950/20",
    dotClass: "bg-rose-400",
    textClass: "text-rose-400",
    label: "Low Hit",
  };
}

export function HitRateBadge({
  hitRate,
  showDot = true,
  className = "",
}: {
  hitRate: number;
  showDot?: boolean;
  className?: string;
}) {
  const style = getHitRateBadgeStyle(hitRate);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${style.badgeClass} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${style.dotClass}`} />}
      <span>{hitRate.toFixed(0)}%</span>
    </span>
  );
}

export function HitRateTable({
  hitRates,
  line,
  market = "Stat",
  opponent,
  compact = false,
  className = "",
}: HitRateTableProps) {
  if (!hitRates) {
    return (
      <div className={`p-4 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs ${className}`}>
        No hit rate history calculated for this line yet.
      </div>
    );
  }

  const windows: Array<{
    key: keyof PlayerHitRatesData;
    label: string;
    sublabel: string;
    data?: HitRateStats;
    icon?: React.ReactNode;
  }> = [
    {
      key: "l5",
      label: "Last 5",
      sublabel: "Recent form",
      data: hitRates.l5,
    },
    {
      key: "l10",
      label: "Last 10",
      sublabel: "Rolling sample",
      data: hitRates.l10,
    },
    {
      key: "l20",
      label: "Last 20",
      sublabel: "Medium term",
      data: hitRates.l20,
    },
    {
      key: "season",
      label: "Season",
      sublabel: "Overall average",
      data: hitRates.season,
    },
    {
      key: "vsOpponent",
      label: opponent ? `vs ${opponent}` : "vs Opponent",
      sublabel: "Head to head",
      data: hitRates.vsOpponent,
      icon: <Shield className="w-3.5 h-3.5 text-cyan-400" />,
    },
  ];

  // Filter out windows with 0 games recorded
  const activeWindows = windows.filter(
    (w) => w.data && typeof w.data.totalGames === "number" && w.data.totalGames > 0
  );

  if (activeWindows.length === 0) {
    return (
      <div className={`p-4 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs ${className}`}>
        No recorded game stats match this line ({line !== undefined ? `Line: ${line}` : ""}).
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 backdrop-blur-sm ${className}`}>
      {/* Header Info */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800/80 bg-slate-900/50">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Target className="w-3.5 h-3.5 text-cyan-400" />
          <span>Hit Rate Breakdown</span>
          {line !== undefined && (
            <span className="text-slate-400 font-normal">
              (Line: <strong className="text-white font-mono">{line}</strong> {market})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> &gt;70%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> 50-70%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> &lt;50%
          </span>
        </div>
      </div>

      {/* Table view */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800/60 bg-slate-900/30 text-[11px] font-semibold text-slate-400">
              <th className="py-2 px-3">Window</th>
              <th className="py-2 px-3 text-center">Hit Rate</th>
              <th className="py-2 px-3 text-center">Record (O/U)</th>
              <th className="py-2 px-3 text-right">Avg Stat</th>
              {line !== undefined && <th className="py-2 px-3 text-right">Diff</th>}
              {!compact && <th className="py-2 px-3 text-center">Recent Log</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {activeWindows.map(({ key, label, sublabel, data, icon }) => {
              if (!data) return null;
              const hitRate = data.hitRate ?? 0;
              const avg = data.averageValue ?? 0;
              const diff = line !== undefined ? Number((avg - line).toFixed(1)) : null;
              const isDiffPositive = diff !== null && diff >= 0;

              return (
                <tr
                  key={key}
                  className="hover:bg-slate-800/30 transition-colors duration-150"
                >
                  {/* Window label */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5 font-medium text-slate-200">
                      {icon}
                      <span>{label}</span>
                    </div>
                    {!compact && (
                      <span className="text-[10px] text-slate-500 block">
                        {sublabel}
                      </span>
                    )}
                  </td>

                  {/* Color-coded hit rate badge */}
                  <td className="py-2.5 px-3 text-center">
                    <HitRateBadge hitRate={hitRate} />
                  </td>

                  {/* Hits / Total Record */}
                  <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                    <span className="text-white font-semibold">{data.hits}</span>
                    <span className="text-slate-500">/{data.totalGames}</span>
                    {data.pushes > 0 && (
                      <span className="text-[10px] text-slate-400 ml-1">
                        ({data.pushes}P)
                      </span>
                    )}
                  </td>

                  {/* Average value */}
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-200">
                    {avg.toFixed(1)}
                  </td>

                  {/* Diff vs Line */}
                  {line !== undefined && diff !== null && (
                    <td className="py-2.5 px-3 text-right font-mono text-xs">
                      <span
                        className={`inline-flex items-center gap-0.5 ${
                          isDiffPositive ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {isDiffPositive ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    </td>
                  )}

                  {/* Recent Game Value Dots if available */}
                  {!compact && (
                    <td className="py-2.5 px-3 text-center">
                      {data.values && data.values.length > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          {data.values.slice(0, 10).map((v, i) => {
                            const isHit = line !== undefined ? v >= line : true;
                            return (
                              <span
                                key={i}
                                title={`Game ${i + 1}: ${v} ${market}`}
                                className={`w-2 h-2 rounded-full cursor-help transition-transform hover:scale-125 ${
                                  isHit ? "bg-emerald-400 shadow-sm shadow-emerald-500/50" : "bg-rose-500/60"
                                }`}
                              />
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500">-</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default HitRateTable;
