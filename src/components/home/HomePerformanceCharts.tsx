import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  BarChart2,
  Calendar,
  Layers,
  Award,
  Sparkles,
  Info,
  ChevronRight,
  Wallet,
  DollarSign,
  Target,
} from "lucide-react";
import type { PaperBetItem } from "../../types";

interface HomePerformanceChartsProps {
  settledBets: PaperBetItem[];
  onNavigateToLedger?: () => void;
}

const BET_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  win: {
    label: "Win",
    color: "#10b981", // emerald
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  "each-way": {
    label: "Each-Way",
    color: "#06b6d4", // cyan
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
  },
  h2h: {
    label: "H2H",
    color: "#6366f1", // indigo
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
  },
  multi: {
    label: "Multi",
    color: "#f59e0b", // amber
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  prop: {
    label: "Player Prop",
    color: "#a855f7", // purple
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
  },
  place: {
    label: "Place",
    color: "#3b82f6", // blue
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
};

const SPORT_CONFIG: Record<string, { label: string; color: string }> = {
  racing: { label: "Racing", color: "#f97316" }, // orange
  nba: { label: "NBA", color: "#3b82f6" }, // blue
  afl: { label: "AFL", color: "#10b981" }, // emerald
  nrl: { label: "NRL", color: "#6366f1" }, // indigo
  soccer: { label: "Soccer", color: "#06b6d4" }, // cyan
  golf: { label: "Golf", color: "#84cc16" }, // lime
  mma: { label: "MMA", color: "#ec4899" }, // pink
};

export const HomePerformanceCharts: React.FC<HomePerformanceChartsProps> = ({
  settledBets,
  onNavigateToLedger,
}) => {
  const [trendMode, setTrendMode] = useState<"cumulative" | "daily">("cumulative");
  const [activeDoughnutIndex, setActiveDoughnutIndex] = useState<number | null>(null);
  const [allocationMode, setAllocationMode] = useState<"betType" | "sport">("betType");

  // 1. Generate 30-day timeline series
  const trendData = useMemo(() => {
    const days = 30;
    const result = [];
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    let runningCumulative = 0;

    for (let i = days - 1; i >= 0; i--) {
      const targetDate = new Date(now.getTime() - i * dayMs);
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, "0");
      const day = String(targetDate.getDate()).padStart(2, "0");
      const dateKey = `${year}-${month}-${day}`;

      const label = targetDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      // Filter bets settled on this calendar day
      const dayBets = settledBets.filter((bet) => {
        if (!bet.settled_at) return false;
        return bet.settled_at.startsWith(dateKey);
      });

      let dailyProfit = 0;
      let wonCount = 0;

      dayBets.forEach((b) => {
        const net = (b.payout || 0) - b.stake;
        dailyProfit += net;
        if (b.status === "won") wonCount++;
      });

      runningCumulative += dailyProfit;

      result.push({
        date: label,
        fullDate: dateKey,
        dailyPL: Number(dailyProfit.toFixed(2)),
        cumulativePL: Number(runningCumulative.toFixed(2)),
        betsCount: dayBets.length,
        wonCount,
      });
    }

    return result;
  }, [settledBets]);

  // 2. Compute Bet Type Breakdown for Doughnut Chart
  const betTypeStats = useMemo(() => {
    const statsMap: Record<
      string,
      {
        typeKey: string;
        label: string;
        total: number;
        won: number;
        lost: number;
        staked: number;
        payout: number;
        netProfit: number;
        color: string;
      }
    > = {};

    settledBets.forEach((bet) => {
      let key = bet.bet_type || "win";
      if (bet.event_id === "multi" || bet.selection.toLowerCase().includes("multi")) {
        key = "multi";
      }

      if (!statsMap[key]) {
        const config = BET_TYPE_CONFIG[key] || {
          label: key.toUpperCase(),
          color: "#94a3b8",
        };
        statsMap[key] = {
          typeKey: key,
          label: config.label,
          total: 0,
          won: 0,
          lost: 0,
          staked: 0,
          payout: 0,
          netProfit: 0,
          color: config.color,
        };
      }

      statsMap[key].total += 1;
      statsMap[key].staked += bet.stake || 0;
      statsMap[key].payout += bet.payout || 0;
      statsMap[key].netProfit += (bet.payout || 0) - (bet.stake || 0);

      if (bet.status === "won") {
        statsMap[key].won += 1;
      } else if (bet.status === "lost") {
        statsMap[key].lost += 1;
      }
    });

    return Object.values(statsMap).map((item) => ({
      ...item,
      winRate: item.total > 0 ? Number(((item.won / item.total) * 100).toFixed(1)) : 0,
      netProfit: Number(item.netProfit.toFixed(2)),
    }));
  }, [settledBets]);

  // 3. Compute Stake Distribution for Recharts Bar Chart
  const totalStakedBudget = useMemo(() => {
    return settledBets.reduce((acc, b) => acc + (b.stake || 0), 0);
  }, [settledBets]);

  const stakeDistributionData = useMemo(() => {
    if (allocationMode === "betType") {
      // Group by bet category
      const map: Record<
        string,
        { category: string; totalStake: number; betsCount: number; color: string; netProfit: number }
      > = {};

      settledBets.forEach((bet) => {
        let key = bet.bet_type || "win";
        if (bet.event_id === "multi" || bet.selection.toLowerCase().includes("multi")) {
          key = "multi";
        }
        const cfg = BET_TYPE_CONFIG[key] || { label: key.toUpperCase(), color: "#94a3b8" };

        if (!map[key]) {
          map[key] = {
            category: cfg.label,
            totalStake: 0,
            betsCount: 0,
            color: cfg.color,
            netProfit: 0,
          };
        }
        map[key].totalStake += bet.stake || 0;
        map[key].betsCount += 1;
        map[key].netProfit += (bet.payout || 0) - (bet.stake || 0);
      });

      return Object.values(map)
        .map((item) => ({
          ...item,
          totalStake: Number(item.totalStake.toFixed(2)),
          avgStake: item.betsCount > 0 ? Number((item.totalStake / item.betsCount).toFixed(1)) : 0,
          percentage:
            totalStakedBudget > 0 ? Number(((item.totalStake / totalStakedBudget) * 100).toFixed(1)) : 0,
          netProfit: Number(item.netProfit.toFixed(2)),
        }))
        .sort((a, b) => b.totalStake - a.totalStake);
    } else {
      // Group by sport discipline
      const map: Record<
        string,
        { category: string; totalStake: number; betsCount: number; color: string; netProfit: number }
      > = {};

      settledBets.forEach((bet) => {
        const sportKey = bet.sport || "racing";
        const cfg = SPORT_CONFIG[sportKey] || { label: sportKey.toUpperCase(), color: "#38bdf8" };

        if (!map[sportKey]) {
          map[sportKey] = {
            category: cfg.label,
            totalStake: 0,
            betsCount: 0,
            color: cfg.color,
            netProfit: 0,
          };
        }
        map[sportKey].totalStake += bet.stake || 0;
        map[sportKey].betsCount += 1;
        map[sportKey].netProfit += (bet.payout || 0) - (bet.stake || 0);
      });

      return Object.values(map)
        .map((item) => ({
          ...item,
          totalStake: Number(item.totalStake.toFixed(2)),
          avgStake: item.betsCount > 0 ? Number((item.totalStake / item.betsCount).toFixed(1)) : 0,
          percentage:
            totalStakedBudget > 0 ? Number(((item.totalStake / totalStakedBudget) * 100).toFixed(1)) : 0,
          netProfit: Number(item.netProfit.toFixed(2)),
        }))
        .sort((a, b) => b.totalStake - a.totalStake);
    }
  }, [settledBets, allocationMode, totalStakedBudget]);

  const totalSettled = settledBets.length;
  const overallWon = settledBets.filter((b) => b.status === "won").length;
  const overallWinRate = totalSettled > 0 ? (overallWon / totalSettled) * 100 : 0;

  const activeTypeStat =
    activeDoughnutIndex !== null && betTypeStats[activeDoughnutIndex]
      ? betTypeStats[activeDoughnutIndex]
      : null;

  const currentCumPL = trendData.length > 0 ? trendData[trendData.length - 1].cumulativePL : 0;
  const isTrendPositive = currentCumPL >= 0;

  return (
    <div className="space-y-5">
      {/* ROW 1: 30-DAY DAILY P/L TREND & DOUGHNUT WIN RATES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 1. 30-DAY DAILY P/L TREND LINE/AREA CHART (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <TrendingUp size={16} />
                </div>
                <h3 className="text-base font-black text-white tracking-tight">
                  30-Day Paper P/L Trajectory
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {trendMode === "cumulative"
                  ? "Cumulative profit / loss trajectory over the past 30 days"
                  : "Daily settled return variance over the past 30 days"}
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl sm:rounded-2xl shadow-inner self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTrendMode("cumulative")}
                className={`px-3.5 py-1.5 rounded-lg sm:rounded-xl text-xs font-black tracking-tight whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  trendMode === "cumulative"
                    ? "bg-emerald-500 text-slate-950 shadow-md ring-1 ring-emerald-300/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                Cumulative
              </button>
              <button
                type="button"
                onClick={() => setTrendMode("daily")}
                className={`px-3.5 py-1.5 rounded-lg sm:rounded-xl text-xs font-black tracking-tight whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  trendMode === "daily"
                    ? "bg-emerald-500 text-slate-950 shadow-md ring-1 ring-emerald-300/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                Daily Net
              </button>
            </div>
          </div>

          {/* Chart Header Stats */}
          <div className="flex items-baseline gap-3 mb-4 pb-3 border-b border-slate-800/80">
            <span
              className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                isTrendPositive ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {isTrendPositive ? `+$${currentCumPL.toFixed(2)}` : `-$${Math.abs(currentCumPL).toFixed(2)}`}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              30-day paper net yield
            </span>
            <span className="ml-auto text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <Calendar size={12} className="text-slate-500" />
              Last 30 Days
            </span>
          </div>

          {/* Recharts Line/Area Container */}
          <div className="w-full h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isTrendPositive ? "#10b981" : "#f43f5e"} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={isTrendPositive ? "#10b981" : "#f43f5e"} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#334155" }}
                  interval={4}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const isPos = data.cumulativePL >= 0;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl text-xs space-y-1.5">
                          <div className="font-bold text-slate-300 border-b border-slate-800 pb-1 flex justify-between items-center gap-4">
                            <span>{data.date}</span>
                            <span className="text-[10px] text-slate-400">{data.fullDate}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Cumulative P/L:</span>
                            <span className={`font-mono font-bold ${isPos ? "text-emerald-400" : "text-rose-400"}`}>
                              {data.cumulativePL >= 0 ? `+$${data.cumulativePL.toFixed(2)}` : `-$${Math.abs(data.cumulativePL).toFixed(2)}`}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Daily Return:</span>
                            <span className={`font-mono font-bold ${data.dailyPL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {data.dailyPL >= 0 ? `+$${data.dailyPL.toFixed(2)}` : `-$${Math.abs(data.dailyPL).toFixed(2)}`}
                            </span>
                          </div>
                          {data.betsCount > 0 && (
                            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                              {data.betsCount} {data.betsCount === 1 ? "bet" : "bets"} settled ({data.wonCount} won)
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" opacity={0.6} />
                <Area
                  type="monotone"
                  dataKey={trendMode === "cumulative" ? "cumulativePL" : "dailyPL"}
                  stroke={isTrendPositive ? "#10b981" : "#f43f5e"}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#trendGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#38bdf8", stroke: "#0f172a", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. DOUGHNUT CHART - WIN RATES BY BET TYPE (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <PieIcon size={16} />
              </div>
              <div>
                <h3 className="text-base font-black text-white tracking-tight">
                  Win Rate by Bet Type
                </h3>
                <p className="text-[11px] text-slate-400">
                  Segmented strike rate by wager category
                </p>
              </div>
            </div>
            {onNavigateToLedger && (
              <button
                type="button"
                onClick={onNavigateToLedger}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer"
              >
                <span>Ledger</span>
                <ChevronRight size={13} />
              </button>
            )}
          </div>

          {betTypeStats.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No settled bet categories to display yet.
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Doughnut Chart with interactive center label */}
              <div className="relative h-44 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={betTypeStats}
                      dataKey="total"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={68}
                      paddingAngle={4}
                      onMouseEnter={(_, index) => setActiveDoughnutIndex(index)}
                      onMouseLeave={() => setActiveDoughnutIndex(null)}
                    >
                      {betTypeStats.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke="#0f172a"
                          strokeWidth={2}
                          className="transition-transform duration-200 cursor-pointer hover:opacity-80"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                              <div className="flex items-center gap-1.5 font-black text-white">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                                <span>{d.label}</span>
                              </div>
                              <div className="text-slate-300">
                                Win Rate: <strong className="text-emerald-400">{d.winRate}%</strong> ({d.won}/{d.total})
                              </div>
                              <div className="text-slate-400">
                                Net Profit:{" "}
                                <strong className={d.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                                  {d.netProfit >= 0 ? `+$${d.netProfit}` : `-$${Math.abs(d.netProfit)}`}
                                </strong>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Central stat readout inside doughnut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">
                    {activeTypeStat ? activeTypeStat.label : "Total Strike"}
                  </span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-white">
                    {activeTypeStat ? `${activeTypeStat.winRate}%` : `${overallWinRate.toFixed(1)}%`}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {activeTypeStat
                      ? `${activeTypeStat.won}W - ${activeTypeStat.lost}L`
                      : `${overallWon} of ${totalSettled} won`}
                  </span>
                </div>
              </div>

              {/* Bet Type Legend & Micro Breakdown Grid */}
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {betTypeStats.map((type, idx) => {
                  const isActive = activeDoughnutIndex === idx;
                  const isProfit = type.netProfit >= 0;
                  return (
                    <div
                      key={type.typeKey}
                      onMouseEnter={() => setActiveDoughnutIndex(idx)}
                      onMouseLeave={() => setActiveDoughnutIndex(null)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        isActive
                          ? "bg-slate-900 border-slate-600 scale-[1.02]"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: type.color }}
                          />
                          <span className="text-xs font-bold text-white truncate">
                            {type.label}
                          </span>
                        </div>
                        <span className="text-xs font-black font-mono text-emerald-400">
                          {type.winRate}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span>
                          {type.won}W - {type.lost}L ({type.total})
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            isProfit ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isProfit ? `+$${type.netProfit}` : `-$${Math.abs(type.netProfit)}`}
                        </span>
                      </div>

                      {/* Mini win rate bar */}
                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${type.winRate}%`,
                            backgroundColor: type.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROW 2: STAKE DISTRIBUTION ACROSS CATEGORIES BAR CHART */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <BarChart2 size={16} />
              </div>
              <h3 className="text-base font-black text-white tracking-tight">
                Stake Budget Allocation &amp; Habit Distribution
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Visualize how your paper bankroll stakes are allocated across {allocationMode === "betType" ? "betting categories" : "sport disciplines"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl sm:rounded-2xl shadow-inner">
              <button
                type="button"
                onClick={() => setAllocationMode("betType")}
                className={`px-3.5 sm:px-4 py-1.5 rounded-lg sm:rounded-xl text-xs font-black tracking-tight whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  allocationMode === "betType"
                    ? "bg-amber-500 text-slate-950 shadow-md ring-1 ring-amber-300/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                By Bet Type
              </button>
              <button
                type="button"
                onClick={() => setAllocationMode("sport")}
                className={`px-3.5 sm:px-4 py-1.5 rounded-lg sm:rounded-xl text-xs font-black tracking-tight whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  allocationMode === "sport"
                    ? "bg-amber-500 text-slate-950 shadow-md ring-1 ring-amber-300/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                By Sport
              </button>
            </div>
          </div>
        </div>

        {/* Bar Chart Body */}
        {stakeDistributionData.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No stake history available yet.
          </div>
        ) : (
          <div className="space-y-5 pt-4">
            {/* Top Stake Metrics summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Staked
                </span>
                <span className="text-lg font-black font-mono text-white">
                  ${totalStakedBudget.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500 block">Across {totalSettled} bets</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Top Allocation
                </span>
                <span className="text-lg font-black font-mono text-amber-400 truncate block">
                  {stakeDistributionData[0]?.category || "N/A"}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {stakeDistributionData[0]?.percentage || 0}% of budget
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Avg Stake / Bet
                </span>
                <span className="text-lg font-black font-mono text-cyan-400">
                  ${totalSettled > 0 ? (totalStakedBudget / totalSettled).toFixed(1) : "0"}
                </span>
                <span className="text-[10px] text-slate-500 block">Per wager placed</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Categories Active
                </span>
                <span className="text-lg font-black font-mono text-emerald-400">
                  {stakeDistributionData.length}
                </span>
                <span className="text-[10px] text-slate-500 block">Diversified exposure</span>
              </div>
            </div>

            {/* Recharts Bar Chart */}
            <div className="w-full h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stakeDistributionData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                  <XAxis
                    dataKey="category"
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: "#334155" }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl text-xs space-y-1.5">
                            <div className="flex items-center gap-2 font-black text-white border-b border-slate-800 pb-1">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                              <span>{d.category}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-slate-300">
                              <span>Total Staked:</span>
                              <strong className="font-mono text-amber-400">${d.totalStake}</strong>
                            </div>
                            <div className="flex justify-between gap-4 text-slate-400">
                              <span>Share of Budget:</span>
                              <strong className="font-mono text-white">{d.percentage}%</strong>
                            </div>
                            <div className="flex justify-between gap-4 text-slate-400">
                              <span>Wagers:</span>
                              <strong className="text-slate-300">{d.betsCount} bets</strong>
                            </div>
                            <div className="flex justify-between gap-4 text-slate-400">
                              <span>Avg Stake:</span>
                              <strong className="font-mono text-cyan-400">${d.avgStake}</strong>
                            </div>
                            <div className="flex justify-between gap-4 text-slate-400 pt-1 border-t border-slate-800">
                              <span>Category P/L:</span>
                              <strong className={`font-mono ${d.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {d.netProfit >= 0 ? `+$${d.netProfit}` : `-$${Math.abs(d.netProfit)}`}
                              </strong>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="totalStake" radius={[8, 8, 0, 0]} maxBarSize={56}>
                    {stakeDistributionData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.color} className="transition-all hover:opacity-85" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category Cards breakdown bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2">
              {stakeDistributionData.map((item) => (
                <div
                  key={item.category}
                  className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-bold text-white truncate">{item.category}</span>
                    </div>
                    <span className="text-xs font-black font-mono text-amber-400">
                      ${item.totalStake}
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{item.percentage}% budget</span>
                    <span>{item.betsCount} bets</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
