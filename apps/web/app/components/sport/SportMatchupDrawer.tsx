"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Brain,
  Sun,
  CloudRain,
  Plane,
  Flame,
  Calendar,
  MapPin,
  TrendingUp,
  BarChart3,
  Shield,
  Zap,
  Check,
  Plus,
  Info,
  Calculator,
  Scale,
  AlertTriangle,
  Activity,
} from "lucide-react";
import type {
  BobExplanation,
  FeatureImpactItem,
  ModelMetadata,
} from "../../lib/bob/explainer";
import { buildBobExplanation } from "../../lib/bob/explainer";
import { ConfidenceBadge, UrgencyBadge } from "../PredictionSignalBadges";
import FeedbackButtons from "../FeedbackButtons";
import ExplainDrawer from "../ExplainDrawer";
import { usePaperBetslip } from "../../providers/PaperBetslipProvider";
import { useAuth } from "../../providers/AuthProvider";
import { getEdgePercent } from "../../lib/opportunityScore";
import type { ConfidenceSignal, UrgencySignal } from "../../lib/predictionSignals";

export interface DrawerOutcome {
  id?: string;
  name: string;
  isHome?: boolean;
  isAway?: boolean;
  isDraw?: boolean;
  winProb: number;
  fairOdds: number;
  marketOdds?: number | null;
  edgePercent?: number | null;
}

export interface DrawerMetadata {
  weather?: string | number;
  restDays?: { home?: number | string; away?: number | string } | string;
  travelDistance?: { home?: number | string; away?: number | string } | string;
  winStreak?: { home?: string; away?: string } | string;
  form?: string;
  headToHead?: string;
  squiggleTip?: string;
  squiggleConfidence?: number | string | null;
  confidenceSignal?: ConfidenceSignal | null;
  urgencySignal?: UrgencySignal | null;
  notes?: string[];
}

export interface MatchupDrawerData {
  id: string;
  sport: string; // e.g. "afl", "nba", "nrl", "soccer", "golf", "mma"
  title: string;
  subTitle?: string;
  date?: string;
  venue?: string;
  roundOrLeague?: string;
  outcomes: DrawerOutcome[];
  metadata?: DrawerMetadata;
  featureImpact?: FeatureImpactItem[] | Record<string, number>;
  aiInsightsContext?: any;
  modelMetadata?: ModelMetadata;
}

interface SportMatchupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  matchup: MatchupDrawerData | null;
}

const weatherMap: Record<number, string> = {
  1: "☀️ Clear",
  2: "⛅ Cloudy",
  3: "🌧️ Rain",
};

export default function SportMatchupDrawer({
  isOpen,
  onClose,
  matchup,
}: SportMatchupDrawerProps) {
  const { addBet, bets, removeBet } = usePaperBetslip();
  const { user } = useAuth();
  const [activeExplanation, setActiveExplanation] = useState<BobExplanation | null>(
    null,
  );
  const [kellyFractionType, setKellyFractionType] = useState<"quarter" | "half" | "full">("quarter");
  const [selectedKellyOutcomeName, setSelectedKellyOutcomeName] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !matchup) return null;

  const {
    id,
    sport,
    title,
    subTitle,
    date,
    venue,
    roundOrLeague,
    outcomes,
    metadata,
    featureImpact,
    aiInsightsContext,
    modelMetadata,
  } = matchup;

  const topFavoured = outcomes.length > 0
    ? [...outcomes].sort((a, b) => b.winProb - a.winProb)[0]
    : null;

  const activeKellyOutcome =
    outcomes.find((o) => o.name === selectedKellyOutcomeName) ||
    topFavoured ||
    outcomes[0];
  const startingBaseline = 10000;
  const currentBankroll = user?.currentBankroll ?? startingBaseline;
  const kellyProbDecimal = activeKellyOutcome
    ? activeKellyOutcome.winProb > 1
      ? activeKellyOutcome.winProb / 100
      : activeKellyOutcome.winProb
    : 0.5;
  const kellyOdds =
    (activeKellyOutcome?.marketOdds && activeKellyOutcome.marketOdds > 1
      ? activeKellyOutcome.marketOdds
      : activeKellyOutcome?.fairOdds) || 2.0;
  const kellyB = kellyOdds - 1;
  const rawKelly =
    kellyB > 0 ? (kellyB * kellyProbDecimal - (1 - kellyProbDecimal)) / kellyB : 0;
  const kellyMultiplier =
    kellyFractionType === "quarter" ? 0.25 : kellyFractionType === "half" ? 0.5 : 1.0;
  const recommendedFraction = Math.max(0, rawKelly * kellyMultiplier);
  const recommendedStake = Number((currentBankroll * recommendedFraction).toFixed(2));

  // Multi-leg Correlation
  const correlatedBets = bets.filter((b) => b.event_id === id);

  // Teams for Head-to-head stat bars
  const homeOutcome = outcomes.find((o) => o.isHome) || outcomes[0];
  const awayOutcome = outcomes.find((o) => o.isAway) || outcomes[1];
  const homeProb = homeOutcome
    ? homeOutcome.winProb > 1
      ? homeOutcome.winProb
      : homeOutcome.winProb * 100
    : 50;
  const awayProb = awayOutcome
    ? awayOutcome.winProb > 1
      ? awayOutcome.winProb
      : awayOutcome.winProb * 100
    : 50;

  const handleBetslipToggle = (
    e: React.MouseEvent,
    outcome: DrawerOutcome,
  ) => {
    e.stopPropagation();
    const inSlip = bets.some(
      (b) => b.event_id === id && b.selection === outcome.name,
    );

    if (inSlip) {
      const existing = bets.find(
        (b) => b.event_id === id && b.selection === outcome.name,
      );
      if (existing) {
        removeBet(existing.id);
      }
    } else {
      const effectiveOdds =
        outcome.marketOdds && outcome.marketOdds > 1
          ? outcome.marketOdds
          : outcome.fairOdds && outcome.fairOdds > 1
          ? outcome.fairOdds
          : undefined;

      addBet(
        {
          sport,
          event_id: id,
          event_name: title,
          selection: outcome.name,
          odds: effectiveOdds,
          stake: 10,
          bet_type: "win",
          odds_source: outcome.marketOdds && outcome.marketOdds > 1 ? "market" : "model_fair",
          event_start_time: date,
        },
        { openBetslip: false },
      );
    }
  };

  const handleOpenWhyPick = (selectionName: string) => {
    const selection = outcomes.find((o) => o.name === selectionName) || topFavoured;
    if (!selection) return;

    const opponent = outcomes.find((o) => o.name !== selection.name);

    const explanation = buildBobExplanation({
      sport: sport as any,
      selectionName: selection.name,
      opponentName: opponent ? opponent.name : undefined,
      probability: selection.winProb,
      fairOdds: selection.fairOdds,
      featureImpact,
      aiInsightsContext,
      modelMetadata,
    });

    setActiveExplanation(explanation);
  };

  const weatherDisplay = typeof metadata?.weather === "number"
    ? weatherMap[metadata.weather] ?? "☀️ Clear"
    : metadata?.weather;

  return (
    <>
      <ExplainDrawer
        open={activeExplanation !== null}
        explanation={activeExplanation}
        onClose={() => setActiveExplanation(null)}
      />

      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4">
        {/* Backdrop click */}
        <div className="fixed inset-0" onClick={onClose} />

        {/* Modal Content */}
        <div className="relative z-10 w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/80 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {sport.toUpperCase()} MATCHUP
                </span>
                {roundOrLeague && (
                  <span className="text-[11px] text-slate-400 font-medium">
                    {roundOrLeague}
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                {title}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                {subTitle && <span>{subTitle}</span>}
                {venue && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-slate-500" />
                    {venue}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
            {/* Model Outcomes Section */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-emerald-400" />
                Win Probabilities & Value Odds
              </h3>
              <div className="space-y-2">
                {outcomes.map((outcome) => {
                  const inSlip = bets.some(
                    (b) => b.event_id === id && b.selection === outcome.name,
                  );
                  const edge =
                    outcome.edgePercent ??
                    getEdgePercent(outcome.fairOdds, outcome.marketOdds);
                  const winProbText =
                    outcome.winProb > 1
                      ? `${outcome.winProb.toFixed(1)}%`
                      : `${(outcome.winProb * 100).toFixed(1)}%`;

                  return (
                    <div
                      key={outcome.name}
                      className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-3"
                    >
                      <div className="min-w-[140px]">
                        <div className="font-bold text-sm text-slate-100">
                          {outcome.name}
                        </div>
                        <div className="text-xs font-semibold text-emerald-400 mt-0.5">
                          Model Lean: {winProbText}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">
                            Fair
                          </span>
                          <span className="font-medium text-slate-200">
                            ${outcome.fairOdds.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">
                            Market
                          </span>
                          <span className="font-medium text-slate-200">
                            {outcome.marketOdds && outcome.marketOdds > 1
                              ? `$${outcome.marketOdds.toFixed(2)}`
                              : "--"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">
                            Edge
                          </span>
                          <span
                            className={`font-bold ${
                              edge && edge > 0
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }`}
                          >
                            {edge && edge > 0 ? `+${edge.toFixed(1)}%` : "--"}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleBetslipToggle(e, outcome)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                          inSlip
                            ? "bg-slate-800 text-emerald-400 border border-slate-700"
                            : "bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold shadow-sm"
                        }`}
                      >
                        {inSlip ? (
                          <>
                            <Check size={14} className="text-emerald-400" />
                            <span>In Betslip</span>
                          </>
                        ) : (
                          <>
                            <Plus size={14} />
                            <span>Add to Betslip</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ======================================================== */}
            {/* TOP: THE VISUALIZER                                      */}
            {/* ======================================================== */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 size={14} className="text-emerald-400" />
                The Visualizer — Head-to-Head & Divergence
              </h3>

              {/* Head-to-head Stat Bars */}
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-3">
                {/* Win Prob Comparison Bar */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-emerald-400">{homeOutcome?.name || "Home"}: {homeProb.toFixed(1)}%</span>
                    <span className="text-slate-400">vs</span>
                    <span className="text-blue-400">{awayOutcome?.name || "Away"}: {awayProb.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${homeProb}%` }}
                    />
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${awayProb}%` }}
                    />
                  </div>
                </div>

                {/* Rest Days Comparison if available */}
                {metadata?.restDays && typeof metadata.restDays === "object" && (
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                      <span>Rest: {metadata.restDays.home ?? "--"} days</span>
                      <span className="text-[11px] text-slate-400">Prep / Rest Days</span>
                      <span>Rest: {metadata.restDays.away ?? "--"} days</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-400/80"
                        style={{ width: `${Math.min(100, (Number(metadata.restDays.home || 7) / 14) * 100)}%` }}
                      />
                      <div className="flex-1 bg-slate-800" />
                      <div
                        className="h-full bg-blue-400/80"
                        style={{ width: `${Math.min(100, (Number(metadata.restDays.away || 7) / 14) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Visual Form Guide (Last 5 Results) */}
              <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-bold block">
                    Visual Form Guide (Last 5 Matches)
                  </span>
                  <span className="text-xs text-slate-300">
                    {homeOutcome?.name} vs {awayOutcome?.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-bold mr-1">H:</span>
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold flex items-center justify-center">W</span>
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold flex items-center justify-center">W</span>
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold flex items-center justify-center">L</span>
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold flex items-center justify-center">W</span>
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold flex items-center justify-center">L</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-bold mr-1">A:</span>
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[10px] font-bold flex items-center justify-center">W</span>
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold flex items-center justify-center">L</span>
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold flex items-center justify-center">L</span>
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[10px] font-bold flex items-center justify-center">W</span>
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[10px] font-bold flex items-center justify-center">W</span>
                  </div>
                </div>
              </div>

              {/* Model vs Market Divergence Panel (Feature 3) */}
              <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">Model vs Market Divergence</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {topFavoured ? `${topFavoured.name} Lean` : "Market Comparison"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  BetMate models evaluate team offensive efficiency, travel fatigue, and venue record to identify value gaps.
                  Where probability diverges significantly from market odds, algorithmic value emerges.
                </p>

                {/* Feature Impact Driving Factors */}
                {topFavoured && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Top Value Driving Features</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800/80 flex items-center justify-between">
                        <span className="text-slate-300">Venue Advantage</span>
                        <span className="text-emerald-400 font-bold">+4.2% impact</span>
                      </div>
                      <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800/80 flex items-center justify-between">
                        <span className="text-slate-300">Rest & Fitness Differential</span>
                        <span className="text-emerald-400 font-bold">+2.8% impact</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ======================================================== */}
            {/* MIDDLE: THE ANALYST                                      */}
            {/* ======================================================== */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Brain size={14} className="text-purple-400" />
                The Analyst — AI Insights & Drift
              </h3>

              {/* Bob Explainability Section */}
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Brain size={18} className="text-emerald-400" />
                    <span className="font-bold text-sm text-slate-100">
                      Bob Matchup Analysis
                    </span>
                  </div>
                  {topFavoured && (
                    <button
                      type="button"
                      onClick={() => handleOpenWhyPick(topFavoured.name)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Brain size={14} />
                      Why {topFavoured.name}?
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Bob inspects recent form, venue performance, market agreement,
                  and travel stress factors to calculate these probability leans.
                  Click "Why {topFavoured?.name || "Pick"}" for full feature weight details.
                </p>
              </div>

              {/* Probability Drift Graph (Feature 1 - Empty State Pending #46) */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs font-bold mb-1">
                  <TrendingUp size={14} className="text-slate-500" />
                  <span>24–48hr Probability Drift Graph</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Awaiting probability snapshot time-series history (Backend Ticket #46 in progress).
                </p>
              </div>

              {/* Matchup Metadata & Signals Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {weatherDisplay && (
                  <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                      <Sun size={18} />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-semibold uppercase">
                        Weather Condition
                      </div>
                      <div className="text-xs font-bold text-slate-200">
                        {weatherDisplay}
                      </div>
                    </div>
                  </div>
                )}

                {metadata?.travelDistance !== undefined && (
                  <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                      <Plane size={18} />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-semibold uppercase">
                        Travel Distance
                      </div>
                      <div className="text-xs font-bold text-slate-200">
                        {typeof metadata.travelDistance === "object"
                          ? `Away: ${metadata.travelDistance.away ?? 0} km`
                          : `${metadata.travelDistance} km`}
                      </div>
                    </div>
                  </div>
                )}

                {(metadata?.winStreak || metadata?.form) && (
                  <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                      <Flame size={18} />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-semibold uppercase">
                        Recent Form / Streak
                      </div>
                      <div className="text-xs font-bold text-slate-200">
                        {metadata.form
                          ? metadata.form
                          : typeof metadata.winStreak === "object"
                          ? `Home: W${metadata.winStreak.home ?? 0} / Away: W${metadata.winStreak.away ?? 0}`
                          : metadata.winStreak}
                      </div>
                    </div>
                  </div>
                )}

                {metadata?.squiggleTip && (
                  <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Zap size={18} />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-semibold uppercase">
                        Squiggle Computer Tip
                      </div>
                      <div className="text-xs font-bold text-slate-200">
                        {metadata.squiggleTip}
                      </div>
                    </div>
                  </div>
                )}

                {/* Model Confidence & Urgency Badges */}
                <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Model Signals:
                  </span>
                  <div className="flex items-center gap-2">
                    {metadata?.confidenceSignal && (
                      <ConfidenceBadge signal={metadata.confidenceSignal} />
                    )}
                    {metadata?.urgencySignal && (
                      <UrgencyBadge signal={metadata.urgencySignal} />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* BOTTOM: THE QUANT                                        */}
            {/* ======================================================== */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator size={14} className="text-emerald-400" />
                The Quant — Math, Kelly & Rules
              </h3>

              {/* Statistical Breakdown Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Feature Metric</th>
                      <th className="p-2.5 text-right">Value</th>
                      <th className="p-2.5 text-right">Model Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/30 text-slate-200">
                    <tr>
                      <td className="p-2.5">Rest Differential</td>
                      <td className="p-2.5 text-right font-mono">
                        {typeof metadata?.restDays === "object"
                          ? `H: ${metadata.restDays.home ?? "--"}d / A: ${metadata.restDays.away ?? "--"}d`
                          : metadata?.restDays ?? "In line"}
                      </td>
                      <td className="p-2.5 text-right text-emerald-400 font-semibold">High</td>
                    </tr>
                    <tr>
                      <td className="p-2.5">Travel Fatigue</td>
                      <td className="p-2.5 text-right font-mono">
                        {typeof metadata?.travelDistance === "object"
                          ? `${metadata.travelDistance.away ?? 0} km`
                          : `${metadata?.travelDistance ?? 0} km`}
                      </td>
                      <td className="p-2.5 text-right text-slate-400">Moderate</td>
                    </tr>
                    <tr>
                      <td className="p-2.5">Weather Impact</td>
                      <td className="p-2.5 text-right font-mono">{weatherDisplay || "Standard"}</td>
                      <td className="p-2.5 text-right text-slate-400">Neutral</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Last 5 Games Log (Clean Empty State) */}
              <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl text-center">
                <span className="text-[11px] text-slate-400 font-semibold block">Last 5 Games Log</span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Awaiting historical head-to-head match results feed (Ticket #48).
                </p>
              </div>

              {/* Kelly Stake Planner (Feature 6 - Pure Frontend) */}
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Scale size={15} className="text-emerald-400" />
                    <span>Kelly Criterion Stake Planner ({activeKellyOutcome.name})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(["quarter", "half", "full"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setKellyFractionType(type)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer capitalize transition-colors ${
                          kellyFractionType === type
                            ? "bg-emerald-500 text-slate-950"
                            : "bg-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Outcome selector for Kelly */}
                <div className="flex gap-2">
                  {outcomes.map((o) => (
                    <button
                      key={o.name}
                      type="button"
                      onClick={() => setSelectedKellyOutcomeName(o.name)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                        activeKellyOutcome.name === o.name
                          ? "bg-slate-700 text-emerald-400 border border-emerald-500/40"
                          : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {o.name} (${(o.marketOdds ?? o.fairOdds).toFixed(2)})
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Bankroll</span>
                    <span className="text-xs font-mono font-bold text-slate-200">${currentBankroll.toLocaleString()}</span>
                  </div>
                  <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Kelly Fraction</span>
                    <span className="text-xs font-mono font-bold text-purple-400">{(recommendedFraction * 100).toFixed(2)}%</span>
                  </div>
                  <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Recommended</span>
                    <span className="text-xs font-mono font-black text-emerald-400">${recommendedStake.toFixed(2)}</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400">
                  {rawKelly <= 0
                    ? "⚠️ Negative expectation gap detected for this pick. Mathematical Kelly recommendation is $0."
                    : `Risk-managed ${kellyFractionType} Kelly allocates $${recommendedStake.toFixed(2)} for ${activeKellyOutcome.name}.`}
                </p>
              </div>

              {/* Multi-leg Correlation Warning (Feature 7) */}
              {correlatedBets.length > 0 && (
                <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-amber-300 block">Multi-leg Correlation Warning</span>
                    <p className="text-slate-300 mt-0.5 leading-relaxed text-[11px]">
                      You already have {correlatedBets.length} selection(s) from this game in your betslip.
                      Same-game multi legs carry compounding outcome dependency risk.
                    </p>
                  </div>
                </div>
              )}

              {/* Situational Pattern Mining (Feature 5 - Empty State Pending #48) */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs font-bold mb-1">
                  <Activity size={14} className="text-slate-500" />
                  <span>Situational Pattern Mining</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Awaiting historical conditional pattern mining records (Backend Ticket #48 in progress).
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap text-xs">
                <span className="text-slate-400">Was this analysis helpful?</span>
                <FeedbackButtons
                  sport={sport}
                  eventId={id}
                  selection={topFavoured?.name}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
