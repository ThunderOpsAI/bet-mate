"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Zap, Layers, ArrowLeft, CheckCircle2, AlertCircle, Sparkles, BarChart3 } from "lucide-react";
import ErrorBoundary from "../../components/ErrorBoundary";
import HighEVFeedTable from "../../components/multi-builder/HighEVFeedTable";
import MultiLegCard from "../../components/multi-builder/MultiLegCard";
import MultiSummaryPanel from "../../components/multi-builder/MultiSummaryPanel";
import MultiWizardModal from "../../components/multi-builder/MultiWizardModal";
import type { EVLeg, SGMPriceResult, PairwiseWarning } from "../../components/multi-builder/types";
import { useAuth } from "../../providers/AuthProvider";

export default function MultiBuilderPage() {
  const { token, updateBankroll } = useAuth();
  const [feedLegs, setFeedLegs] = useState<EVLeg[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState<boolean>(true);
  const [activeLegs, setActiveLegs] = useState<EVLeg[]>([]);
  const [stake, setStake] = useState<number>(10);
  const [pricing, setPricing] = useState<SGMPriceResult | null>(null);
  const [warnings, setWarnings] = useState<PairwiseWarning[]>([]);
  const [isPlacing, setIsPlacing] = useState<boolean>(false);
  const [betResult, setBetResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);

  // Fetch top 10 High EV feed
  const fetchEVFeed = useCallback(async () => {
    setIsLoadingFeed(true);
    try {
      const res = await fetch("/api/ev-feed/today");
      if (res.ok) {
        const data = await res.json();
        const legs: EVLeg[] = Array.isArray(data)
          ? data
          : data.feed && Array.isArray(data.feed)
          ? data.feed
          : [];
        setFeedLegs(legs);
      } else {
        setFeedLegs([]);
      }
    } catch (err) {
      console.error("Failed to fetch EV feed:", err);
      setFeedLegs([]);
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    fetchEVFeed();
  }, [fetchEVFeed]);

  // Price the multi using Gaussian Copula when activeLegs change
  useEffect(() => {
    if (activeLegs.length < 2) {
      setPricing(null);
      setWarnings([]);
      return;
    }

    let isMounted = true;
    const calculatePricing = async () => {
      try {
        const sport = activeLegs[0]?.sport?.toLowerCase() || "nba";
        const res = await fetch("/api/bets/multi/price", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            sport,
            legs: activeLegs.map((l) => ({
              market_type: l.marketType || l.market_type || "player_prop",
              selection: l.legDescription || l.leg_description,
              leg_description: l.legDescription || l.leg_description,
              odds: l.bestOdds ?? l.best_odds ?? 1.90,
              true_prob: l.trueProb ?? l.true_prob,
              probability: l.trueProb ?? l.true_prob,
            })),
          }),
        });

        if (res.ok) {
          const data: SGMPriceResult = await res.json();
          if (isMounted) {
            setPricing(data);
            setWarnings(data.warnings || []);
          }
        } else {
          // Client-side local calculation fallback if backend route is unavailable
          computeLocalPricing();
        }
      } catch (err) {
        console.warn("Pricing route error, falling back to local Copula approximation:", err);
        computeLocalPricing();
      }
    };

    const computeLocalPricing = () => {
      if (!isMounted) return;
      const combinedOdds = activeLegs.reduce(
        (acc, l) => acc * (l.bestOdds ?? l.best_odds ?? 1.90),
        1
      );
      const fairProb = activeLegs.reduce(
        (acc, l) => acc * (l.trueProb ?? l.true_prob ?? 0.5),
        1
      );
      // Fallback haircut 15%
      const haircut = 0.15;
      const adjProb = fairProb * (1 - haircut);
      const combinedEdgePct = ((adjProb * combinedOdds) - 1.0) * 100.0;
      const ev10 = (10.0 * combinedOdds * adjProb) - 10.0;

      setPricing({
        fair_probability: fairProb,
        fair_odds: fairProb > 0 ? 1 / fairProb : 0,
        adjusted_probability: adjProb,
        adjusted_odds: adjProb > 0 ? 1 / adjProb : 0,
        correlation_haircut: haircut,
        combined_odds: Math.round(combinedOdds * 100) / 100,
        combined_edge_pct: Math.round(combinedEdgePct * 10) / 10,
        expected_value_10: Math.round(ev10 * 100) / 100,
        warnings: [],
        max_rho: 0.10,
      });
    };

    calculatePricing();
    return () => {
      isMounted = false;
    };
  }, [activeLegs, token]);

  const handleAddLeg = (leg: EVLeg) => {
    if (!activeLegs.some((l) => l.id === leg.id)) {
      setActiveLegs((prev) => [...prev, leg]);
      setBetResult(null);
    }
  };

  const handleRemoveLeg = (id: string) => {
    setActiveLegs((prev) => prev.filter((l) => l.id !== id));
    setBetResult(null);
  };

  const handleClearMulti = () => {
    setActiveLegs([]);
    setPricing(null);
    setWarnings([]);
    setBetResult(null);
  };

  const handlePlaceBet = async () => {
    if (activeLegs.length < 2) return;
    setIsPlacing(true);
    setBetResult(null);

    try {
      const isSameGame =
        activeLegs.every(
          (l) =>
            l.sport === activeLegs[0].sport &&
            (l.gameContext || l.game_context) === (activeLegs[0].gameContext || activeLegs[0].game_context)
        );

      const payload = {
        multiType: isSameGame ? "SGM" : "MULTI",
        eventType: "multi",
        eventId: activeLegs[0].id || "multi",
        eventName: `${activeLegs.map((l) => l.sport.toUpperCase()).join(" / ")} Stat Multi`,
        stake,
        fairOdds: pricing?.fair_odds,
        adjustedOdds: pricing?.adjusted_odds ?? pricing?.combined_odds,
        adjustedProbability: pricing?.adjusted_probability,
        correlationHaircut: pricing?.correlation_haircut,
        edgePct: pricing?.combined_edge_pct,
        legs: activeLegs.map((l) => ({
          sport: l.sport,
          gameContext: l.gameContext || l.game_context,
          marketType: l.marketType || l.market_type || "player_prop",
          selectionId: l.id,
          selectionLabel: l.legDescription || l.leg_description,
          odds: l.bestOdds ?? l.best_odds ?? 1.90,
          probability: l.trueProb ?? l.true_prob ?? 0.5,
          correlationGroup: l.correlationGroup || l.correlation_group,
        })),
      };

      const res = await fetch("/api/bets/multi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        updateBankroll(-stake);
        setBetResult({
          type: "success",
          message: `Multi Bet placed successfully! $${stake.toFixed(2)} staked at ${((pricing?.adjusted_odds ?? pricing?.combined_odds) || 1).toFixed(2)} odds.`,
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        setBetResult({
          type: "error",
          message: errorData.error || "Failed to place multi bet. Please verify your bankroll.",
        });
      }
    } catch (err: any) {
      setBetResult({
        type: "error",
        message: err.message || "Failed to place bet. Please try again.",
      });
    } finally {
      setIsPlacing(false);
    }
  };

  return (
    <ErrorBoundary sectionName="MultiBuilder">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl animate-in fade-in duration-200">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-200 transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href="/high-ev" className="hover:text-slate-200 transition-colors">
            High EV
          </Link>
          <span>/</span>
          <span className="text-white font-medium">Multi Builder</span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  NFL & NBA Stat Multi Builder
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Day-ahead analytical multi builder powered by XGBoost and Gaussian Copula correlation adjustments.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsWizardOpen(true)}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-900/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>⚡ Guided Multi Wizard</span>
            </button>
            <Link
              href="/stats"
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all flex items-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Props & Hit Rates</span>
            </Link>
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Strictly NBA & NFL (Day-Ahead)
            </span>
          </div>
        </div>

        {/* Bet Result Banner */}
        {betResult && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
              betResult.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            {betResult.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
            )}
            <div className="text-sm">
              <p className="font-bold">{betResult.type === "success" ? "Bet Confirmed" : "Bet Placement Error"}</p>
              <p className="mt-0.5 opacity-90">{betResult.message}</p>
            </div>
          </div>
        )}

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Top 10 High EV Feed (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <HighEVFeedTable
              legs={feedLegs}
              isLoading={isLoadingFeed}
              selectedLegIds={activeLegs.map((l) => l.id)}
              onAddLeg={handleAddLeg}
              onRefresh={fetchEVFeed}
            />

            {/* Ingestion Pipeline Note */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
              <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-yellow-400" /> Scheduled Ingestion Cycle
              </div>
              <p>
                Odds and model probabilities are automatically updated twice daily: at <strong>00:00 AEST (Midnight)</strong> for early lines and <strong>08:00 AEST</strong> for the morning retail prop wave.
              </p>
            </div>
          </div>

          {/* Right Column: Active Legs & Summary Panel (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Active Multi Legs</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {activeLegs.length}
                  </span>
                </h2>
              </div>

              {activeLegs.length === 0 ? (
                <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-8 text-center">
                  <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-300">Your multi is empty</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Select legs from the Top 10 High EV feed on the left to build your accumulator.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeLegs.map((leg, idx) => (
                    <MultiLegCard
                      key={leg.id}
                      leg={leg}
                      index={idx}
                      onRemove={handleRemoveLeg}
                      warnings={warnings}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Multi Summary & Placing Panel */}
            <MultiSummaryPanel
              legCount={activeLegs.length}
              pricing={pricing}
              warnings={warnings}
              stake={stake}
              onStakeChange={setStake}
              onPlaceBet={handlePlaceBet}
              onClearMulti={handleClearMulti}
              isPlacing={isPlacing}
            />
          </div>
        </div>

        {/* Guided Multi Wizard Modal (Item 73) */}
        <MultiWizardModal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onApplyToBuilder={(legs) => setActiveLegs(legs)}
        />
      </div>
    </ErrorBoundary>
  );
}
