"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Brain,
  Calendar,
  Clock,
  Flame,
  Sparkles,
  TrendingUp,
  Trophy,
  Zap,
  CircleDot,
  Shield,
  Globe,
  Swords,
  Flag,
  ListFilter
} from "lucide-react";


// --- Data from Variant C (Sport Details) ---
interface GamePreview {
  id: string;
  homeTeam: string;
  awayTeam: string;
  time: string;
  favoredTeam: string;
  confidence: number;
  marketOdds: { home: string; away: string; draw?: string; };
}

interface BestEdgePreview {
  id: string;
  matchup: string;
  time: string;
  edgeBadge: string;
  edgeValue: string;
  pickName: string;
  odds: string;
  fairOdds: string;
  confidence: number;
  favoredTeam: string;
  rationale: string;
}

interface SportTabConfig {
  id: string;
  name: string;
  path: string;
  isPromoted: boolean;
  promotedColor: "rose" | "sky" | null;
  badge?: string;
  bestEdge: BestEdgePreview;
  upcomingGames: GamePreview[];
}

const SPORTS_DATA: SportTabConfig[] = [
  {
    id: "nfl",
    name: "NFL",
    path: "/nfl",
    isPromoted: true,
    promotedColor: "rose",
    badge: "HOT",
    bestEdge: {
      id: "nfl-edge-1",
      matchup: "Kansas City Chiefs vs Baltimore Ravens",
      time: "Sunday, 4:25 PM ET",
      edgeBadge: "High Value Edge",
      edgeValue: "+15.4% EV",
      pickName: "Ravens Moneyline",
      odds: "$2.10",
      fairOdds: "$1.82",
      confidence: 55,
      favoredTeam: "Baltimore Ravens",
      rationale: "Model identifies a notable mismatch in red-zone scoring efficiency against current market spread lines.",
    },
    upcomingGames: [
      {
        id: "nfl-g1",
        homeTeam: "Buffalo Bills",
        awayTeam: "Miami Dolphins",
        time: "Thursday, 8:15 PM ET",
        favoredTeam: "Buffalo Bills",
        confidence: 64,
        marketOdds: { home: "$1.54", away: "$2.60" },
      },
      {
        id: "nfl-g2",
        homeTeam: "San Francisco 49ers",
        awayTeam: "Detroit Lions",
        time: "Sunday, 6:30 PM ET",
        favoredTeam: "SF 49ers",
        confidence: 58,
        marketOdds: { home: "$1.68", away: "$2.25" },
      },
    ],
  },
  {
    id: "nba",
    name: "NBA",
    path: "/nba",
    isPromoted: true,
    promotedColor: "sky",
    badge: "LIVE",
    bestEdge: {
      id: "nba-edge-1",
      matchup: "Boston Celtics vs Milwaukee Bucks",
      time: "Tonight, 7:30 PM ET",
      edgeBadge: "Spread Edge",
      edgeValue: "+11.2% EV",
      pickName: "Celtics -4.5",
      odds: "$1.92",
      fairOdds: "$1.74",
      confidence: 62,
      favoredTeam: "Boston Celtics",
      rationale: "Offensive rating and transition turnover rate differential heavily tilts expected score towards Boston.",
    },
    upcomingGames: [
      {
        id: "nba-g1",
        homeTeam: "Denver Nuggets",
        awayTeam: "Phoenix Suns",
        time: "Tonight, 10:00 PM ET",
        favoredTeam: "Denver Nuggets",
        confidence: 57,
        marketOdds: { home: "$1.72", away: "$2.18" },
      },
      {
        id: "nba-g2",
        homeTeam: "Golden State Warriors",
        awayTeam: "Los Angeles Lakers",
        time: "Tomorrow, 10:30 PM ET",
        favoredTeam: "GSW",
        confidence: 53,
        marketOdds: { home: "$1.91", away: "$1.91" },
      },
    ],
  },
  {
    id: "afl",
    name: "AFL",
    path: "/afl",
    isPromoted: false,
    promotedColor: null,
    bestEdge: {
      id: "afl-edge-1",
      matchup: "Collingwood vs Carlton",
      time: "Friday, 7:50 PM AEST",
      edgeBadge: "Line Edge",
      edgeValue: "+9.8% EV",
      pickName: "Collingwood -8.5",
      odds: "$1.90",
      fairOdds: "$1.73",
      confidence: 61,
      favoredTeam: "Collingwood",
      rationale: "Contested possession differential and clearance efficiency give Collingwood a 9.8% advantage over consensus.",
    },
    upcomingGames: [
      {
        id: "afl-g1",
        homeTeam: "Sydney Swans",
        awayTeam: "Brisbane Lions",
        time: "Saturday, 4:35 PM AEST",
        favoredTeam: "Sydney Swans",
        confidence: 59,
        marketOdds: { home: "$1.65", away: "$2.30" },
      },
      {
        id: "afl-g2",
        homeTeam: "Geelong Cats",
        awayTeam: "Western Bulldogs",
        time: "Saturday, 7:25 PM AEST",
        favoredTeam: "Geelong Cats",
        confidence: 66,
        marketOdds: { home: "$1.48", away: "$2.75" },
      },
    ],
  },
  {
    id: "nrl",
    name: "NRL",
    path: "/nrl",
    isPromoted: false,
    promotedColor: null,
    bestEdge: {
      id: "nrl-edge-1",
      matchup: "Penrith Panthers vs Melbourne Storm",
      time: "Thursday, 7:50 PM AEST",
      edgeBadge: "Head-to-Head Edge",
      edgeValue: "+14.2% EV",
      pickName: "Panthers Moneyline",
      odds: "$1.85",
      fairOdds: "$1.62",
      confidence: 62,
      favoredTeam: "Penrith Panthers",
      rationale: "Model prices Penrith line defense higher after dominant defensive territory gains over recent fixtures.",
    },
    upcomingGames: [
      {
        id: "nrl-g1",
        homeTeam: "Brisbane Broncos",
        awayTeam: "Sydney Roosters",
        time: "Friday, 8:00 PM AEST",
        favoredTeam: "Brisbane Broncos",
        confidence: 54,
        marketOdds: { home: "$1.80", away: "$2.05" },
      },
      {
        id: "nrl-g2",
        homeTeam: "Cronulla Sharks",
        awayTeam: "Manly Sea Eagles",
        time: "Saturday, 5:30 PM AEST",
        favoredTeam: "Cronulla Sharks",
        confidence: 58,
        marketOdds: { home: "$1.70", away: "$2.20" },
      },
    ],
  },
  {
    id: "soccer",
    name: "Soccer",
    path: "/soccer",
    isPromoted: false,
    promotedColor: null,
    bestEdge: {
      id: "soccer-edge-1",
      matchup: "Arsenal vs Manchester City",
      time: "Sunday, 4:30 PM GMT",
      edgeBadge: "Double Chance Edge",
      edgeValue: "+8.9% EV",
      pickName: "Arsenal or Draw",
      odds: "$1.72",
      fairOdds: "$1.58",
      confidence: 58,
      favoredTeam: "Arsenal / Draw",
      rationale: "Expected goals conceded (xGA) metrics at Emirates Stadium show market has underpriced a stalemate or home win.",
    },
    upcomingGames: [
      {
        id: "soccer-g1",
        homeTeam: "Real Madrid",
        awayTeam: "Barcelona",
        time: "Saturday, 8:00 PM CET",
        favoredTeam: "Real Madrid",
        confidence: 54,
        marketOdds: { home: "$2.10", draw: "$3.50", away: "$3.20" },
      },
      {
        id: "soccer-g2",
        homeTeam: "Liverpool",
        awayTeam: "Chelsea",
        time: "Saturday, 12:30 PM GMT",
        favoredTeam: "Liverpool",
        confidence: 63,
        marketOdds: { home: "$1.57", draw: "$4.20", away: "$5.50" },
      },
    ],
  },
  {
    id: "mma",
    name: "MMA",
    path: "/mma",
    isPromoted: false,
    promotedColor: null,
    bestEdge: {
      id: "mma-edge-1",
      matchup: "Islam Makhachev vs Arman Tsarukyan",
      time: "UFC 308 Main Event, Sat 11:45 PM ET",
      edgeBadge: "Method of Victory",
      edgeValue: "+13.5% EV",
      pickName: "Makhachev by Decision",
      odds: "$2.65",
      fairOdds: "$2.15",
      confidence: 71,
      favoredTeam: "Islam Makhachev",
      rationale: "Takedown resistance numbers forecast high grappling density stretching this championship matchup to the judges.",
    },
    upcomingGames: [
      {
        id: "mma-g1",
        homeTeam: "Ilia Topuria",
        awayTeam: "Max Holloway",
        time: "UFC 308 Co-Main, Sat 11:00 PM ET",
        favoredTeam: "Ilia Topuria",
        confidence: 55,
        marketOdds: { home: "$1.85", away: "$1.98" },
      },
      {
        id: "mma-g2",
        homeTeam: "Robert Whittaker",
        awayTeam: "Khamzat Chimaev",
        time: "UFC 308, Sat 10:15 PM ET",
        favoredTeam: "Khamzat Chimaev",
        confidence: 58,
        marketOdds: { home: "$2.40", away: "$1.60" },
      },
    ],
  },
  {
    id: "golf",
    name: "Golf",
    path: "/golf",
    isPromoted: false,
    promotedColor: null,
    bestEdge: {
      id: "golf-edge-1",
      matchup: "The Masters — Top 5 Market",
      time: "Thursday, 8:30 AM EST",
      edgeBadge: "Placement Edge",
      edgeValue: "+10.4% EV",
      pickName: "Scottie Scheffler Top 5",
      odds: "$2.10",
      fairOdds: "$1.85",
      confidence: 52,
      favoredTeam: "Scottie Scheffler",
      rationale: "Strokes Gained: Tee-to-Green dominance aligns with historical Augusta National tournament winning profiles.",
    },
    upcomingGames: [
      {
        id: "golf-g1",
        homeTeam: "Rory McIlroy",
        awayTeam: "Xander Schauffele (72-Hole H2H)",
        time: "Tournament Matchup, Thu-Sun",
        favoredTeam: "Xander Schauffele",
        confidence: 56,
        marketOdds: { home: "$1.95", away: "$1.87" },
      },
      {
        id: "golf-g2",
        homeTeam: "Ludvig Åberg",
        awayTeam: "Viktor Hovland (72-Hole H2H)",
        time: "Tournament Matchup, Thu-Sun",
        favoredTeam: "Ludvig Åberg",
        confidence: 54,
        marketOdds: { home: "$1.90", away: "$1.90" },
      },
    ],
  },
];

// --- Data from Variant B (Edge Feed) ---
interface EdgeItem {
  id: string;
  sport: string;
  matchup: string;
  recommendedPick: string;
  edge: number;
  modelProb: number;
  marketProb: number;
  fairOdds: string;
  marketOdds: string;
  time: string;
  confidence: "High" | "Very High" | "Moderate";
  keyDriver: string;
  analysisPath: string;
}

const EDGE_ITEMS: EdgeItem[] = [
  { id: "edge-1", sport: "NBA", matchup: "Lakers vs Celtics", recommendedPick: "Lakers Moneyline", edge: 14.2, modelProb: 58.2, marketProb: 44.0, fairOdds: "1.72", marketOdds: "2.27", time: "Today 10:30am", confidence: "Very High", keyDriver: "Interior rim protection edge (+5.2 rating differential) vs cold 3PT variance", analysisPath: "/nba" },
  { id: "edge-2", sport: "NFL", matchup: "Chiefs vs Ravens", recommendedPick: "Chiefs -2.5 Spread", edge: 12.6, modelProb: 64.1, marketProb: 51.5, fairOdds: "1.56", marketOdds: "1.94", time: "Today 1:00pm", confidence: "High", keyDriver: "Mahomes 3rd-and-medium conversion model rate + defensive pressure index", analysisPath: "/nfl" },
  { id: "edge-3", sport: "AFL", matchup: "Collingwood vs Carlton", recommendedPick: "Collingwood +8.5", edge: 11.8, modelProb: 56.4, marketProb: 44.6, fairOdds: "1.77", marketOdds: "2.24", time: "Friday 7:50pm", confidence: "High", keyDriver: "Inside 50 efficiency model outperforms market line by 7.4 rating points", analysisPath: "/afl" },
  { id: "edge-4", sport: "NBA", matchup: "Warriors vs Suns", recommendedPick: "Over 228.5 Total Points", edge: 10.4, modelProb: 62.0, marketProb: 51.6, fairOdds: "1.61", marketOdds: "1.94", time: "Today 2:30pm", confidence: "High", keyDriver: "Pace simulation yields 104.2 possessions; Suns on zero days rest", analysisPath: "/nba" },
  { id: "edge-5", sport: "NRL", matchup: "Penrith Panthers vs Broncos", recommendedPick: "Panthers -4.5 Spread", edge: 10.1, modelProb: 65.5, marketProb: 55.4, fairOdds: "1.53", marketOdds: "1.81", time: "Saturday 7:35pm", confidence: "High", keyDriver: "Territory completion rate 84% in second half against fatigue profile", analysisPath: "/nrl" },
  { id: "edge-6", sport: "Soccer", matchup: "Arsenal vs Chelsea", recommendedPick: "Arsenal Win & BTTS", edge: 9.7, modelProb: 54.2, marketProb: 44.5, fairOdds: "1.85", marketOdds: "2.25", time: "Sunday 2:30am", confidence: "Moderate", keyDriver: "xG differential +1.18 at home; high high-press turnover conversion", analysisPath: "/soccer" },
];

const SPORT_STYLES: Record<string, { icon: React.ElementType, badge: string, border: string }> = {
  NBA: { icon: Zap, badge: "bg-sky-500/15 text-sky-300 border-sky-500/30", border: "border-l-sky-500" },
  NFL: { icon: Flame, badge: "bg-rose-500/15 text-rose-300 border-rose-500/30", border: "border-l-rose-500" },
  AFL: { icon: CircleDot, badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", border: "border-l-emerald-500" },
  NRL: { icon: Shield, badge: "bg-amber-500/15 text-amber-300 border-amber-500/30", border: "border-l-amber-500" },
  Soccer: { icon: Globe, badge: "bg-violet-500/15 text-violet-300 border-violet-500/30", border: "border-l-violet-500" },
  MMA: { icon: Swords, badge: "bg-orange-500/15 text-orange-300 border-orange-500/30", border: "border-l-orange-500" },
  Golf: { icon: Flag, badge: "bg-teal-500/15 text-teal-300 border-teal-500/30", border: "border-l-teal-500" }
};

export default function SportPage() {
  // We add 'feed' as the default view representing Variant B's algorithmic feed
  const [activeTab, setActiveTab] = useState<string>("feed");

  const renderFeed = () => (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      <div className="flex items-center justify-between px-1 mb-2">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <ListFilter size={18} className="text-emerald-400" />
          <span>Top Mathematical Edges</span>
        </h2>
        <span className="text-xs text-slate-400 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
          Ranked by EV% across all sports
        </span>
      </div>

      {EDGE_ITEMS.map((item) => {
        const style = SPORT_STYLES[item.sport] || SPORT_STYLES["NBA"];
        const SportIcon = style.icon;

        return (
          <article
            key={item.id}
            className={`group relative rounded-2xl bg-slate-950/75 border border-slate-800/90 ${style.border} border-l-4 p-5 sm:p-6 transition-all duration-200 hover:border-slate-700 hover:bg-slate-900/70 hover:shadow-xl hover:shadow-cyan-950/15`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${style.badge}`}>
                  <SportIcon size={13} />
                  <span>{item.sport}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Clock size={12} className="text-slate-500" />
                  <span>{item.time}</span>
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-xs font-black tracking-wide shadow-sm shadow-emerald-500/10">
                <TrendingUp size={13} />
                <span>+{item.edge}% Edge</span>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-100 tracking-tight group-hover:text-cyan-300 transition-colors">
                  {item.matchup}
                </h2>
                <div className="text-xs text-slate-400">
                  Recommended: <span className="font-semibold text-slate-200">{item.recommendedPick}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                <span className="text-slate-500 font-medium">Model driver:</span> {item.keyDriver}
              </p>
            </div>

            <div className="space-y-2 py-3 px-4 rounded-xl bg-slate-900/60 border border-slate-800/80 mb-4">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Model Win%:</span>
                  <span className="font-extrabold text-cyan-400 text-sm">{item.modelProb}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Market Implied:</span>
                  <span className="font-semibold text-slate-300">{item.marketProb}%</span>
                </div>
              </div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                <div className="absolute top-0 bottom-0 left-0 bg-slate-600 rounded-l-full" style={{ width: `${item.marketProb}%` }} />
                <div
                  className="absolute top-0 bottom-0 bg-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                  style={{ left: `${item.marketProb}%`, width: `${Math.max(item.modelProb - item.marketProb, 2)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-600" />Bookmaker implied</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold"><span className="w-2 h-2 rounded-full bg-emerald-500" />+{item.edge}% Edge Gap</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );

  const renderSport = () => {
    const currentSport = SPORTS_DATA.find((sport) => sport.id === activeTab);
    if (!currentSport) return null;

    return (
      <div className="space-y-6 animate-in fade-in-50 duration-300">
        {/* Best Edge Highlight Card (from Variant C) */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/50 bg-gradient-to-br from-emerald-950/30 via-slate-900/90 to-slate-950 p-6 shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)] backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider w-fit">
              <Sparkles size={14} className="text-emerald-400 animate-pulse" />
              <span>{currentSport.bestEdge.edgeBadge}</span>
              <span className="text-emerald-500">•</span>
              <span className="text-emerald-300">{currentSport.bestEdge.edgeValue}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar size={14} className="text-slate-500" />
              <span>{currentSport.bestEdge.time}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="lg:col-span-2 space-y-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Featured Matchup</span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight mt-0.5">{currentSport.bestEdge.matchup}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">
                  Recommended: {currentSport.bestEdge.pickName}
                </div>
                <div className="text-xs text-slate-400">
                  Market: <span className="font-semibold text-slate-200">{currentSport.bestEdge.odds}</span> <span className="text-slate-600">|</span> Fair: <span className="font-semibold text-emerald-400">{currentSport.bestEdge.fairOdds}</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">{currentSport.bestEdge.rationale}</p>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium flex items-center gap-1.5"><Brain size={14} className="text-emerald-400" />Model Confidence</span>
                <span className="font-black text-emerald-400 text-sm">{currentSport.bestEdge.confidence}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden p-[1px]">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: `${currentSport.bestEdge.confidence}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Favors {currentSport.bestEdge.favoredTeam}</span>
                <span className="text-emerald-400 font-semibold">High Edge</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2-3 Upcoming Game Cards (from Variant C) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              <span>Upcoming {currentSport.name} Fixtures</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentSport.upcomingGames.map((game) => (
              <div key={game.id} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-700/80 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2.5">
                    <span className="flex items-center gap-1.5"><Clock size={13} className="text-slate-500" />{game.time}</span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-100 mb-3">{game.homeTeam} <span className="text-slate-500 font-normal text-sm">vs</span> {game.awayTeam}</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-lg bg-slate-900/80 border border-slate-800/60 mb-4">
                    <div className="flex justify-between items-center"><span className="text-slate-400">{game.homeTeam}</span><span className="font-bold text-slate-200">{game.marketOdds.home}</span></div>
                    <div className="flex justify-between items-center"><span className="text-slate-400">{game.awayTeam}</span><span className="font-bold text-slate-200">{game.marketOdds.away}</span></div>
                  </div>
                </div>
                <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5"><Brain size={13} className="text-emerald-400" />Model Probability</span>
                    <span className="font-bold text-emerald-400">{game.confidence}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${game.confidence}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6">
      {/* 1. Dashboard Header */}
      <section className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <div className="text-emerald-400 font-semibold text-xs sm:text-sm mb-2 flex items-center gap-2 tracking-wide uppercase">
          <Trophy size={16} />
          <span>Sport Hub</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
          Sports Dashboard
        </h1>
        <p className="text-slate-400 mt-2 text-sm sm:text-base max-w-2xl leading-relaxed">
          AI-powered predictions across 7 sports
        </p>
      </section>

      {/* 2. Hybrid Tab Bar */}
      <div className="relative border-b border-slate-800/90 overflow-x-auto scrollbar-none">
        <div className="flex items-end gap-1 sm:gap-2 min-w-max pb-[1px]">
          
          {/* Feed Tab (The "Best of B" addition) */}
          <button
            onClick={() => setActiveTab("feed")}
            className={`group relative flex items-center gap-2 whitespace-nowrap px-5 py-3.5 text-base font-bold transition-all ${
              activeTab === "feed"
                ? "border-b-2 border-emerald-500 text-white bg-emerald-500/10 shadow-[0_2px_10px_rgba(16,185,129,0.2)]"
                : "border-b-2 border-emerald-500/30 text-emerald-300/70 hover:text-emerald-100 hover:border-emerald-400 hover:bg-slate-900/40"
            }`}
            role="tab"
          >
            <span className="flex items-center gap-1.5">
              <TrendingUp size={16} className={activeTab === "feed" ? "text-emerald-400" : "text-emerald-400/60"} />
              All Edges Feed
            </span>
          </button>

          {SPORTS_DATA.map((sport) => {
            const isActive = activeTab === sport.id;

            // NFL promoted tab
            if (sport.id === "nfl") {
              return (
                <button
                  key={sport.id}
                  onClick={() => setActiveTab(sport.id)}
                  className={`group relative flex items-center gap-2 whitespace-nowrap px-5 py-3.5 text-base font-bold transition-all ${
                    isActive
                      ? "border-b-2 border-rose-500 text-white bg-rose-500/10 shadow-[0_2px_10px_rgba(244,63,94,0.2)]"
                      : "border-b-2 border-rose-500/30 text-rose-300/70 hover:text-rose-100 hover:border-rose-400 hover:bg-slate-900/40"
                  }`}
                  role="tab"
                >
                  <span className="flex items-center gap-1.5"><Flame size={16} className={isActive ? "text-rose-400" : "text-rose-400/60"} />{sport.name}</span>
                </button>
              );
            }

            // NBA promoted tab
            if (sport.id === "nba") {
              return (
                <button
                  key={sport.id}
                  onClick={() => setActiveTab(sport.id)}
                  className={`group relative flex items-center gap-2 whitespace-nowrap px-5 py-3.5 text-base font-bold transition-all ${
                    isActive
                      ? "border-b-2 border-sky-400 text-white bg-sky-500/10 shadow-[0_2px_10px_rgba(56,189,248,0.2)]"
                      : "border-b-2 border-sky-500/30 text-sky-300/70 hover:text-sky-100 hover:border-sky-400 hover:bg-slate-900/40"
                  }`}
                  role="tab"
                >
                  <span className="flex items-center gap-1.5"><Zap size={16} className={isActive ? "text-sky-400" : "text-sky-400/60"} />{sport.name}</span>
                </button>
              );
            }

            // Standard tabs
            return (
              <button
                key={sport.id}
                onClick={() => setActiveTab(sport.id)}
                className={`group relative flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm transition-all ${
                  isActive
                    ? "border-b-2 border-slate-100 text-white font-bold bg-slate-800/40"
                    : "border-b-2 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600 hover:bg-slate-900/30 font-medium"
                }`}
                role="tab"
              >
                <span>{sport.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Content Area */}
      {activeTab === "feed" ? renderFeed() : renderSport()}
    </div>
  );
}
