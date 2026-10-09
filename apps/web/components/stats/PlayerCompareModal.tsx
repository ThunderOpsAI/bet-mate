"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Users,
  Search,
  Sparkles,
  TrendingUp,
  Award,
  Swords,
  ChevronRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type {
  PlayerProfile,
  PlayerComparisonData,
  PlayerComparisonProfile,
} from "./types";
import { API_BASE, safeResponseJson } from "../../app/lib/api";

export interface PlayerCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlayerA?: PlayerProfile | null;
  initialPlayerB?: PlayerProfile | null;
  sport?: string;
  className?: string;
}

export function PlayerCompareModal({
  isOpen,
  onClose,
  initialPlayerA,
  initialPlayerB,
  sport = "NBA",
  className = "",
}: PlayerCompareModalProps) {
  const [playerA, setPlayerA] = useState<PlayerProfile | null>(initialPlayerA || null);
  const [playerB, setPlayerB] = useState<PlayerProfile | null>(initialPlayerB || null);

  const [comparisonData, setComparisonData] = useState<PlayerComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state when props change
  useEffect(() => {
    if (initialPlayerA) setPlayerA(initialPlayerA);
    if (initialPlayerB) setPlayerB(initialPlayerB);
  }, [initialPlayerA, initialPlayerB]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch comparison data when both players are selected
  useEffect(() => {
    if (!isOpen || !playerA?.id || !playerB?.id) {
      setComparisonData(null);
      return;
    }

    let isMounted = true;
    async function fetchComparison() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch(
          `${API_BASE}/stats/compare?playerA=${encodeURIComponent(playerA!.id)}&playerB=${encodeURIComponent(playerB!.id)}`
        );
        if (!res.ok) {
          throw new Error(`Failed to load comparison (HTTP ${res.status})`);
        }
        const data = await safeResponseJson(res);
        if (isMounted) {
          if (data?.status === "ok" && data.data) {
            setComparisonData(data.data);
          } else if (data?.status === "empty") {
            setComparisonData(null);
            setErrorMessage(data.message || "No comparison data found for these players.");
          } else {
            setComparisonData(null);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Error comparing players:", err);
          setErrorMessage(err.message || "Failed to load player comparison");
          setComparisonData(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchComparison();
    return () => {
      isMounted = false;
    };
  }, [isOpen, playerA?.id, playerB?.id]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
    >
      <div
        className={`relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl shadow-cyan-950/30 overflow-hidden ${className}`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Swords className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="compare-modal-title"
                className="text-base sm:text-lg font-bold text-white tracking-tight"
              >
                Head-to-Head Player Comparison
              </h3>
              <p className="text-xs text-slate-400">
                Compare season averages, recent L5 form, and head-to-head records.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Top Player Selection Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-6 relative">
            {/* VS Badge in center */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-slate-950 border border-slate-700 text-[11px] font-black text-cyan-400 shadow-lg">
              VS
            </div>

            {/* Player A Header Card */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-300 text-lg shrink-0">
                {playerA?.fullName
                  ? playerA.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)
                  : "A"}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                  Player A
                </span>
                <h4 className="font-bold text-white text-sm sm:text-base truncate">
                  {playerA?.fullName || "Select Player A"}
                </h4>
                <p className="text-xs text-slate-400">
                  {playerA?.team} {playerA?.position ? `• ${playerA.position}` : ""}
                </p>
              </div>
            </div>

            {/* Player B Header Card */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-bold text-amber-300 text-lg shrink-0">
                {playerB?.fullName
                  ? playerB.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)
                  : "B"}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  Player B
                </span>
                <h4 className="font-bold text-white text-sm sm:text-base truncate">
                  {playerB?.fullName || "Select Player B"}
                </h4>
                <p className="text-xs text-slate-400">
                  {playerB?.team} {playerB?.position ? `• ${playerB.position}` : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Body: Loading / Error / Data */}
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
              <p className="text-sm text-slate-300 font-medium">
                Analyzing head-to-head metrics & split averages...
              </p>
            </div>
          ) : errorMessage ? (
            <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <h5 className="font-bold text-white text-sm mb-1">
                Comparison Unavailable
              </h5>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {errorMessage}
              </p>
            </div>
          ) : comparisonData ? (
            <div className="space-y-6">
              {/* Statistical Categories Comparison */}
              <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 sm:p-5">
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Season Averages (Per Game)</span>
                </h5>

                <StatComparisonRows
                  statsA={comparisonData.playerA.seasonStats.averages}
                  statsB={comparisonData.playerB.seasonStats.averages}
                  minutesA={comparisonData.playerA.seasonStats.minutes}
                  minutesB={comparisonData.playerB.seasonStats.minutes}
                />
              </div>

              {/* L5 Form Comparison */}
              <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 sm:p-5">
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Last 5 Games Form</span>
                </h5>

                <StatComparisonRows
                  statsA={comparisonData.playerA.l5Stats.averages}
                  statsB={comparisonData.playerB.l5Stats.averages}
                  minutesA={comparisonData.playerA.l5Stats.minutes}
                  minutesB={comparisonData.playerB.l5Stats.minutes}
                />
              </div>

              {/* Head-to-Head Games section */}
              {comparisonData.headToHead && comparisonData.headToHead.length > 0 && (
                <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 sm:p-5">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5 text-amber-400" />
                    <span>Head-to-Head Matchup History ({comparisonData.headToHead.length} Games)</span>
                  </h5>

                  <div className="divide-y divide-slate-800/60 text-xs">
                    {comparisonData.headToHead.map((h2h, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between">
                        <span className="font-mono text-slate-400">
                          {h2h.gameDate ? new Date(h2h.gameDate).toLocaleDateString() : `Game ${idx + 1}`}
                        </span>
                        <div className="flex items-center gap-6">
                          <span className="font-semibold text-cyan-300">
                            {playerA?.fullName.split(" ").pop()}: {h2h.playerAStats.minutes ? `${h2h.playerAStats.minutes}m` : "-"}
                          </span>
                          <span className="font-semibold text-amber-300">
                            {playerB?.fullName.split(" ").pop()}: {h2h.playerBStats.minutes ? `${h2h.playerBStats.minutes}m` : "-"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              Select two players to generate an in-depth comparison.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <span>Real-time model comparison</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatComparisonRows({
  statsA,
  statsB,
  minutesA,
  minutesB,
}: {
  statsA: Record<string, number>;
  statsB: Record<string, number>;
  minutesA?: number;
  minutesB?: number;
}) {
  // Merge keys
  const keys = Array.from(
    new Set([...Object.keys(statsA || {}), ...Object.keys(statsB || {})])
  );

  if (keys.length === 0 && !minutesA && !minutesB) {
    return <p className="text-xs text-slate-500">No recorded stat averages.</p>;
  }

  const statEntries = [
    ...(minutesA !== undefined || minutesB !== undefined
      ? [{ key: "Minutes", valA: minutesA ?? 0, valB: minutesB ?? 0 }]
      : []),
    ...keys.map((k) => ({
      key: k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, " $1"),
      valA: statsA?.[k] ?? 0,
      valB: statsB?.[k] ?? 0,
    })),
  ];

  return (
    <div className="space-y-3">
      {statEntries.map(({ key, valA, valB }) => {
        const isALeading = valA > valB;
        const isBLeading = valB > valA;
        const total = Math.max(valA + valB, 1);
        const pctA = Math.round((valA / total) * 100);
        const pctB = 100 - pctA;

        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span
                className={`font-mono font-bold ${
                  isALeading ? "text-cyan-400" : "text-slate-400"
                }`}
              >
                {valA.toFixed(1)}
              </span>
              <span className="font-semibold text-slate-300 text-[11px]">
                {key}
              </span>
              <span
                className={`font-mono font-bold ${
                  isBLeading ? "text-amber-400" : "text-slate-400"
                }`}
              >
                {valB.toFixed(1)}
              </span>
            </div>

            {/* Visual Comparative Bar */}
            <div className="h-1.5 w-full rounded-full bg-slate-900 flex overflow-hidden">
              <div
                style={{ width: `${pctA}%` }}
                className={`h-full transition-all duration-300 ${
                  isALeading ? "bg-cyan-400" : "bg-cyan-700/60"
                }`}
              />
              <div
                style={{ width: `${pctB}%` }}
                className={`h-full transition-all duration-300 ${
                  isBLeading ? "bg-amber-400" : "bg-amber-700/60"
                }`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default PlayerCompareModal;
