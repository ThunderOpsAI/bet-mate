"use client";

import React from "react";

export interface StrategyTrustMetricProps {
  profileKey: string;
  displayName: string;
  notes: string;
  rankingKey: string;
  oddsBand: string;
  sampleSize: number;
  winCount: number;
  lossCount: number;
  strikeRate: number;
  roi: number;
  totalStaked: number;
  totalProfit: number;
  maxDrawdown: number;
  clvBeatRate: number;
  avgClv: number;
  clvSampleSize: number;
  badge: "LIVE RECORD" | "SIMULATED BACKTEST";
}

export default function StrategyTrustCard({ strategy }: { strategy: StrategyTrustMetricProps }) {
  const isLive = strategy.badge === "LIVE RECORD";

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between shadow-xl">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>{strategy.displayName}</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              Odds band: {strategy.oddsBand}
            </span>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border flex items-center gap-1.5 shrink-0 ${
              isLive
                ? "bg-emerald-950/80 text-emerald-400 border-emerald-600/60"
                : "bg-purple-950/60 text-purple-300 border-purple-700/50"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-400 animate-pulse" : "bg-purple-400"}`}></span>
            [{strategy.badge}]
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-4 line-clamp-2">
          {strategy.notes}
        </p>

        {/* 4-Stat Grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">ROI</span>
            <span className={`text-base font-black font-mono ${strategy.roi >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {strategy.roi > 0 ? "+" : ""}{strategy.roi}%
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Strike Rate</span>
            <span className="text-base font-black font-mono text-cyan-400">
              {strategy.strikeRate}%
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">CLV Beat Rate</span>
            <span className="text-base font-black font-mono text-amber-300">
              {strategy.clvSampleSize > 0 ? `${strategy.clvBeatRate}%` : "Auditing"}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Max Drawdown</span>
            <span className="text-base font-black font-mono text-slate-300">
              ${strategy.maxDrawdown}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <span>Sample: <strong className="text-slate-200">{strategy.sampleSize} bets</strong></span>
        <span>Ranking: <strong className="text-cyan-400 font-mono">{strategy.rankingKey}</strong></span>
      </div>
    </div>
  );
}
