"use client";

import React, { useState, useEffect } from "react";
import { Trophy, TrendingUp, DollarSign, Flame, ShieldAlert } from "lucide-react";
import { API_BASE, safeResponseJson } from "../lib/api";

interface LeaderboardEntry {
  userId: string;
  username: string;
  balance?: number;
  monthlySpend?: number;
  totalBetsPlaced?: number;
  roiPct?: number;
}

type CategoryKey = "highest_roi" | "high_rollers" | "grinders" | "tight_ass";

const CATEGORIES: { key: CategoryKey; label: string; icon: React.ReactNode; description: string }[] = [
  { key: "highest_roi", label: "Highest Net ROI %", icon: <TrendingUp className="w-4 h-4 text-emerald-400" />, description: "Min 5 paper-bets required" },
  { key: "high_rollers", label: "High Rollers", icon: <DollarSign className="w-4 h-4 text-amber-400" />, description: "Most virtual money wagered" },
  { key: "grinders", label: "The Grinders", icon: <Flame className="w-4 h-4 text-orange-400" />, description: "Most total bets placed" },
  { key: "tight_ass", label: "The Biggest Tight Ass", icon: <ShieldAlert className="w-4 h-4 text-blue-400" />, description: "Active users with lowest spend" },
];

export default function Leaderboard() {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("highest_roi");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/leaderboards?category=${activeCategory}`);
        const data = await safeResponseJson(res);
        if (data?.success && Array.isArray(data.leaderboard)) {
          setEntries(data.leaderboard);
        } else {
          setEntries([]);
        }
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [activeCategory]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-bold text-slate-100">Monthly 10k Virtual Leaderboard</h3>
      </div>

      {/* Category Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-semibold transition-all ${
              activeCategory === cat.key
                ? "bg-slate-800 border-emerald-500/60 text-emerald-400 shadow-sm"
                : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {cat.icon}
              <span>{cat.label}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-normal">{cat.description}</span>
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      {loading ? (
        <div className="py-8 text-center text-slate-400 text-sm">Loading leaderboard standings...</div>
      ) : entries.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-sm">No qualifying entries for this category yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">User Handle</th>
                <th className="py-2.5 px-3 text-right">
                  {activeCategory === "highest_roi" ? "Net ROI %" : activeCategory === "high_rollers" ? "Total Wagered" : activeCategory === "grinders" ? "Bets Placed" : "Monthly Spend"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {entries.map((entry, idx) => (
                <tr key={entry.userId || idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 font-semibold">
                    {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : idx === 2 ? "🥉 #3" : `#${idx + 1}`}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-200">@{entry.username}</td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-400">
                    {activeCategory === "highest_roi"
                      ? `${entry.roiPct ?? 0}%`
                      : activeCategory === "high_rollers"
                      ? `$${(entry.monthlySpend ?? 0).toLocaleString()}`
                      : activeCategory === "grinders"
                      ? `${entry.totalBetsPlaced ?? 0} bets`
                      : `$${(entry.monthlySpend ?? 0).toLocaleString()}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
