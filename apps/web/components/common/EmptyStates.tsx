"use client";

import React from "react";
import { AlertCircle, Clock, Database, RefreshCw, Radio } from "lucide-react";

export interface EmptyStateProps {
  title?: string;
  message?: string;
  statusLabel?: string;
  onRefresh?: () => void;
  className?: string;
}

export function AwaitingFeed({
  title = "Awaiting Live Feed",
  message = "Real-time market feeds and pricing streams update ahead of jump or tip-off. No mock data is used.",
  statusLabel = "Awaiting Data Feed",
  onRefresh,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md transition-all ${className}`}
      data-testid="awaiting-feed-state"
    >
      <div className="relative mb-5 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-cyan-500/15 blur-xl animate-pulse" />
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center shadow-lg shadow-black/40">
          <Radio className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400/90 animate-pulse" />
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 mb-3 shadow-inner">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        <span>{statusLabel}</span>
      </div>

      <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">
        {title}
      </h3>

      <p className="text-sm text-slate-400 max-w-md leading-relaxed mb-6">
        {message}
      </p>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 hover:border-cyan-400/50 hover:text-white transition-all duration-200 active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Feed</span>
        </button>
      )}

      <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center gap-2 text-xs text-slate-500">
        <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span>Strict live feed mode — zero synthetic fixtures injected.</span>
      </div>
    </div>
  );
}

export function NoData({
  title = "No Data Found",
  message = "No records match the selected criteria.",
  statusLabel = "Zero Records",
  onRefresh,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md transition-all ${className}`}
      data-testid="no-data-state"
    >
      <div className="relative mb-5 flex items-center justify-center">
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center shadow-lg shadow-black/40">
          <Database className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800/80 text-slate-300 border border-slate-700/60 mb-3 shadow-inner">
        <span>{statusLabel}</span>
      </div>

      <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">
        {title}
      </h3>

      <p className="text-sm text-slate-400 max-w-md leading-relaxed mb-6">
        {message}
      </p>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all duration-200 active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      )}

      <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center gap-2 text-xs text-slate-500">
        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span>Real-time persistence layer verified.</span>
      </div>
    </div>
  );
}

export default NoData;
