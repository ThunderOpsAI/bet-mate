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
  const [activeExplanation, setActiveExplanation] = useState<BobExplanation | null>(
    null,
  );

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

            {/* Matchup Metadata Grid */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BarChart3 size={14} className="text-cyan-400" />
                Matchup Metadata & Signals
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Weather */}
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

                {/* Rest Days */}
                {metadata?.restDays && (
                  <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-semibold uppercase">
                        Rest Days
                      </div>
                      <div className="text-xs font-bold text-slate-200">
                        {typeof metadata.restDays === "object"
                          ? `Home: ${metadata.restDays.home ?? "--"}d / Away: ${
                              metadata.restDays.away ?? "--"
                            }d`
                          : metadata.restDays}
                      </div>
                    </div>
                  </div>
                )}

                {/* Travel Distance */}
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

                {/* Win Streak / Form */}
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
                          ? `Home: W${metadata.winStreak.home ?? 0} / Away: W${
                              metadata.winStreak.away ?? 0
                            }`
                          : metadata.winStreak}
                      </div>
                    </div>
                  </div>
                )}

                {/* Squiggle Signal */}
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
                        {metadata.squiggleTip}{" "}
                        {metadata.squiggleConfidence
                          ? `(${
                              Number(metadata.squiggleConfidence) > 1
                                ? Number(metadata.squiggleConfidence).toFixed(0)
                                : (
                                    Number(metadata.squiggleConfidence) * 100
                                  ).toFixed(0)
                            }%)`
                          : ""}
                      </div>
                    </div>
                  </div>
                )}

                {/* Head to Head */}
                {metadata?.headToHead && (
                  <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Shield size={18} />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-semibold uppercase">
                        Head-to-Head History
                      </div>
                      <div className="text-xs font-bold text-slate-200">
                        {metadata.headToHead}
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

            {/* Bob Explainability Section */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Brain size={18} className="text-emerald-400" />
                  <span className="font-bold text-sm text-slate-100">
                    Bob Model Insights
                  </span>
                </div>
                {topFavoured && (
                  <button
                    type="button"
                    onClick={() => handleOpenWhyPick(topFavoured.name)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
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

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap text-xs">
                <span className="text-slate-400">Was this model read helpful?</span>
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
