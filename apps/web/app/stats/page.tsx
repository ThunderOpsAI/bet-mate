"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  Zap,
  Target,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayerPropCard,
  PropsFilterBar,
  NoStatsEmptyState,
  PlayerCompareModal,
  type PlayerProp,
  type PropsFilterState,
  type PlayerProfile,
} from "../../components/stats";
import ErrorBoundary from "../components/ErrorBoundary";
import { API_BASE, safeResponseJson } from "../lib/api";

const INITIAL_FILTER: PropsFilterState = {
  sport: "ALL",
  marketType: "ALL",
  minEdge: 0,
  minHitRate: 0,
  searchQuery: "",
};

export default function StatsPropsPage() {
  const [filter, setFilter] = useState<PropsFilterState>(INITIAL_FILTER);
  const [propsList, setPropsList] = useState<PlayerProp[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Player comparison modal state
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [comparePlayerA, setComparePlayerA] = useState<PlayerProfile | null>(null);
  const [comparePlayerB, setComparePlayerB] = useState<PlayerProfile | null>(null);

  const fetchProps = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filter.sport !== "ALL") params.append("sport", filter.sport);
      if (filter.marketType !== "ALL") params.append("marketType", filter.marketType);
      if (filter.minEdge > 0) params.append("minEdge", (filter.minEdge / 100).toString());
      if (filter.minHitRate > 0) params.append("minHitRate", filter.minHitRate.toString());

      const url = `${API_BASE}/stats/props${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Failed to fetch stats feed (HTTP ${res.status})`);
      }

      const json = await safeResponseJson(res);
      if (json && json.status === "ok" && Array.isArray(json.data)) {
        setPropsList(json.data);
      } else if (json && json.status === "empty") {
        setPropsList([]);
      } else {
        setPropsList([]);
      }
    } catch (err: any) {
      console.error("Error fetching prop stats:", err);
      setError(err.message || "Failed to load player prop stats.");
      setPropsList([]);
    } finally {
      setIsLoading(false);
    }
  }, [filter.sport, filter.marketType, filter.minEdge, filter.minHitRate]);

  useEffect(() => {
    fetchProps();
  }, [fetchProps]);

  // Client-side search filtering by player or team name
  const filteredProps = useMemo(() => {
    if (!filter.searchQuery.trim()) return propsList;
    const q = filter.searchQuery.toLowerCase();
    return propsList.filter(
      (p) =>
        p.player?.fullName?.toLowerCase().includes(q) ||
        p.player?.team?.toLowerCase().includes(q) ||
        p.marketType?.toLowerCase().includes(q)
    );
  }, [propsList, filter.searchQuery]);

  const handleOpenCompare = (player: PlayerProfile) => {
    setComparePlayerA(player);
    // Find an alternative player to compare against if available
    const other = propsList.find(
      (p) => p.player && p.player.id !== player.id && p.player.sport === player.sport
    );
    setComparePlayerB(other ? other.player : null);
    setIsCompareOpen(true);
  };

  const handleResetFilters = () => {
    setFilter(INITIAL_FILTER);
  };

  // Quick summary counts
  const highEvCount = useMemo(
    () =>
      propsList.filter(
        (p) => (p.bestOdds?.edgePct ?? 0) >= 0.05 || (p.bestOdds?.edgePct ?? 0) >= 5
      ).length,
    [propsList]
  );

  const highHitRateCount = useMemo(
    () => propsList.filter((p) => (p.hitRate?.hitRate ?? 0) >= 70).length,
    [propsList]
  );

  return (
    <ErrorBoundary sectionName="Player Props & Stats">
      <div className="min-h-screen bg-slate-950 text-slate-100 py-6 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Breadcrumb / Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link
              href="/"
              className="hover:text-cyan-400 transition-colors"
            >
              Home
            </Link>
            <span>/</span>
            <Link
              href="/sport"
              className="hover:text-cyan-400 transition-colors"
            >
              Sports
            </Link>
            <span>/</span>
            <span className="text-cyan-400 font-semibold">Stats & Props</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Link
              href="/stats/custom-query"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 border border-cyan-800/60 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Custom Query Builder</span>
            </Link>

            <Link
              href="/bets/multi-builder"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Multi Builder</span>
            </Link>

            <button
              type="button"
              onClick={fetchProps}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
              />
              <span>Refresh Feed</span>
            </button>
          </div>
        </div>

        {/* Page Title & Highlight Stats */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Player Props & Situational Hit Rates
            </h1>
          </div>
          <p className="text-sm text-slate-400 max-w-2xl">
            Live model-backed player proposition markets, empirical hit rates
            (L5, L10, L20, Season), and positional defensive resistance rankings.
          </p>

          {/* Key Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-5">
            <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Active Prop Markets
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">
                  {propsList.length}
                </span>
                <span className="text-xs text-slate-500">Live feeds</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                High EV Plays (+5%)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {highEvCount}
                </span>
                <span className="text-xs text-emerald-500/80">Edge identified</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                70%+ Hit Rates
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-cyan-300 font-mono">
                  {highHitRateCount}
                </span>
                <span className="text-xs text-cyan-400/80">Strong trends</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mb-8">
          <PropsFilterBar
            filter={filter}
            onChange={setFilter}
            totalCount={filteredProps.length}
            onReset={handleResetFilters}
          />
        </div>

        {/* Props Feed Section */}
        {isLoading ? (
          /* Loading Skeleton Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-slate-900/40 border border-slate-800 p-5 space-y-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-800" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-28 h-4 rounded bg-slate-800" />
                    <div className="w-20 h-3 rounded bg-slate-800/60" />
                  </div>
                </div>
                <div className="w-full h-10 rounded-xl bg-slate-800/50" />
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="h-9 rounded-xl bg-slate-800/70" />
                  <div className="h-9 rounded-xl bg-slate-800/70" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProps.length === 0 ? (
          /* Explicit Empty State (Satisfying Zero Mock Data Rule) */
          <NoStatsEmptyState
            title={
              filter.searchQuery || filter.sport !== "ALL" || filter.marketType !== "ALL"
                ? "No Props Match Your Filter"
                : "No Live Prop Markets Found"
            }
            description={
              filter.searchQuery || filter.sport !== "ALL" || filter.marketType !== "ALL"
                ? "Try lowering your min edge or hit rate filters, or searching for a different player."
                : "Prop markets are published dynamically as bookmakers release lines before tip-off. Check back shortly."
            }
            statusLabel={
              filter.sport !== "ALL" ? `${filter.sport} Prop Feed` : "Live Feed Synced"
            }
            isFiltered={
              filter.sport !== "ALL" ||
              filter.marketType !== "ALL" ||
              filter.minEdge > 0 ||
              filter.minHitRate > 0 ||
              Boolean(filter.searchQuery)
            }
            actionText="Reset All Filters"
            onAction={handleResetFilters}
          />
        ) : (
          /* Props Grid with Framer Motion */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filteredProps.map((prop) => (
              <motion.div
                key={prop.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <PlayerPropCard
                  prop={prop}
                  onCompare={handleOpenCompare}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Player Comparison Modal */}
        <PlayerCompareModal
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
          initialPlayerA={comparePlayerA}
          initialPlayerB={comparePlayerB}
          sport={comparePlayerA?.sport || filter.sport}
        />
      </div>
    </ErrorBoundary>
  );
}
