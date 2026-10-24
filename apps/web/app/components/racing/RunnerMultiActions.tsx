"use client";

import React from "react";
import { motion } from "framer-motion";
import { Plus, Check, Anchor, Flame, Sparkles, TrendingUp } from "lucide-react";
import { usePaperBetslip } from "../../providers/PaperBetslipProvider";
import { getEdgePercent } from "../../lib/opportunityScore";

export interface RunnerMultiActionsProps {
  runnerId: string;
  runnerName: string;
  barrier?: number;
  race: {
    race_id: string;
    venue: string;
    race_number: number;
    start_time?: string;
    meeting_date?: string;
  };
  modelRank?: number; // 1, 2, 3...
  winProbability?: number; // 0..1 or 0..100
  fairOdds?: number;
  marketOdds?: number;
  edgePercent?: number | null;
  compact?: boolean;
  showOddsComparison?: boolean;
}

export default function RunnerMultiActions({
  runnerId,
  runnerName,
  barrier,
  race,
  modelRank,
  winProbability,
  fairOdds,
  marketOdds,
  edgePercent,
  compact = false,
  showOddsComparison = true,
}: RunnerMultiActionsProps) {
  const { addBet, bets, removeBet, addToast } = usePaperBetslip();

  // Find if this runner is already in slip for this race
  const existingBet = bets.find(
    (b) =>
      (b.event_id === race.race_id || b.event_id === `${race.race_id}-${runnerId}`) &&
      (b.selection === runnerName || b.runner_name === runnerName),
  );

  const isInMulti = Boolean(
    existingBet &&
      (existingBet.notes?.includes("Multi Leg") ||
        existingBet.notes?.includes("Banker") ||
        existingBet.notes?.includes("Roughie")),
  );
  const isBanker = Boolean(existingBet?.notes?.includes("Banker (Anchor)"));
  const isRoughie = Boolean(existingBet?.notes?.includes("Roughie (High Value)"));

  const effectiveOdds =
    marketOdds && marketOdds > 1
      ? marketOdds
      : fairOdds && fairOdds > 1
      ? fairOdds
      : 1.9;

  const oddsSource =
    marketOdds && marketOdds > 1
      ? ("market" as const)
      : ("model_fair" as const);

  const calculatedEdge =
    edgePercent !== undefined && edgePercent !== null
      ? edgePercent
      : fairOdds && marketOdds
      ? getEdgePercent(fairOdds, marketOdds)
      : null;

  const isEligibleRoughie =
    (marketOdds && marketOdds >= 6.0) ||
    (fairOdds && fairOdds >= 5.0) ||
    (modelRank && modelRank >= 4 && calculatedEdge && calculatedEdge > 0);

  // 1. Toggle + Multi
  const handleToggleMulti = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInMulti) {
      removeBet(existingBet!.id);
      addToast(`Removed ${runnerName} from Multi`, "info");
    } else {
      addBet(
        {
          sport: "racing",
          event_id: race.race_id,
          event_name: `${race.venue} R${race.race_number}`,
          selection_id: runnerId,
          selection: runnerName,
          runner_name: runnerName,
          odds: effectiveOdds,
          bet_type: "win",
          bet_family: "single",
          stake: 10,
          odds_source: oddsSource,
          notes: "Multi Leg",
          event_start_time: race.start_time,
          event_date: race.meeting_date,
          model_fair_odds: fairOdds,
          model_edge_pct: calculatedEdge ?? undefined,
        },
        { openBetslip: false },
      );
      addToast(`Added ${runnerName} to Multi slip`, "success");
    }
  };

  // 2. Toggle Banker (Anchor)
  const handleToggleBanker = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBanker) {
      removeBet(existingBet!.id);
      addToast(`Removed Banker anchor for ${runnerName}`, "info");
    } else {
      if (existingBet) {
        removeBet(existingBet.id);
      }
      addBet(
        {
          sport: "racing",
          event_id: race.race_id,
          event_name: `${race.venue} R${race.race_number}`,
          selection_id: runnerId,
          selection: runnerName,
          runner_name: runnerName,
          odds: effectiveOdds,
          bet_type: "win",
          bet_family: "single",
          stake: 15,
          odds_source: oddsSource,
          notes: "Banker (Anchor) - Anchors this race leg",
          event_start_time: race.start_time,
          event_date: race.meeting_date,
          model_fair_odds: fairOdds,
          model_edge_pct: calculatedEdge ?? undefined,
        },
        { openBetslip: false },
      );
      addToast(`⚓ Marked ${runnerName} as Banker Anchor`, "success");
    }
  };

  // 3. Toggle Roughie (Value)
  const handleToggleRoughie = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRoughie) {
      removeBet(existingBet!.id);
      addToast(`Removed Roughie selection for ${runnerName}`, "info");
    } else {
      if (existingBet) {
        removeBet(existingBet.id);
      }
      addBet(
        {
          sport: "racing",
          event_id: race.race_id,
          event_name: `${race.venue} R${race.race_number}`,
          selection_id: runnerId,
          selection: runnerName,
          runner_name: runnerName,
          odds: effectiveOdds,
          bet_type: "win",
          bet_family: "single",
          stake: 5,
          odds_source: oddsSource,
          notes: "Roughie (High Value) - Value selection",
          event_start_time: race.start_time,
          event_date: race.meeting_date,
          model_fair_odds: fairOdds,
          model_edge_pct: calculatedEdge ?? undefined,
        },
        { openBetslip: false },
      );
      addToast(`🔥 Marked ${runnerName} as Roughie Value Pick`, "success");
    }
  };

  // Model Rank Badge Color
  const getRankBadge = (rank?: number) => {
    if (!rank) return null;
    if (rank === 1) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs">
          🥇 1st Rank
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-400/20 text-slate-300 border border-slate-400/40">
          🥈 2nd Rank
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-700/20 text-amber-400 border border-amber-700/40">
          🥉 3rd Rank
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
        #{rank} Rank
      </span>
    );
  };

  return (
    <div
      className={`runner-multi-actions flex items-center gap-2 flex-wrap ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      {/* Item 57: Model Rank, Fair vs Market Odds & Edge Badge */}
      {showOddsComparison && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {modelRank !== undefined && getRankBadge(modelRank)}

          {fairOdds && fairOdds > 0 ? (
            <div className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
              <span className="text-[10px] text-slate-500 font-sans uppercase">Fair</span>
              <span className="font-bold text-slate-100">${fairOdds.toFixed(2)}</span>
            </div>
          ) : null}

          {marketOdds && marketOdds > 1 ? (
            <div className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
              <span className="text-[10px] text-slate-500 font-sans uppercase">Mkt</span>
              <span className="font-bold text-sky-400">${marketOdds.toFixed(2)}</span>
            </div>
          ) : null}

          {calculatedEdge !== null && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                calculatedEdge >= 5
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-xs"
                  : calculatedEdge > 0
                  ? "bg-teal-500/20 text-teal-300 border-teal-500/30"
                  : "bg-rose-500/20 text-rose-400 border-rose-500/30"
              }`}
            >
              <TrendingUp size={11} />
              {calculatedEdge > 0 ? `+${calculatedEdge.toFixed(1)}%` : `${calculatedEdge.toFixed(1)}%`} Edge
            </span>
          )}
        </div>
      )}

      {/* Item 56: Quick Action Chips */}
      <div className="flex items-center gap-1.5 flex-wrap">

        {/* Banker Chip (Anchor) */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleToggleBanker}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
            isBanker
              ? "bg-amber-500 text-slate-950 border-amber-300 shadow-md shadow-amber-900/40 font-extrabold"
              : "bg-slate-900/90 text-amber-300 hover:text-white hover:bg-amber-950/70 border-amber-500/30 hover:border-amber-400"
          }`}
          title="Banker selection: anchors this leg across combinations"
        >
          <Anchor size={12} className={isBanker ? "text-slate-950" : "text-amber-400"} />
          <span>{isBanker ? "Banker ✓" : "Banker"}</span>
        </motion.button>

        {/* Roughie Chip (Value Selection) */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleToggleRoughie}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
            isRoughie
              ? "bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-900/40 font-extrabold"
              : isEligibleRoughie
              ? "bg-rose-950/50 text-rose-300 hover:text-white hover:bg-rose-900/60 border-rose-500/40 hover:border-rose-400"
              : "bg-slate-900/90 text-slate-400 hover:text-rose-300 hover:bg-slate-800 border-slate-700/60"
          }`}
          title={
            isEligibleRoughie
              ? "High odds value roughie recommendation"
              : "Add as speculative roughie selection"
          }
        >
          <Flame size={12} className={isRoughie ? "text-white" : "text-rose-400"} />
          <span>{isRoughie ? "Roughie ✓" : "Roughie"}</span>
        </motion.button>
      </div>
    </div>
  );
}
