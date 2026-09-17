"use client";

import React, { useState, useEffect } from "react";
import { Trophy, TrendingUp, DollarSign, Flame, ShieldAlert, Crown, Award } from "lucide-react";
import { API_BASE, safeResponseJson } from "../lib/api";

interface CategoryLeader {
  userId: string;
  username: string;
  roiPct?: number;
  monthlySpend?: number;
  totalBetsPlaced?: number;
  balance?: number;
}

interface AchievementBadge {
  id: string;
  title: string;
  badgeName: string;
  categoryKey: "highest_roi" | "high_rollers" | "grinders" | "tight_ass";
  description: string;
  icon: React.ReactNode;
  bgGradient: string;
  borderColor: string;
  badgeColor: string;
}

const BADGES: AchievementBadge[] = [
  {
    id: "roi_winner",
    title: "Highest Net ROI % Winner",
    badgeName: "ROI Master",
    categoryKey: "highest_roi",
    description: "Highest yield paper-bettor of the week (min 5 bets)",
    icon: <Trophy className="w-6 h-6 text-emerald-400" />,
    bgGradient: "from-emerald-950/40 to-slate-950",
    borderColor: "border-emerald-500/30",
    badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  {
    id: "high_roller",
    title: "High Roller Leader",
    badgeName: "Whale Trophy",
    categoryKey: "high_rollers",
    description: "Most virtual currency wagered across strategy cards",
    icon: <Crown className="w-6 h-6 text-amber-400" />,
    bgGradient: "from-amber-950/40 to-slate-950",
    borderColor: "border-amber-500/30",
    badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  {
    id: "grinder_champ",
    title: "Grinder Champion",
    badgeName: "Volume Belt",
    categoryKey: "grinders",
    description: "Highest total number of paper bets placed this week",
    icon: <Flame className="w-6 h-6 text-orange-400" />,
    bgGradient: "from-orange-950/40 to-slate-950",
    borderColor: "border-orange-500/30",
    badgeColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  },
  {
    id: "tight_ass",
    title: "Tight Ass Badge",
    badgeName: "Frugal Shield",
    categoryKey: "tight_ass",
    description: "Active bettor with lowest total monthly spend",
    icon: <ShieldAlert className="w-6 h-6 text-blue-400" />,
    bgGradient: "from-blue-950/40 to-slate-950",
    borderColor: "border-blue-500/30",
    badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
];

export default function Achievements() {
  const [leaders, setLeaders] = useState<Record<string, CategoryLeader | null>>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchCategoryLeaders() {
      setLoading(true);
      const results: Record<string, CategoryLeader | null> = {};

      await Promise.all(
        BADGES.map(async (badge) => {
          try {
            const res = await fetch(`${API_BASE}/leaderboards?category=${badge.categoryKey}`);
            const data = await safeResponseJson(res);
            if (data?.success && Array.isArray(data.leaderboard) && data.leaderboard.length > 0) {
              results[badge.categoryKey] = data.leaderboard[0];
            } else {
              results[badge.categoryKey] = null;
            }
          } catch {
            results[badge.categoryKey] = null;
          }
        })
      );

      setLeaders(results);
      setLoading(false);
    }

    void fetchCategoryLeaders();
  }, []);

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-bold text-slate-100">Weekly Category Wins & Badges</h3>
        </div>
        <span className="text-xs text-slate-400 font-medium">Updated Weekly</span>
      </div>

      <p className="text-xs text-slate-400 mb-5">
        Current leaders holding trophy badges across weekly community categories.
      </p>

      {loading ? (
        <div className="py-8 text-center text-slate-400 text-sm">Loading category achievements...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BADGES.map((badge) => {
            const leader = leaders[badge.categoryKey];
            return (
              <div
                key={badge.id}
                className={`bg-gradient-to-br ${badge.bgGradient} border ${badge.borderColor} rounded-xl p-4 flex flex-col justify-between transition-all hover:scale-[1.01]`}
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 shadow-inner">
                        {badge.icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-100">{badge.title}</h4>
                        <p className="text-[11px] text-slate-400">{badge.description}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.badgeColor}`}>
                      {badge.badgeName}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Current Leader:</span>
                  {leader ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">@{leader.username}</span>
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/20">
                        {badge.categoryKey === "highest_roi"
                          ? `+${leader.roiPct ?? 0}% ROI`
                          : badge.categoryKey === "high_rollers"
                          ? `$${(leader.monthlySpend ?? 0).toLocaleString()} Wagered`
                          : badge.categoryKey === "grinders"
                          ? `${leader.totalBetsPlaced ?? 0} Bets`
                          : `$${(leader.monthlySpend ?? 0).toLocaleString()} Spend`}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Awaiting Weekly Champion</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
