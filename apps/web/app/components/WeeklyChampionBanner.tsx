"use client";

import React, { useEffect, useState } from "react";
import { Trophy, X, Sparkles } from "lucide-react";
import { API_BASE, safeResponseJson } from "../lib/api";

type ChampionData = {
  username: string;
  roiPct: number;
  balance: number;
  totalBetsPlaced: number;
};

// Helper to get ISO week identifier in Australia/Melbourne timezone (e.g. "2026-W36")
function getWeekKey(): string {
  const melbourneDateStr = new Date().toLocaleDateString("en-CA", {
    timeZone: "Australia/Melbourne",
  });
  const [year, month, day] = melbourneDateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export default function WeeklyChampionBanner() {
  const [dismissed, setDismissed] = useState(true);
  const [champion, setChampion] = useState<ChampionData | null>(null);
  const [isCrowned, setIsCrowned] = useState(false);

  useEffect(() => {
    // Check localStorage dismissal
    const isDismissed = localStorage.getItem("betmate_weekly_champion_dismissed_" + getWeekKey());
    if (isDismissed === "true") {
      setDismissed(true);
      return;
    }

    setDismissed(false);

    // Fetch top weekly champion from API.
    // First tries the WeeklyChampion table (crowned at end-of-week).
    // Falls back to live highest_roi leaderboard leader if no champion crowned yet.
    async function loadChampion() {
      try {
        // 1. Try crowned champion first
        const res = await fetch(`${API_BASE}/leaderboards?category=highest_roi_weekly`, {
          headers: { "Content-Type": "application/json" },
        });
        const data = await safeResponseJson(res);
        if (data && data.success && Array.isArray(data.leaderboard) && data.leaderboard.length > 0) {
          const top = data.leaderboard[0];
          setChampion({
            username: top.username,
            roiPct: top.roiPct,
            balance: top.balance,
            totalBetsPlaced: top.totalBetsPlaced,
          });
          setIsCrowned(true);
          return;
        }

        // 2. Fall back: show current week's live #1 on the ROI leaderboard
        const fallbackRes = await fetch(`${API_BASE}/leaderboards?category=highest_roi&timeframe=weekly`, {
          headers: { "Content-Type": "application/json" },
        });
        const fallbackData = await safeResponseJson(fallbackRes);
        if (
          fallbackData &&
          fallbackData.success &&
          Array.isArray(fallbackData.leaderboard) &&
          fallbackData.leaderboard.length > 0
        ) {
          const top = fallbackData.leaderboard[0];
          setChampion({
            username: top.username ?? top.userId ?? "Anonymous",
            roiPct: typeof top.roiPct === "number" ? Math.round(top.roiPct * 10) / 10 : 0,
            balance: top.balance ?? 10000,
            totalBetsPlaced: top.totalBetsPlaced ?? top.weeklyBetsPlaced ?? 0,
          });
        }
      } catch (err) {
        console.warn("Weekly champion data unavailable");
      }
    }

    loadChampion();
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("betmate_weekly_champion_dismissed_" + getWeekKey(), "true");
    setDismissed(true);
  };

  if (dismissed || !champion) return null;

  return (
    <div className="w-full bg-gradient-to-r from-amber-500/20 via-slate-950 to-amber-500/20 border-b border-amber-500/40 px-4 py-2.5 relative shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0 shadow-sm animate-pulse">
            <Trophy size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-amber-300 uppercase tracking-wider text-[10px] bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/30 flex items-center gap-1">
                <Sparkles size={10} /> {isCrowned ? "Weekly Champion" : "Current Leader"}
              </span>
              <span className="font-extrabold text-slate-100 truncate">
                @{champion.username}
              </span>
              <span className="text-emerald-400 font-bold font-mono">
                +{champion.roiPct}% ROI
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate hidden sm:block">
              {isCrowned
                ? `Crowned winner for this week's paper bet leaderboard with $${champion.balance.toFixed(2)} balance across ${champion.totalBetsPlaced} bets.`
                : `Currently leading this week's paper bet leaderboard with $${champion.balance.toFixed(2)} balance across ${champion.totalBetsPlaced} bets.`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0"
          title="Dismiss Champion Announcement"
          aria-label="Dismiss banner"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
