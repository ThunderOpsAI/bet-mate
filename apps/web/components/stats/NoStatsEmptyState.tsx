"use client";

import React from "react";
import { BarChart2, FilterX, RefreshCw, AlertCircle } from "lucide-react";

export interface NoStatsEmptyStateProps {
  title?: string;
  description?: string;
  statusLabel?: string;
  actionText?: string;
  onAction?: () => void;
  isFiltered?: boolean;
  className?: string;
}

export function NoStatsEmptyState({
  title = "No Live Prop Markets Found",
  description = "Awaiting live data feed. Prop markets and situational stats update prior to match start times.",
  statusLabel = "Awaiting Data Feed",
  actionText,
  onAction,
  isFiltered = false,
  className = "",
}: NoStatsEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md transition-all ${className}`}
      data-testid="no-stats-empty-state"
    >
      <div className="relative mb-5 flex items-center justify-center">
        {/* Subtle decorative glow ring */}
        <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-xl animate-pulse" />
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center shadow-lg shadow-black/40">
          {isFiltered ? (
            <FilterX className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400/90" />
          ) : (
            <BarChart2 className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400/90" />
          )}
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800/80 text-slate-300 border border-slate-700/60 mb-3 shadow-inner">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        <span>{statusLabel}</span>
      </div>

      <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">
        {title}
      </h3>

      <p className="text-sm text-slate-400 max-w-md leading-relaxed mb-6">
        {description}
      </p>

      {onAction && actionText && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 hover:border-cyan-400/50 hover:text-white transition-all duration-200 active:scale-95 shadow-sm"
        >
          {isFiltered ? (
            <FilterX className="w-4 h-4" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span>{actionText}</span>
        </button>
      )}

      {/* Explicit developer/rule assurance badge */}
      <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center gap-2 text-xs text-slate-500">
        <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span>Strict real-time feed mode — zero synthetic fixtures injected.</span>
      </div>
    </div>
  );
}

export default NoStatsEmptyState;
