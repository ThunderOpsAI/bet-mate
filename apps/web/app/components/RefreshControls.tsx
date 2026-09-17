"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";

type RefreshControlsProps = {
  lastUpdated?: number | null;
  nextRefreshAt?: number | null;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
};

export default function RefreshControls({
  nextRefreshAt,
  isRefreshing,
  onRefresh,
}: RefreshControlsProps) {
  const refreshRef = useRef(onRefresh);
  const refreshingRef = useRef(isRefreshing);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    refreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    if (!nextRefreshAt) return;
    const intervalId = window.setInterval(() => {
      const currentTime = Date.now();
      if (
        nextRefreshAt !== null &&
        currentTime >= nextRefreshAt &&
        !refreshingRef.current
      ) {
        void refreshRef.current();
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [nextRefreshAt]);

  return (
    <button
      type="button"
      className="inline-flex items-center justify-center p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
      onClick={() => void onRefresh()}
      disabled={isRefreshing}
      title="Refresh data"
      aria-label="Refresh data"
    >
      <RefreshCw
        className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`}
      />
    </button>
  );
}

