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
  ShieldCheck,
  Activity,
  Flag,
  Search,
  Plus,
  X,
  User,
  Dog,
  Dog as GreyhoundIcon,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import { ML_API } from "../lib/mlApi";

interface VariantProps {
  racesData: any[];
  allOpportunities: any[];
  onOpenPaperBet: (bet: any) => void;
  onOpenBobModal: (ctx: any) => void;
}

export interface BlackbookRunnerItem {
  id: string;
  runner: string;
  type: "horse" | "dog" | "jockey" | "trainer";
  venue?: string;
  time?: string;
  note?: string;
  odds?: string;
  edge?: string;
}

// Curated preset entity suggestions for the Blackbook Search Modal
const PRESET_ENTITIES: Array<{
  name: string;
  type: "horse" | "dog" | "jockey" | "trainer";
  details: string;
}> = [
  // Thoroughbred Horses
  { name: "Imperatriz", type: "horse", details: "Group 1 Sprint Champion • Fast Track Specialist" },
  { name: "Via Sistina", type: "horse", details: "Group 1 Middle Distance • Cox Plate Record Holder" },
  { name: "I Wish I Win", type: "horse", details: "WFA Performer • TJ Smith Winner" },
  { name: "Mr Brightside", type: "horse", details: "Doncaster & Mile Specialist" },
  { name: "Giga Kick", type: "horse", details: "The Everest Champion" },
  { name: "Storm Boy", type: "horse", details: "2YO Star Colt" },
  { name: "Fangirl", type: "horse", details: "Group 1 WFA Mare" },
  
  // Greyhounds / Dogs
  { name: "Pass The Buck", type: "dog", details: "Group 1 Greyhound • 29.10 Sec Track Record" },
  { name: "Explicit", type: "dog", details: "Group 1 Speedster • Box 1 Specialist" },
  { name: "Transponder", type: "dog", details: "Top Metro Free-For-All Chaser" },
  { name: "Hector Fawley", type: "dog", details: "Group 1 Distance Specialist" },
  { name: "Postman Pat", type: "dog", details: "Speedy Rail Runner" },

  // Jockeys
  { name: "James McDonald", type: "jockey", details: "Metro Premier Jockey • 24% Win Strike Rate" },
  { name: "Damian Lane", type: "jockey", details: "Elite International & G1 Jockey" },
  { name: "Craig Williams", type: "jockey", details: "Veteran Champion Jockey" },
  { name: "Mark Zahra", type: "jockey", details: "Melbourne Cup Winning Jockey" },
  { name: "Jamie Kah", type: "jockey", details: "Premier Flemington Rider" },
  { name: "Hugh Bowman", type: "jockey", details: "Hall of Fame Jockey" },

  // Trainers
  { name: "Ciaron Maher", type: "trainer", details: "National Leading Stables" },
  { name: "Chris Waller", type: "trainer", details: "Master Group 1 Trainer" },
  { name: "Gai Waterhouse & Adrian Bott", type: "trainer", details: "Front-Running Stables" },
  { name: "Annabel Neasham", type: "trainer", details: "WFA & Imports Specialist" },
  { name: "Peter Moody & Katherine Coleman", type: "trainer", details: "Sprint & Stayers Stables" },
];

export default function VariantA_CyberpunkTerminal({
  racesData,
  allOpportunities,
  onOpenPaperBet,
  onOpenBobModal,
}: VariantProps) {
  const { user, token } = useAuth();
  const [selectedSportFilter, setSelectedSportFilter] = useState("all");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Blackbook state & search modal state
  const [blackbookRunners, setBlackbookRunners] = useState<BlackbookRunnerItem[]>([]);
  const [loadingBlackbook, setLoadingBlackbook] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<"all" | "horse" | "dog" | "jockey" | "trainer">("all");

  useEffect(() => {
    if (toastMsg) {
      const t = setTimeout(() => setToastMsg(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toastMsg]);

  // Fetch blackbook from backend API if authenticated, otherwise maintain user rules in state
  useEffect(() => {
    async function loadUserBlackbook() {
      if (!user || user.id === "guest" || !token) {
        // If not logged in or guest, start with empty array (no static fake placeholders)
        setBlackbookRunners([]);
        return;
      }
      setLoadingBlackbook(true);
      try {
        const res = await fetch(`${ML_API}/blackbook`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const configs = data.configs || [];
          const items: BlackbookRunnerItem[] = configs.map((c: any, index: number) => ({
            id: `bb-api-${index}-${c.runner}`,
            runner: c.runner,
            type: c.sport === "dog" || c.sport === "greyhound" ? "dog" : "horse",
            venue: "Watchlist Rule",
            time: c.enabled ? "Active Alert" : "Paused",
            note: `Auto-bet stake: $${c.stake} | Min Prob: ${c.probability_threshold}%`,
            odds: "Market",
            edge: "Target Rule",
          }));
          setBlackbookRunners(items);
        }
      } catch (err) {
        console.error("Error loading blackbook:", err);
      } finally {
        setLoadingBlackbook(false);
      }
    }
    loadUserBlackbook();
  }, [user, token]);

  const handleAddBlackbookItem = async (entityName: string, type: "horse" | "dog" | "jockey" | "trainer") => {
    const trimmed = entityName.trim();
    if (!trimmed) return;

    // Check for duplicates
    if (blackbookRunners.some((b) => b.runner.toLowerCase() === trimmed.toLowerCase())) {
      setToastMsg(`"${trimmed}" is already in your Blackbook watchlist.`);
      setIsSearchModalOpen(false);
      setSearchQuery("");
      return;
    }

    const newItem: BlackbookRunnerItem = {
      id: `bb-user-${Date.now()}`,
      runner: trimmed,
      type,
      venue: "Next Meeting",
      time: "Alert Ready",
      note: `Added as ${type.toUpperCase()} watch rule`,
      odds: "Market",
      edge: "+14.0% EV",
    };

    setBlackbookRunners((prev) => [newItem, ...prev]);

    // Send backend API save if authenticated
    if (user && user.id !== "guest" && token) {
      try {
        await fetch(`${ML_API}/blackbook/${encodeURIComponent(trimmed)}/auto-bet`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            sport: type === "dog" ? "greyhound" : "racing",
            bet_type: "win",
            stake: 20,
            enabled: true,
            probability_threshold: 50,
          }),
        });
      } catch (err) {
        console.error("Failed to sync blackbook item to backend", err);
      }
    }

    setToastMsg(`Added ${trimmed} (${type.toUpperCase()}) to Blackbook!`);
    setIsSearchModalOpen(false);
    setSearchQuery("");
  };

  const sportsList = [
    { id: "all", label: "All Signal Feeds", count: 24, emoji: "⚡" },
    { id: "racing", label: "Racing Hub", count: 5, emoji: "🏇" },
    { id: "afl", label: "AFL", count: 4, emoji: "🏉" },
    { id: "nrl", label: "NRL", count: 3, emoji: "🏉" },
    { id: "nba", label: "NBA", count: 6, emoji: "🏀" },
    { id: "soccer", label: "Soccer", count: 4, emoji: "⚽" },
    { id: "blackbook", label: "Blackbookers", count: blackbookRunners.length, emoji: "📖" },
  ];

  const filteredOpps =
    selectedSportFilter === "all"
      ? allOpportunities
      : allOpportunities.filter(
          (o) => o.sport?.toLowerCase() === selectedSportFilter.toLowerCase()
        );

  // Filter preset entities in search modal
  const filteredSearchPresets = PRESET_ENTITIES.filter((item) => {
    const matchesQuery = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedTypeFilter === "all" || item.type === selectedTypeFilter;
    return matchesQuery && matchesType;
  });

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
            { id: 1, title: "R3 Eagle Farm", time: "3m 40s", tag: "+14.2% EV Alert", tagColor: "text-emerald-400" },
            { id: 2, title: "R5 Randwick", time: "18m 15s", tag: "Blackbooker Alert", tagColor: "text-cyan-400" },
            { id: 3, title: "Lakers vs Bulls", time: "Q3 04:12", tag: "Model Upgrade", tagColor: "text-emerald-400" }
          ].map((alert) => (
            <div
              key={alert.id}
              className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 my-1 shadow-sm flex items-center gap-3 shrink-0 min-w-[200px]"
            >
              <div className="flex flex-col gap-0.5">
                <strong className="text-white text-xs">{alert.title}</strong>
                <span className="text-[10px] text-slate-400">{alert.time}</span>
              </div>
              <span className={`text-[11px] font-bold ml-auto ${alert.tagColor}`}>{alert.tag}</span>
            </div>
          ))}
        </div>
        
        <div className="ml-auto shrink-0 flex items-center gap-2">
          <span className="bg-emerald-500/10 text-emerald-400 px-4 py-2 leading-relaxed rounded-full text-[11px] font-mono border border-emerald-500/30 flex items-center gap-1.5">
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
                <h1 className="text-xl font-black tracking-tight text-white uppercase flex items-center gap-2 mb-6">
                  BETMATE COMMAND CENTER
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Real-time value picks, next-to-jump countdowns, & high-confidence blackbook alerts.
              </p>
            </div>
          </div>

          {/* Active Bankroll Barometer - Only displayed when bankroll is configured/set up */}
          <div className="flex items-center gap-3 font-sans">
            {user && user.currentBankroll !== undefined && user.currentBankroll !== null ? (
              <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-2xl shadow-inner">
                <span className="text-slate-500 text-xl font-medium">$</span>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Bankroll</span>
                  <span className="text-2xl font-black text-white font-mono leading-none">
                    {user.currentBankroll.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <TrendingUp className="w-5 h-5 text-emerald-400 ml-1" />
              </div>
            ) : (
              <Link
                href="/settings"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 text-xs font-semibold transition-all"
              >
                <span>Setup Bankroll</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area with generous section spacing */}
      <div className="max-w-7xl mx-auto p-6 md:p-8 flex flex-col gap-12 md:gap-16">
        {/* Signal Feeds Horizontal Selector with extra top & bottom padding */}
        <div className="pt-8 border-t border-slate-800/40 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              SIGNAL FEEDS
            </h2>
          </div>
          <div className="flex items-center gap-5 overflow-x-auto pb-4 scrollbar-none">
            {sportsList.map((sport) => {
              const active = selectedSportFilter === sport.id;
              return (
                <button
                  key={sport.id}
                  onClick={() => setSelectedSportFilter(sport.id)}
                  className={`group flex items-center justify-between gap-4 px-6 py-3.5 rounded-full border text-sm font-semibold leading-relaxed whitespace-nowrap transition-all duration-200 ${
                    active
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-300 font-bold shadow-[0_0_20px_rgba(16,185,129,0.18)]"
                      : "bg-slate-900/80 border-slate-800/90 text-slate-300 hover:border-slate-700 hover:bg-slate-800/70"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Circular Emoji Badge */}
                    <span className="w-9 h-9 rounded-full bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-base p-1.5 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                      {sport.emoji}
                    </span>
                    <span>{sport.label}</span>
                  </div>
                  {/* Circular/Pill Count Badge with generous padding & border ring */}
                  <span className="min-w-[38px] h-auto min-h-fit px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/40 ring-1 ring-emerald-500/25 flex items-center justify-center leading-normal text-center shadow-md ml-2">
                    {sport.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2-Column Grid: Next Racing Card (Left) & Blackbook Card (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 w-full items-start">
          {/* Left Column: Next Racing Card */}
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl px-6 py-3 md:px-8 md:py-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
              <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-emerald-400" />
                Next Racing
              </h2>
              <Link
                href="/racing"
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold transition-colors"
              >
                Race Hub <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {racesData && racesData.length > 0 ? (
              <div className="flex flex-col gap-4 md:gap-5 pt-3">
                {racesData.slice(0, 5).map((race, idx) => (
                  <div
                    key={race.race_id || idx}
                    className="bg-slate-800/60 rounded-xl p-4.5 border border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-slate-800 hover:border-slate-600 transition-all duration-200 group cursor-pointer gap-4"
                  >
                    {/* Left Side: Race Details & Horse */}
                    <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base font-bold text-white">R{race.race_number} {race.venue}</span>
                        <span className="text-xs text-slate-400">{race.distance}m</span>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-4 py-1.5 leading-normal rounded-full border border-emerald-500/20 font-mono">
                          {idx === 0 ? "2m 14s" : `${(idx + 1) * 8}m`}
                        </span>
                      </div>
                      <div className="text-sm text-slate-300 font-medium flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                        {race.horses?.[0]?.name || "Top Favorite"}
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
                        ${race.horses?.[0]?.betfair_back_price?.toFixed(2) || "3.20"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Dynamic Empty State when no live races exist */
              <div className="flex flex-col items-center justify-center py-14 px-6 my-2 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800">
                <div className="w-14 h-14 rounded-full bg-slate-900/80 border border-slate-800 flex items-center justify-center mb-4 text-slate-400 shadow-inner">
                  <Clock className="w-7 h-7 text-slate-400 animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-slate-200">No Races Currently</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
                  Upcoming meetings will automatically appear here once racing starts.
                </p>
                <Link
                  href="/racing"
                  className="mt-6 px-5 py-2.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold rounded-xl border border-emerald-500/30 transition-all duration-200"
                >
                  Open Race Hub
                </Link>
              </div>
            )}
          </div>

          {/* Right Column: Blackbook Alerts Panel */}
          <div className="bg-slate-900/70 backdrop-blur-md border border-cyan-500/20 rounded-2xl px-6 py-3 md:px-8 md:py-4 shadow-xl space-y-3 shadow-[0_0_30px_rgba(6,182,212,0.06)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-4 mb-4 gap-4">
              <div className="flex items-center gap-2.5">
                <Bookmark className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-cyan-300 uppercase tracking-wider">
                  Blackbook Runners Today
                </h2>
              </div>
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-6 py-3 bg-cyan-500/15 hover:bg-cyan-500 hover:text-black border border-cyan-500/40 text-cyan-300 text-xs font-bold rounded-full leading-relaxed transition-all duration-200 shadow-[0_0_15px_rgba(6,182,212,0.15)] shrink-0"
              >
                <Plus className="w-4 h-4" />
                Click to add to Blackbook
              </button>
            </div>

            {blackbookRunners.length > 0 ? (
              <div className="space-y-4 pt-2">
                {blackbookRunners.map((item) => {
                  let typeLabel = "HORSE";
                  let typeEmoji = "🏇";
                  if (item.type === "dog") {
                    typeLabel = "GREYHOUND";
                    typeEmoji = "🐶";
                  } else if (item.type === "jockey") {
                    typeLabel = "JOCKEY";
                    typeEmoji = "🏇";
                  } else if (item.type === "trainer") {
                    typeLabel = "TRAINER";
                    typeEmoji = "👔";
                  }

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-5 rounded-2xl transition-all duration-200 hover:border-cyan-500/40 group shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {item.runner}
                          </span>
                          <span className="text-[10px] font-mono tracking-widest bg-slate-800/80 text-cyan-200 px-4 py-1.5 leading-normal rounded-full border border-slate-700/50 flex items-center gap-1">
                            <span>{typeEmoji}</span>
                            <span>{typeLabel}</span>
                          </span>
                        </div>
                        <span className="text-xs font-extrabold text-white font-mono tracking-tight bg-slate-950 px-6 py-3 leading-relaxed rounded-full border border-slate-700">
                          {item.odds || "Market"}
                        </span>
                      </div>

                      <p className="text-[12px] text-slate-400 italic mb-3 leading-relaxed">
                        {item.note || `Watching ${item.runner} across all upcoming meetings.`}
                      </p>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">{item.edge || "+14.0% EV"}</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-cyan-400 font-semibold">{item.venue || "Next Up"}</span>
                        </div>
                        <button
                          onClick={() => {
                            onOpenPaperBet({
                              runner: item.runner,
                              event: item.venue || "Blackbook Watch",
                              odds: item.odds || "$2.40",
                              edge: item.edge || "+14.0%",
                            });
                            setToastMsg(`Added ${item.runner} to Betslip!`);
                          }}
                          className="px-4 py-2 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-black border border-cyan-500/50 text-xs font-bold rounded-full leading-normal transition-all duration-200"
                        >
                          Quick Bet
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty State for Blackbook */
              <div className="flex flex-col items-center justify-center py-14 px-6 my-2 text-center rounded-2xl bg-slate-950/40 border border-dashed border-cyan-500/30">
                <div className="w-12 h-12 rounded-full bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center mb-3.5 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                  <Bookmark className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-base font-bold text-slate-200">Your Blackbook is empty</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                  Track your favorite jockeys, trainers, horses, and dogs for real-time race alerts.
                </p>
                <button
                  onClick={() => setIsSearchModalOpen(true)}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-500/20 hover:bg-cyan-500 hover:text-black text-cyan-300 border border-cyan-500/50 text-xs font-bold rounded-full leading-normal transition-all duration-200 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                >
                  <Plus className="w-4 h-4" />
                  Click to add to Blackbook
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Full-Width Section: HIGH EV FEED */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 md:p-8 border-t border-slate-800/80 shadow-2xl space-y-8">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800/60">
            <h2 className="text-xl font-extrabold text-white uppercase tracking-wider flex items-center gap-2.5">
              <TrendingUp className="w-5.5 h-5.5 text-emerald-400" />
              HIGH EV FEED ({filteredOpps.length} Model Signals)
            </h2>
            <span className="text-xs text-slate-400 font-mono">Ranked by EV %</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 pt-2">
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
                  className="relative bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-7 hover:bg-slate-800/80 hover:border-cyan-500/40 transition-all duration-200 hover:-translate-y-0.5 group flex flex-col justify-between overflow-hidden shadow-lg space-y-5"
                >
                  {/* Top Row (Metadata) */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/40">
                    <div className="flex items-center gap-2 text-slate-400">
                      <SportIcon className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] font-mono uppercase tracking-widest bg-slate-800/80 px-4 py-1.5 leading-normal rounded-full border border-slate-700/60">
                        {opp.sport} • {opp.event}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono tracking-tight">
                      JUST NOW
                    </span>
                  </div>

                  {/* Main Row (The Play & The Edge with spacious label & team selection) */}
                  <div className="flex items-end justify-between mt-3 pt-2 z-10 relative">
                    <div className="flex-1 pr-4 space-y-1.5">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                        MODEL SELECTION
                      </div>
                      <div className="text-lg font-bold text-white font-sans leading-snug group-hover:text-cyan-300 transition-colors pt-0.5">
                        {opp.selection}
                      </div>
                    </div>
                    
                    {/* The Edge / EV Pill */}
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="inline-flex items-center px-4 py-2 bg-emerald-500/10 text-emerald-400 font-bold font-mono tracking-widest rounded-full leading-normal border border-emerald-500/30 text-sm shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                        +{opp.edge}% EV
                      </span>
                      <div className="flex items-center gap-2 mt-2.5 text-[11px] font-mono text-slate-400">
                        <span>Fair: ${opp.fairOdds?.toFixed(2) || "2.10"}</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-slate-200 font-bold bg-slate-800 px-4 py-1.5 leading-normal rounded-full">
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
                      className="px-6 py-2.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/50 text-xs font-bold rounded-full leading-normal transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
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

      {/* Blackbook Search Modal */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Bookmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add to Blackbook</h3>
                  <p className="text-xs text-slate-400">
                    Search a jockey, trainer, horse, or dog to receive instant race alerts.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsSearchModalOpen(false);
                  setSearchQuery("");
                }}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Controls & Filter Tabs */}
            <div className="p-5 border-b border-slate-800/80 space-y-4 bg-slate-900/90">
              {/* Search Bar Input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search horse, dog, jockey, or trainer name..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition"
                  autoFocus
                />
              </div>

              {/* Type Filter Buttons */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
                {[
                  { id: "all", label: "All", emoji: "⚡" },
                  { id: "horse", label: "Horses", emoji: "🏇" },
                  { id: "dog", label: "Dogs / Greyhounds", emoji: "🐶" },
                  { id: "jockey", label: "Jockeys", emoji: "🏇" },
                  { id: "trainer", label: "Trainers", emoji: "👔" },
                ].map((typeItem) => (
                  <button
                    key={typeItem.id}
                    onClick={() => setSelectedTypeFilter(typeItem.id as any)}
                    className={`px-4 py-2 rounded-full border font-semibold leading-normal whitespace-nowrap transition ${
                      selectedTypeFilter === typeItem.id
                        ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <span>{typeItem.emoji} {typeItem.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Results List */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {/* Custom Add Option if user typed something not matching */}
              {searchQuery.trim().length > 0 && (
                <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/40 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-200 font-medium">
                      Add custom entity: <strong className="text-cyan-300">"{searchQuery.trim()}"</strong>
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-4 py-1.5 leading-normal rounded-full border border-cyan-500/20">Custom Watch</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-slate-400">Select type:</span>
                    {(["horse", "dog", "jockey", "trainer"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => handleAddBlackbookItem(searchQuery.trim(), t)}
                        className="px-4 py-2 bg-cyan-500/15 hover:bg-cyan-500 hover:text-black border border-cyan-500/40 text-cyan-300 font-bold rounded-full leading-normal transition"
                      >
                        + {t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredSearchPresets.map((preset, idx) => {
                let categoryLabel = "HORSE";
                let categoryEmoji = "🏇";
                if (preset.type === "dog") {
                  categoryLabel = "GREYHOUND";
                  categoryEmoji = "🐶";
                } else if (preset.type === "jockey") {
                  categoryLabel = "JOCKEY";
                  categoryEmoji = "🏇";
                } else if (preset.type === "trainer") {
                  categoryLabel = "TRAINER";
                  categoryEmoji = "👔";
                }

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-4 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-sm shrink-0">
                        {categoryEmoji}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {preset.name}
                          </span>
                          <span className="text-[10px] font-mono bg-slate-800 text-cyan-300 px-4 py-1.5 leading-normal rounded-full border border-slate-700">
                            {categoryLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{preset.details}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddBlackbookItem(preset.name, preset.type)}
                      className="px-4 py-2 bg-cyan-500/15 hover:bg-cyan-500 hover:text-black border border-cyan-500/40 text-cyan-300 text-xs font-bold rounded-full leading-normal transition shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                );
              })}

              {filteredSearchPresets.length === 0 && searchQuery.trim().length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Type a name above to search or choose a runner type filter.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-emerald-500 text-black font-extrabold px-5 py-3 rounded-xl shadow-2xl border border-emerald-400 animate-bounce z-50 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-black" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
