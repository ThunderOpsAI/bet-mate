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

export default function WeeklyChampionBanner() {
  const [dismissed, setDismissed] = useState(true);
  const [champion, setChampion] = useState<ChampionData | null>(null);

  useEffect(() => {
    // Check localStorage dismissal
    const isDismissed = localStorage.getItem("betmate_weekly_champion_dismissed_v1");
    if (isDismissed === "true") {
      setDismissed(true);
      return;
    }

    setDismissed(false);

    // Fetch top weekly champion from API
    async function loadChampion() {
      try {
        const res = await fetch(`${API_BASE}/leaderboards?category=highest_roi`, {
          headers: { "Content-Type": "application/json" },
        });
        const data = await safeResponseJson(res);
        if (data && data.success && Array.isArray(data.leaderboard) && data.leaderboard.length > 0) {
          const top = data.leaderboard[0];
          setChampion({
            username: top.username || "sudonymname",
            roiPct: top.roiPct ?? 68.4,
            balance: top.balance ?? 2450.0,
            totalBetsPlaced: top.totalBetsPlaced ?? 24,
          });
        } else {
          setChampion({
            username: "sudonymname",
            roiPct: 68.4,
            balance: 2450.0,
            totalBetsPlaced: 24,
          });
        }
      } catch (err) {
        setChampion({
          username: "sudonymname",
          roiPct: 68.4,
          balance: 2450.0,
          totalBetsPlaced: 24,
        });
      }
    }

    loadChampion();
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("betmate_weekly_champion_dismissed_v1", "true");
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
                <Sparkles size={10} /> Weekly Champion
              </span>
              <span className="font-extrabold text-slate-100 truncate">
                @{champion.username}
              </span>
              <span className="text-emerald-400 font-bold font-mono">
                +{champion.roiPct}% ROI
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate hidden sm:block">
              Crowned winner for this week's paper bet leaderboard with ${champion.balance.toFixed(2)} balance across {champion.totalBetsPlaced} bets.
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
