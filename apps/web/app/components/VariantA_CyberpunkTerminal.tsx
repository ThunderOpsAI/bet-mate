"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Trophy,
  Zap,
  Flame,
  Clock,
  Bookmark,
  TrendingUp,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  DollarSign,
  ShieldCheck,
  Activity,
  Flag,
  Layers,
  BarChart2
} from "lucide-react";

interface VariantProps {
  racesData: any[];
  allOpportunities: any[];
  onOpenPaperBet: (bet: any) => void;
  onOpenBobModal: (ctx: any) => void;
}

export default function VariantA_CyberpunkTerminal({
  racesData,
  allOpportunities,
  onOpenPaperBet,
  onOpenBobModal,
}: VariantProps) {
  const [selectedSportFilter, setSelectedSportFilter] = useState("all");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (toastMsg) {
      const t = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMsg]);

  const sportsList = [
    { id: "all", label: "All Signal Feeds", count: 24, emoji: "⚡" },
    { id: "racing", label: "Racing Hub", count: 5, emoji: "🏇" },
    { id: "afl", label: "AFL", count: 4, emoji: "🏉" },
    { id: "nrl", label: "NRL", count: 3, emoji: "🏉" },
    { id: "nba", label: "NBA", count: 6, emoji: "🏀" },
    { id: "soccer", label: "Soccer", count: 4, emoji: "⚽" },
    { id: "blackbook", label: "Blackbookers", count: 2, emoji: "📖" },
  ];

  const blackbookAlerts = [
    {
      id: "bb-1",
      horse: "Imperatriz",
      venue: "Flemington R7",
      time: "14m 20s",
      note: "Suited by firm track, peak fitness 3rd-up trial winner",
      odds: "$2.40",
      edge: "+18.4%",
    },
    {
      id: "bb-2",
      horse: "Think About It",
      venue: "Randwick R5",
      time: "48m 10s",
      note: "Backing off strong trial win, Hugh Bowman aboard",
      odds: "$3.10",
      edge: "+12.1%",
    },
  ];

  const filteredOpps =
    selectedSportFilter === "all"
      ? allOpportunities
      : allOpportunities.filter(
          (o) => o.sport?.toLowerCase() === selectedSportFilter.toLowerCase()
        );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Banner Live Ticker / Live Matrix Signal Feed */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-2 flex items-center gap-6 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 text-emerald-500 font-bold uppercase text-[11px] whitespace-nowrap shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          LIVE MATRIX
        </div>
        
        <div className="flex items-center gap-4">
          {[
            { id: 1, title: "R3 Eagle Farm 9482", time: "3m 40s", tag: "+14.2% EV Alert 105", tagColor: "text-emerald-400" },
            { id: 2, title: "R5 Randwick 8291", time: "18m 15s", tag: "Blackbooker 302", tagColor: "text-cyan-400" },
            { id: 3, title: "Lakers vs Bulls 5930", time: "Q3 04:12", tag: "Model Upgrade 84", tagColor: "text-emerald-400" }
          ].map((alert) => {
            const cleanTitle = alert.title.replace(/\s+\d+$/g, "").trim();
            const cleanTag = alert.tag.replace(/\s+\d+$/g, "").trim();
            return (
              <div
                key={alert.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-3 my-2 shadow-sm flex flex-col gap-1 shrink-0 min-w-[160px]"
              >
                <div className="flex justify-between items-center gap-2">
                  <strong className="text-white text-xs">{cleanTitle}</strong>
                  <span className="text-[10px] text-slate-400">{alert.time}</span>
                </div>
                <span className={`text-[11px] font-bold ${alert.tagColor}`}>{cleanTag}</span>
              </div>
            );
          })}
        </div>
        
        <div className="ml-auto shrink-0 flex items-center gap-2">
          <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded text-[11px] font-mono border border-emerald-500/30 flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
            ML Engine v2.4
          </span>
        </div>
      </div>

      {/* Cyber Command Header Hero */}
      <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative p-2 rounded-xl bg-transparent border border-emerald-500/30 shadow-lg shadow-emerald-950/50 group">
              <Image
                src="/brand/betmate-bob-original.png"
                alt="BetMate Bob AI"
                width={56}
                height={56}
                className="rounded-lg object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.35)] transition transform group-hover:scale-105"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950 flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-black" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white uppercase flex items-center gap-2">
                  BETMATE COMMAND CENTER
                </h1>
                <span className="px-2 py-0.5 text-[10px] uppercase font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 rounded font-bold">
                  Cyber Terminal Pro
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Real-time value picks, next-to-jump countdowns, & high-confidence blackbook alerts.
              </p>
            </div>
          </div>

          {/* Quick Bankroll Barometer */}
          <div className="flex items-center gap-3 font-sans">
            <span className="text-slate-500 text-2xl font-medium">$</span>
            <span className="text-xs text-slate-400 font-medium">Active Bankroll</span>
            <span className="text-3xl font-bold text-slate-50">4,250.00</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto p-8 space-y-12">
        {/* Sport Context Filter Bar */}
        <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-none border-b border-slate-800/80 mb-4">
          {sportsList.map((sport) => {
            const active = selectedSportFilter === sport.id;
            return (
              <button
                key={sport.id}
                onClick={() => setSelectedSportFilter(sport.id)}
                className={`min-w-[135px] flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold whitespace-nowrap transition-all ${
                  active
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{sport.emoji}</span>
                  <span>{sport.label}</span>
                </div>
                <span className="bg-white/10 text-cyan-400 text-xs px-2 py-0.5 rounded-full font-mono">
                  {sport.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 2-Column Grid: Next to Jump (Left) & Blackbook (Right) */}
        <div className="cyberpunk-two-col-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-8 w-full items-start">
          {/* Left Column: Next 5 Racing Countdown */}
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-emerald-400" />
                Next to Jump (Thoroughbred & Greyhounds)
              </h2>
              <Link
                href="/racing"
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold shrink-0"
              >
                Race Hub <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex flex-col gap-3.5">
              {racesData.slice(0, 5).map((race, idx) => (
                <div
                  key={race.race_id || idx}
                  className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-slate-750 transition-colors group cursor-pointer gap-4"
                >
                  {/* Left Side: Race Details & Horse */}
                  <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-bold text-white">R{race.race_number} {race.venue}</span>
                      <span className="text-xs text-slate-400">{race.distance}m</span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {idx === 0 ? "2m 14s" : `${(idx + 1) * 8}m`}
                      </span>
                    </div>
                    <div className="text-sm text-slate-300 font-medium flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                      {race.horses?.[0]?.name || "Favorite"}
                    </div>
                  </div>
                  
                  {/* Right Side: Clickable Odds Button */}
                  <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-4">
                    <Link
                      href={`/races/${race.race_id || "demo"}`}
                      className="text-slate-400 hover:text-white font-medium text-xs flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                    >
                      Race Card <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                    <button className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-mono text-sm font-bold text-white transition-colors">
                      ${race.horses?.[0]?.betfair_back_price || "3.20"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Blackbook Alerts Panel */}
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <Bookmark className="w-5 h-5 text-cyan-400 animate-pulse" />
                <h2 className="text-xl font-bold text-cyan-300 uppercase tracking-wider">
                  Blackbook Runners Today
                </h2>
              </div>
              <Link
                href="/blackbook"
                className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-semibold shrink-0"
              >
                Blackbook <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-gradient-to-b from-slate-900/90 via-[#0a0d16] to-slate-950/90 border border-cyan-500/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(6,182,212,0.1)] space-y-4">
              {blackbookAlerts.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-5 rounded-2xl transition-all duration-200 hover:scale-[1.01] hover:border-cyan-500/40 group shadow-xl shadow-black/40"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {item.horse}
                      </span>
                      <span className="text-[10px] font-mono tracking-widest bg-slate-800/80 text-cyan-200 px-2 py-0.5 rounded-md border border-slate-700/50">
                        {item.venue}
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-white font-mono tracking-tight bg-slate-950 px-3 py-1 rounded-lg border border-slate-700 shadow-inner">
                      {item.odds}
                    </span>
                  </div>

                  <p className="text-[13px] text-slate-400 italic mb-4 leading-relaxed">{item.note}</p>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">{item.edge}</span>
                      <span className="text-slate-600">|</span>
                      <span className="text-cyan-400 font-semibold">{item.time}</span>
                    </div>
                    <button
                      onClick={() => {
                        onOpenPaperBet({
                          runner: item.horse,
                          event: item.venue,
                          odds: item.odds,
                          edge: item.edge,
                        });
                        setToastMsg(`Added ${item.horse} to Betslip!`);
                      }}
                      className="px-4 py-1.5 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-black border border-cyan-500/50 text-xs font-bold rounded-lg transition-all duration-300 hover:scale-[1.02] shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                    >
                      Quick Bet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Full-Width Section: High-EV Value Feed */}
        <div className="pt-14 border-t border-slate-800/80 mt-16 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              High EV Value Feed ({filteredOpps.length} Model Signals)
            </h2>
            <span className="text-xs text-slate-400 font-mono">Ranked by EV %</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {filteredOpps.map((opp, idx) => {
              let SportIcon = Zap;
              if (opp.sport?.toLowerCase() === "racing") SportIcon = Trophy;
              else if (opp.sport?.toLowerCase() === "nba") SportIcon = Flame;
              else if (opp.sport?.toLowerCase() === "soccer") SportIcon = Activity;
              else if (opp.sport?.toLowerCase() === "mma") SportIcon = ShieldCheck;
              else if (opp.sport?.toLowerCase() === "golf") SportIcon = Flag;
              else SportIcon = Activity;

              return (
                <div
                  key={opp.id || idx}
                  className="relative bg-slate-900/40 backdrop-blur-sm border border-white/5 rounded-xl p-5 hover:bg-slate-800/60 hover:border-cyan-500/30 transition-all duration-200 hover:-translate-y-0.5 group flex flex-col justify-between overflow-hidden"
                >
                  {/* Top Row (Metadata) */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <SportIcon className="w-3.5 h-3.5 text-emerald-500/80" />
                      <span className="text-[10px] font-mono uppercase tracking-widest bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">
                        {opp.sport} • {opp.event}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono tracking-tight">
                      JUST NOW
                    </span>
                  </div>

                  {/* Main Row (The Play & The Edge) */}
                  <div className="flex items-end justify-between mt-2 z-10 relative">
                    <div className="flex-1 pr-4">
                      <div className="text-[10px] text-slate-500 font-medium uppercase mb-1.5">
                        Model Selection
                      </div>
                      <div className="text-base font-bold text-white font-sans leading-snug group-hover:text-cyan-300 transition-colors">
                        {opp.selection}
                      </div>
                    </div>
                    
                    {/* The Edge / EV Pill */}
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="inline-flex items-center px-3 py-1 bg-emerald-500/10 text-emerald-400 font-bold font-mono tracking-widest rounded-lg border border-emerald-500/30 text-sm shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                        +{opp.edge}% EV
                      </span>
                      <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-slate-400">
                        <span>Fair: ${opp.fairOdds?.toFixed(2) || "2.10"}</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-slate-200 font-bold bg-slate-800 px-1.5 rounded">
                          ${opp.marketOdds?.toFixed(2) || "2.40"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actionability - Hidden until hover */}
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-[#0b0e17] via-slate-900/95 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex items-center justify-end gap-3 z-20">
                    <button
                      onClick={() => onOpenBobModal({ event: opp.event, selection: opp.selection, edge: opp.edge })}
                      className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 transition border border-slate-700/80"
                      title="Ask Bob AI Explanation"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        onOpenPaperBet(opp);
                        setToastMsg(`Added ${opp.selection} to Betslip!`);
                      }}
                      className="px-6 py-2.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/50 text-xs font-bold rounded-lg transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    >
                      Quick Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 bg-emerald-500 text-black font-bold px-4 py-2 rounded shadow-lg animate-bounce z-50">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
