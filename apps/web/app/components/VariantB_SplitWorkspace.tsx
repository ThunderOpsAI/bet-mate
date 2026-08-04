"use client";

import React, { useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  Trophy,
  Clock,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Flag,
  Zap,
  Flame,
  LayoutGrid,
  List
} from "lucide-react";

interface VariantProps {
  racesData: any[];
  allOpportunities: any[];
  aflData?: any[];
  nbaData?: any[];
  nrlData?: any[];
  soccerData?: any[];
  golfData?: any[];
  mmaData?: any[];
  isLoading?: boolean;
  onOpenPaperBet: (bet: any) => void;
  onOpenBobModal: (ctx: any) => void;
}

export default function VariantB_SplitWorkspace({
  racesData = [],
  allOpportunities = [],
  aflData = [],
  nbaData = [],
  nrlData = [],
  soccerData = [],
  golfData = [],
  mmaData = [],
  isLoading = false,
  onOpenPaperBet,
  onOpenBobModal,
}: VariantProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "racing" | "sports">("overview");

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-[1400px] mx-auto p-4 md:p-6 pb-24">
      {/* Persistent Left Sidebar Workspace */}
      <aside className="w-full lg:w-[360px] shrink-0 flex flex-col gap-5 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 flex items-center gap-2">
            <LayoutGrid size={16} /> PERSISTENT SIDEBAR
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">Variant B</span>
        </div>

        {/* High EV Signals Quick Feed */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-400" /> Top Value Signals
          </h3>
          {isLoading ? (
            <div className="p-6 text-center text-xs text-slate-400 animate-pulse bg-slate-950/40 rounded-2xl border border-slate-800">
              Loading EV Model Signals...
            </div>
          ) : allOpportunities.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/30 rounded-xl">No active signals</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
              {allOpportunities.slice(0, 5).map((opp, idx) => (
                <div
                  key={opp.id || idx}
                  className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs transition-all"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-white">{opp.selection}</span>
                    <span className="text-[10px] text-slate-400">{opp.event}</span>
                  </div>
                  {opp.edge && (
                    <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-1 rounded-md border border-emerald-800/50">
                      +{opp.edge}% EV
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Right Workspace */}
      <main className="flex-1 flex flex-col gap-6">
        {/* Workspace Tab Bar */}
        <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${
              activeTab === "overview"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ⚡ Executive Overview
          </button>
          <button
            onClick={() => setActiveTab("racing")}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${
              activeTab === "racing"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🏇 Race Meetings
          </button>
          <button
            onClick={() => setActiveTab("sports")}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${
              activeTab === "sports"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ⚽ Multi-Sport Fixtures
          </button>
        </div>

        {/* Content View */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-3xl border border-slate-800 animate-pulse">
            Connecting to live model feeds...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {racesData.slice(0, 6).map((race, idx) => (
              <div key={race.race_id || idx} className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">R{race.race_number} {race.venue}</span>
                  <span className="text-xs text-emerald-400 font-mono">{race.distance}m</span>
                </div>
                <div className="text-xs text-slate-300">
                  Top Pick: <span className="font-bold text-white">{race.horses?.[0]?.name || "TBD"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
