"use client";

import React, { useState } from "react";
import {
  Filter,
  SlidersHorizontal,
  Search,
  X,
  RotateCcw,
  Sparkles,
  Zap,
  Target,
} from "lucide-react";
import type { PropsFilterState } from "./types";

export interface PropsFilterBarProps {
  filter: PropsFilterState;
  onChange: (updated: PropsFilterState) => void;
  availableSports?: Array<{ id: string; label: string; icon: string }>;
  availableMarkets?: string[];
  totalCount?: number;
  onReset?: () => void;
  className?: string;
}

const DEFAULT_SPORTS = [
  { id: "ALL", label: "All Sports", icon: "🏆" },
  { id: "NBA", label: "NBA", icon: "🏀" },
  { id: "AFL", label: "AFL", icon: "🏉" },
  { id: "NRL", label: "NRL", icon: "🏉" },
  { id: "NFL", label: "NFL", icon: "🏈" },
  { id: "SOCCER", label: "Soccer", icon: "⚽" },
];

const DEFAULT_MARKETS = [
  "ALL",
  "POINTS",
  "DISPOSALS",
  "REBOUNDS",
  "ASSISTS",
  "GOALS",
  "TACKLES",
  "THREES",
  "METRES",
];

const HIT_RATE_OPTIONS = [
  { label: "Any Hit %", value: 0 },
  { label: "50%+", value: 50 },
  { label: "60%+", value: 60 },
  { label: "70%+", value: 70 },
  { label: "80%+", value: 80 },
];

export function PropsFilterBar({
  filter,
  onChange,
  availableSports = DEFAULT_SPORTS,
  availableMarkets = DEFAULT_MARKETS,
  totalCount,
  onReset,
  className = "",
}: PropsFilterBarProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const handleSportChange = (sport: string) => {
    onChange({ ...filter, sport });
  };

  const handleMarketChange = (marketType: string) => {
    onChange({ ...filter, marketType });
  };

  const handleMinEdgeChange = (minEdge: number) => {
    onChange({ ...filter, minEdge });
  };

  const handleMinHitRateChange = (minHitRate: number) => {
    onChange({ ...filter, minHitRate });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filter, searchQuery: e.target.value });
  };

  const isFiltered =
    filter.sport !== "ALL" ||
    filter.marketType !== "ALL" ||
    filter.minEdge > 0 ||
    filter.minHitRate > 0 ||
    filter.searchQuery.trim().length > 0;

  return (
    <div
      className={`rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 shadow-xl backdrop-blur-md transition-all ${className}`}
      data-testid="props-filter-bar"
    >
      {/* Top Row: Sports Pills & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        {/* Sport selection chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {availableSports.map((s) => {
            const isActive = filter.sport.toUpperCase() === s.id.toUpperCase();
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSportChange(s.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 ${
                  isActive
                    ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 scale-102"
                    : "bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/50"
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search input & Advanced toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filter.searchQuery}
              onChange={handleSearchChange}
              placeholder="Search player or team..."
              className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 transition-all"
            />
            {filter.searchQuery && (
              <button
                type="button"
                onClick={() => onChange({ ...filter, searchQuery: "" })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isAdvancedOpen || filter.minEdge > 0 || filter.minHitRate > 0
                ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
                : "bg-slate-800/80 text-slate-300 border-slate-700/50 hover:bg-slate-750"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {(filter.minEdge > 0 || filter.minHitRate > 0) && (
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
            )}
          </button>

          {isFiltered && onReset && (
            <button
              type="button"
              onClick={onReset}
              title="Reset all filters"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Market Selector Chips Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-t border-slate-800/60 pt-3">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
          Market:
        </span>
        {availableMarkets.map((m) => {
          const isActive = filter.marketType.toUpperCase() === m.toUpperCase();
          const label = m === "ALL" ? "All Markets" : m.charAt(0) + m.slice(1).toLowerCase();
          return (
            <button
              key={m}
              type="button"
              onClick={() => handleMarketChange(m)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-all ${
                isActive
                  ? "bg-slate-200 text-slate-900 font-bold shadow-xs"
                  : "bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-800/80"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Advanced Filter Drawer: Min Edge Slider + Min Hit Rate Toggle */}
      {isAdvancedOpen && (
        <div className="mt-3 pt-3.5 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-5 animate-in fade-in duration-150">
          {/* Min Edge Slider */}
          <div className="flex flex-col gap-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                <span>Min Model Edge (EV):</span>
              </div>
              <span className="font-mono font-bold text-cyan-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                +{filter.minEdge}%
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={filter.minEdge}
              onChange={(e) => handleMinEdgeChange(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />

            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0% (All)</span>
              <span>+5%</span>
              <span>+10%</span>
              <span>+15%</span>
              <span>+20%</span>
            </div>
          </div>

          {/* Min Hit Rate Toggle Chips */}
          <div className="flex flex-col gap-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                <span>Min Historical Hit Rate:</span>
              </div>
              <span className="font-mono font-bold text-emerald-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                {filter.minHitRate > 0 ? `${filter.minHitRate}%+` : "Any"}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1">
              {HIT_RATE_OPTIONS.map((opt) => {
                const isActive = filter.minHitRate === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleMinHitRateChange(opt.value)}
                    className={`py-1 rounded-lg text-xs font-semibold text-center transition-all ${
                      isActive
                        ? "bg-emerald-500 text-slate-950 font-bold shadow-xs"
                        : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Result Count and Active Filters Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2.5 border-t border-slate-800/40">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong className="text-white font-bold">{totalCount ?? 0}</strong> props
          </span>
          {filter.sport !== "ALL" && (
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[11px] text-cyan-300">
              {filter.sport}
            </span>
          )}
          {filter.marketType !== "ALL" && (
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300">
              {filter.marketType}
            </span>
          )}
        </div>

        {isFiltered && (
          <span className="text-[11px] text-amber-400/90 font-medium">
            Filters Active
          </span>
        )}
      </div>
    </div>
  );
}

export default PropsFilterBar;
