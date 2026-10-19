import React from "react";
import {
  Trophy,
  Zap,
  Activity,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Clock,
  Bookmark,
  Plus,
  Check,
  Bot,
  Layers,
  Sparkles,
  BarChart3,
  Calendar,
  Compass,
  DollarSign,
  Award,
  Wallet,
  Play,
  CheckCircle2,
  XCircle,
  Flame,
  Share2,
} from "lucide-react";
import { MOCK_RACES, MOCK_SPORTS, MOCK_EV_FEED } from "../../data/mockData";
import { useBetslip } from "../../context/BetslipContext";
import { useBlackbook } from "../../context/BlackbookContext";
import { buildBobExplanation } from "../../lib/bob/explainer";
import type { BobExplanation } from "../../lib/bob/explainer";
import { HomePerformanceCharts } from "../home/HomePerformanceCharts";

interface HomeViewProps {
  onNavigate: (view: string) => void;
  onOpenBob: (explanation: BobExplanation) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate, onOpenBob }) => {
  const {
    addBet,
    bets,
    settledBets,
    activeBets,
    simulateSettleNextBet,
    setIsBetslipOpen,
    setActiveTab,
    openShareCard,
    openQuickBet,
  } = useBetslip();
  const { isBookmarked, quickAdd } = useBlackbook();

  const nextRaces = MOCK_RACES.slice(0, 3);
  const topEVTips = MOCK_EV_FEED.slice(0, 6);

  // Performance calculations from settled paper bets
  const settledCount = settledBets.length;
  const wonBets = settledBets.filter((b) => b.status === "won");
  const lostBets = settledBets.filter((b) => b.status === "lost");
  const winCount = wonBets.length;
  const lostCount = lostBets.length;
  const winRate = settledCount > 0 ? (winCount / settledCount) * 100 : 0;
  const totalStaked = settledBets.reduce((acc, b) => acc + (b.stake || 0), 0);
  const totalPayout = settledBets.reduce((acc, b) => acc + (b.payout || 0), 0);
  const netProfitLoss = totalPayout - totalStaked;
  const roi = totalStaked > 0 ? (netProfitLoss / totalStaked) * 100 : 0;
  const isPositive = netProfitLoss >= 0;
  const avgEdge =
    settledCount > 0
      ? settledBets.reduce((acc, b) => acc + (b.edge_pct || 0), 0) / settledCount
      : 0;

  // Consecutive Win Streak calculations
  const { currentWinStreak, bestWinStreak } = React.useMemo(() => {
    if (settledBets.length === 0) return { currentWinStreak: 0, bestWinStreak: 0 };

    const sorted = [...settledBets].sort((a, b) => {
      const timeA = a.settled_at ? new Date(a.settled_at).getTime() : 0;
      const timeB = b.settled_at ? new Date(b.settled_at).getTime() : 0;
      return timeB - timeA;
    });

    let current = 0;
    for (const b of sorted) {
      if (b.status === "won") {
        current++;
      } else if (b.status === "lost") {
        break;
      }
    }

    const chronological = [...sorted].reverse();
    let best = 0;
    let run = 0;
    for (const b of chronological) {
      if (b.status === "won") {
        run++;
        if (run > best) best = run;
      } else if (b.status === "lost") {
        run = 0;
      }
    }

    return { currentWinStreak: current, bestWinStreak: Math.max(best, current) };
  }, [settledBets]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* HERO COMMAND SHOWCASE & MULTI BUILDER / EXPLORE RACES REDESIGN */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        {/* Ambient atmospheric glows */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Quant AI Value Overview (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <Zap size={14} className="text-cyan-400" />
              <span>Quantitative AI Engine Active</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                AI Multi-Sport Value Predictions &amp; Alpha
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                Real-time Expected Value (+EV) signals across Australian Thoroughbred, Harness, Greyhounds, plus NBA, AFL, NRL &amp; World Soccer with explainable XGBoost models and Copula correlation pricing.
              </p>
            </div>

            {/* Micro quant metrics */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-400 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Calibration: <strong className="text-white font-mono">94.2%</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>Multi Haircut: <strong className="text-white font-mono">Gaussian Copula</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Avg Model Overlay: <strong className="text-amber-400 font-mono">+{avgEdge.toFixed(1)}%</strong></span>
              </div>
            </div>
          </div>

          {/* Right: Redesigned Multi Builder & Explore Races Interactive Cards (5 cols) */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Card 1: Multi Builder */}
            <div
              onClick={() => onNavigate("multi-builder")}
              className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 hover:border-emerald-400/60 transition-all cursor-pointer group shadow-lg flex flex-col justify-between space-y-3 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <Layers size={18} />
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  +18.5% SGM
                </span>
              </div>

              <div>
                <h3 className="text-sm font-black text-white group-hover:text-emerald-300 transition-colors">
                  Multi Builder
                </h3>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Copula correlation haircuts &amp; multi parlay math
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs font-bold text-emerald-400">
                <span>Build SGM</span>
                <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 2: Explore Racecards */}
            <div
              onClick={() => onNavigate("racing")}
              className="p-4 rounded-2xl bg-gradient-to-br from-orange-950/40 via-slate-900 to-slate-950 border border-orange-500/30 hover:border-orange-400/60 transition-all cursor-pointer group shadow-lg flex flex-col justify-between space-y-3 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
                  <Activity size={18} />
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  Metro Live
                </span>
              </div>

              <div>
                <h3 className="text-sm font-black text-white group-hover:text-orange-300 transition-colors">
                  Explore Races
                </h3>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Sectionals, speed maps &amp; barrier pace bias
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs font-bold text-orange-400">
                <span>Race Cards</span>
                <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAPER BETTING PERFORMANCE SUMMARY WIDGET */}
      <section className="rounded-2xl sm:rounded-3xl bg-slate-950/90 border border-slate-800 p-5 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div
          className={`absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 ${
            isPositive ? "bg-emerald-500" : "bg-rose-500"
          }`}
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${
                isPositive
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : "bg-rose-500/15 border-rose-500/30 text-rose-400"
              }`}
            >
              {isPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Paper Portfolio Performance
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  Settled Bets
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live quantitative tracking of your simulated wagers, real-time yield, and strike rate
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {activeBets.length > 0 && (
              <button
                type="button"
                onClick={simulateSettleNextBet}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Simulate race or game outcome for the next active bet"
              >
                <Play size={13} className="fill-cyan-400 text-cyan-400" />
                <span>Simulate Next ({activeBets.length})</span>
              </button>
            )}

            {settledCount > 0 && (
              <button
                type="button"
                onClick={() => openShareCard()}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Generate shareable card of recent winning bet"
              >
                <Share2 size={13} />
                <span>Share Top Win</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveTab("settled");
                setIsBetslipOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Detailed Ledger</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {settledCount === 0 ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-300">
              No paper bets settled yet. Place bets from the +EV feed or races to track performance.
            </p>
            <button
              type="button"
              onClick={() => onNavigate("high-ev")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              <span>Explore High EV Tips</span>
              <ArrowRight size={13} />
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {/* Net P/L */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span>Total Paper P/L</span>
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      isPositive
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {isPositive ? `+${roi.toFixed(1)}% ROI` : `${roi.toFixed(1)}% ROI`}
                  </span>
                </div>
                <div
                  className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                    isPositive ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {isPositive ? `+$${netProfitLoss.toFixed(2)}` : `-$${Math.abs(netProfitLoss).toFixed(2)}`}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  ${totalPayout.toFixed(2)} returned / ${totalStaked.toFixed(2)} staked
                </p>
              </div>

              {/* Win Rate */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span>Win Rate</span>
                  <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                    {winCount}W - {lostCount}L
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                  {winRate.toFixed(1)}%
                </div>
                {/* Ratio mini progress bar */}
                <div className="w-full h-1.5 bg-rose-500/40 rounded-full overflow-hidden flex mt-1">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${winRate}%` }}
                  />
                </div>
              </div>

              {/* Win Streak Card */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span className="flex items-center gap-1">
                    <Flame
                      size={14}
                      className={currentWinStreak > 0 ? "text-amber-400 fill-amber-400 animate-bounce" : "text-slate-500"}
                    />
                    <span>Win Streak</span>
                  </span>
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      currentWinStreak >= 2
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : currentWinStreak === 1
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {currentWinStreak >= 2 ? "🔥 HOT RUN" : currentWinStreak === 1 ? "ACTIVE" : "READY"}
                  </span>
                </div>
                <div
                  className={`text-xl sm:text-2xl font-black font-mono tracking-tight flex items-baseline gap-1.5 ${
                    currentWinStreak > 0 ? "text-amber-400" : "text-white"
                  }`}
                >
                  <span>{currentWinStreak}</span>
                  <span className="text-xs font-bold text-slate-400">
                    {currentWinStreak === 1 ? "Win" : "Wins"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Best run: <strong className="text-slate-200">{bestWinStreak}W</strong> consecutive
                </p>
              </div>

              {/* In-Play Active Bets */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span>Pending In-Play</span>
                  <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-cyan-400 tracking-tight">
                  {activeBets.length} {activeBets.length === 1 ? "Bet" : "Bets"}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  ${activeBets.reduce((sum, b) => sum + (b.stake || 0), 0).toFixed(2)} at risk in market
                </p>
              </div>

              {/* Avg Model Edge */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span>Avg Model Overlay</span>
                  <span className="text-[10px] font-bold text-yellow-400 bg-yellow-950/50 border border-yellow-800/50 px-1.5 py-0.5 rounded">
                    +EV Alpha
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-yellow-400 tracking-tight">
                  +{avgEdge.toFixed(1)}%
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Average edge across {settledCount} settled wagers
                </p>
              </div>
            </div>

            {/* 30-Day Trend & Doughnut Visualizations */}
            <div className="pt-5 border-t border-slate-800/80 mt-2">
              <HomePerformanceCharts
                settledBets={settledBets}
                onNavigateToLedger={() => {
                  setActiveTab("settled");
                  setIsBetslipOpen(true);
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Quick Nav Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onNavigate("racing")}
          className="p-4 rounded-2xl bg-gradient-to-br from-orange-950/30 to-slate-950 border border-orange-500/25 hover:border-orange-500/50 transition-all text-left group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-3 group-hover:scale-110 transition-transform">
            <Activity size={20} />
          </div>
          <span className="text-sm font-black text-white block">Racing Hub</span>
          <span className="text-[11px] text-slate-400">Metro &amp; Provincial cards</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("sport")}
          className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/30 to-slate-950 border border-blue-500/25 hover:border-blue-500/50 transition-all text-left group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3 group-hover:scale-110 transition-transform">
            <Trophy size={20} />
          </div>
          <span className="text-sm font-black text-white block">Sports Hub</span>
          <span className="text-[11px] text-slate-400">NBA, AFL, NRL &amp; Soccer</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("multi-builder")}
          className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 to-slate-950 border border-emerald-500/25 hover:border-emerald-500/50 transition-all text-left group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-110 transition-transform">
            <Layers size={20} />
          </div>
          <span className="text-sm font-black text-white block">Multi Builder</span>
          <span className="text-[11px] text-slate-400">Copula SGM correlation</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("strategy")}
          className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/30 to-slate-950 border border-purple-500/25 hover:border-purple-500/50 transition-all text-left group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3 group-hover:scale-110 transition-transform">
            <BarChart3 size={20} />
          </div>
          <span className="text-sm font-black text-white block">Strategy Lab</span>
          <span className="text-[11px] text-slate-400">Quant Kelly &amp; backtesting</span>
        </button>
      </div>

      {/* HIGH EV FEED TABLE */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="text-yellow-400 fill-yellow-400" size={20} />
            <h2 className="text-lg font-bold text-white">Top High EV Feed (Today)</h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("high-ev")}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
          >
            <span>View All +EV Feed</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {topEVTips.map((tip) => {
            const inSlip = bets.some((b) => b.selection === tip.selection);
            const bookmarked = isBookmarked(tip.selection);

            return (
              <div
                key={tip.id}
                className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3 relative group shadow-sm"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      +{tip.edge_pct}% EV Edge
                    </span>
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">
                      {tip.game_context}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-white leading-snug">{tip.selection}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>
                      Market: <strong className="text-white font-mono">${tip.best_odds.toFixed(2)}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Model Fair: <strong className="text-emerald-400 font-mono">${tip.fair_odds.toFixed(2)}</strong>
                    </span>
                    <span>•</span>
                    <span>Prob: <strong className="text-slate-300">{(tip.true_prob * 100).toFixed(0)}%</strong></span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const expl = buildBobExplanation({
                        sport: tip.sport,
                        selectionName: tip.selection,
                        probability: tip.true_prob * 100,
                        fairOdds: tip.fair_odds,
                        marketOdds: tip.best_odds,
                      });
                      onOpenBob(expl);
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/25 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Bot size={13} />
                    <span>Ask Bob</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => quickAdd(tip.selection, "RUNNER", tip.sport)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        bookmarked
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                      title={bookmarked ? "Bookmarked in Blackbook" : "Quick-add to Blackbook"}
                    >
                      <Bookmark size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        openQuickBet({
                          sport: tip.sport,
                          event_id: tip.id,
                          event_name: tip.game_context,
                          selection: tip.selection,
                          bet_type: "win",
                          odds: tip.best_odds,
                          stake: 20,
                          fair_odds: tip.fair_odds,
                          edge_pct: tip.edge_pct,
                        });
                      }}
                      className="px-2 py-1.5 rounded-lg text-xs font-black bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1 cursor-pointer"
                      title="Instant Quick Bet on tip"
                    >
                      <Zap size={13} className="fill-amber-400 text-amber-400" />
                      <span className="hidden sm:inline">Quick</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        addBet(
                          {
                            sport: tip.sport,
                            event_id: tip.id,
                            event_name: tip.game_context,
                            selection: tip.selection,
                            bet_type: "win",
                            odds: tip.best_odds,
                            stake: 10,
                            fair_odds: tip.fair_odds,
                            edge_pct: tip.edge_pct,
                          },
                          true
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors flex items-center gap-1 cursor-pointer ${
                        inSlip
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                      }`}
                    >
                      {inSlip ? <Check size={14} /> : <Plus size={14} />}
                      <span>{inSlip ? "In Slip" : "Paper Bet"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* UPCOMING RACES SECTION */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="text-cyan-400" size={20} />
            <h2 className="text-lg font-bold text-white">Next to Jump &amp; Featured Meetings</h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("racing")}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
          >
            <span>View All Races</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {nextRaces.map((race) => {
            const topHorse = race.horses[0];
            return (
              <div
                key={race.race_id}
                className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 hover:border-slate-700 transition-all space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-black flex items-center justify-center">
                      R{race.race_number}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-white leading-tight">{race.venue}</h4>
                      <span className="text-[11px] text-slate-400">
                        {race.distance}m • {race.track_condition}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    Starts soon
                  </span>
                </div>

                {topHorse && (
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                        Top Model Pick
                      </span>
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        ${topHorse.betfair_back_price.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate max-w-[170px]">
                        {topHorse.saddlecloth}. {topHorse.name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {topHorse.win_probability}% Win Prob
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onNavigate("racing")}
                  className="w-full py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Open Full Racecard</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* FEATURED SPORTS MATCHUP */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="text-blue-400" size={20} />
            <h2 className="text-lg font-bold text-white">Featured Sports Matchup</h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("sport")}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
          >
            <span>All Sports Fixtures</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {MOCK_SPORTS[0] && (
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/30 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {MOCK_SPORTS[0].sport_label}
                </span>
                <span className="text-xs text-slate-400">{MOCK_SPORTS[0].venue}</span>
              </div>
              <span className="text-xs font-bold text-emerald-400">
                +{MOCK_SPORTS[0].edge_home_pct}% Model Edge on {MOCK_SPORTS[0].home_team}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  {MOCK_SPORTS[0].home_team} vs {MOCK_SPORTS[0].away_team}
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {MOCK_SPORTS[0].key_matchup_analysis}
                </p>
              </div>

              {/* Odds & win prob bars */}
              <div className="space-y-2 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>{MOCK_SPORTS[0].home_team}: {MOCK_SPORTS[0].home_win_probability}%</span>
                  <span>{MOCK_SPORTS[0].away_team}: {MOCK_SPORTS[0].away_win_probability}%</span>
                </div>
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${MOCK_SPORTS[0].home_win_probability}%` }}
                  />
                  <div
                    className="bg-blue-600 h-full transition-all"
                    style={{ width: `${MOCK_SPORTS[0].away_win_probability}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono pt-1">
                  <span className="text-emerald-400 font-bold">${MOCK_SPORTS[0].market_odds_home.toFixed(2)} (Fair ${MOCK_SPORTS[0].fair_odds_home.toFixed(2)})</span>
                  <span className="text-slate-400">${MOCK_SPORTS[0].market_odds_away.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const expl = buildBobExplanation({
                    sport: MOCK_SPORTS[0].sport,
                    selectionName: MOCK_SPORTS[0].home_team,
                    probability: MOCK_SPORTS[0].home_win_probability,
                    fairOdds: MOCK_SPORTS[0].fair_odds_home,
                    marketOdds: MOCK_SPORTS[0].market_odds_home,
                  });
                  onOpenBob(expl);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/25 flex items-center gap-1 cursor-pointer"
              >
                <Bot size={14} />
                <span>Ask Bob Analysis</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  addBet(
                    {
                      sport: MOCK_SPORTS[0].sport,
                      event_id: MOCK_SPORTS[0].game_id,
                      event_name: `${MOCK_SPORTS[0].home_team} vs ${MOCK_SPORTS[0].away_team}`,
                      selection: `${MOCK_SPORTS[0].home_team} Moneyline`,
                      bet_type: "win",
                      odds: MOCK_SPORTS[0].market_odds_home,
                      stake: 20,
                      fair_odds: MOCK_SPORTS[0].fair_odds_home,
                      edge_pct: MOCK_SPORTS[0].edge_home_pct,
                    },
                    true
                  );
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1 cursor-pointer shadow-sm"
              >
                <Plus size={14} />
                <span>Back {MOCK_SPORTS[0].home_team} ($20)</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
