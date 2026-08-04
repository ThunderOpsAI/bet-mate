"use client";

import React from "react";
import { ResponsiveContainer, LineChart, Line, Tooltip } from "recharts";
import { TrendingUp, Target, DollarSign } from "lucide-react";

export interface StrategyMetricProps {
  id: string;
  name: string;
  strikeRate: number;
  yieldRoi: number;
  totalProfit: number;
  equityData: { day: string; PnL: number }[];
}

export default function StrategyAnalyticsCard({ strategy }: { strategy: StrategyMetricProps }) {
  const isPositiveYield = strategy.yieldRoi >= 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md flex flex-col justify-between hover:border-slate-700 transition-all">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-100">{strategy.name}</h4>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
              isPositiveYield ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            }`}
          >
            {isPositiveYield ? `+${strategy.yieldRoi}% Yield` : `${strategy.yieldRoi}% Yield`}
          </span>
        </div>

        {/* Core Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 text-center">
          <div>
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
              <Target className="w-3 h-3 text-slate-400" /> Strike Rate
            </div>
            <div className="text-xs font-bold text-slate-200 mt-0.5">{strategy.strikeRate}%</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" /> Yield / ROI
            </div>
            <div className={`text-xs font-bold mt-0.5 ${isPositiveYield ? "text-emerald-400" : "text-rose-400"}`}>
              {strategy.yieldRoi}%
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
              <DollarSign className="w-3 h-3 text-amber-400" /> Net P&L
            </div>
            <div className={`text-xs font-bold mt-0.5 ${strategy.totalProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              ${strategy.totalProfit.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Sparkline Equity Curve */}
      <div>
        <div className="text-[10px] text-slate-500 font-semibold mb-1">P&L Momentum (Equity Curve)</div>
        <div className="h-16 w-full bg-slate-950/80 rounded border border-slate-800/40 p-1 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={50}>
            <LineChart data={strategy.equityData}>
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", fontSize: "10px" }}
                itemStyle={{ color: "#34d399" }}
              />
              <Line
                type="monotone"
                dataKey="PnL"
                stroke={isPositiveYield ? "#10b981" : "#f43f5e"}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
