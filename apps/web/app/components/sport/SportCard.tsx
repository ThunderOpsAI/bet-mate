"use client";

import React from "react";
import { Plus, Check, ChevronRight } from "lucide-react";
import { usePaperBetslip } from "../../providers/PaperBetslipProvider";
import { getEdgePercent } from "../../lib/opportunityScore";
import type { MatchupDrawerData, DrawerOutcome } from "./SportMatchupDrawer";

interface SportCardProps {
  matchup: MatchupDrawerData;
  onOpenDrawer: (matchup: MatchupDrawerData) => void;
}

export default function SportCard({ matchup, onOpenDrawer }: SportCardProps) {
  const { addBet, bets, removeBet } = usePaperBetslip();

  const { id, sport, title, subTitle, outcomes } = matchup;

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
          odds_source:
            outcome.marketOdds && outcome.marketOdds > 1
              ? "market"
              : "model_fair",
          event_start_time: matchup.date,
        },
        { openBetslip: false },
      );
    }
  };

  return (
    <div
      onClick={() => onOpenDrawer(matchup)}
      className="group bg-slate-900/90 border border-slate-400/35 hover:border-slate-300/60 rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer shadow-xl hover:shadow-2xl hover:shadow-slate-950/40 mb-3"
    >
      {/* Header Row: Matchup Name & Details trigger */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="font-bold text-sm sm:text-base text-slate-100 group-hover:text-emerald-400 transition-colors">
            {title}
          </span>
          {subTitle && (
            <span className="text-[11px] font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
              {subTitle}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 shrink-0 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg group-hover:bg-emerald-500/20 transition-all">
          <span>Details</span>
          <ChevronRight size={13} />
        </div>
      </div>

      {/* Dense Outcome Rows with Breathing Room */}
      <div className="flex flex-col gap-2.5">
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

          const fairOddsText =
            outcome.fairOdds && outcome.fairOdds > 1
              ? `$${outcome.fairOdds.toFixed(2)}`
              : "N/A";

          const marketOddsText =
            outcome.marketOdds && outcome.marketOdds > 1
              ? `$${outcome.marketOdds.toFixed(2)}`
              : "--";

          return (
            <div
              key={outcome.name}
              className="flex items-center justify-between gap-2 p-2.5 sm:p-3 bg-slate-950/70 border border-slate-800/70 rounded-lg hover:border-slate-700 transition-colors"
            >
              {/* Left: Team Name & Model Win % */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-semibold text-xs sm:text-sm text-slate-100 truncate">
                  {outcome.name}
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                  {winProbText}
                </span>
              </div>

              {/* Middle: Odds & Edge */}
              <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-300 shrink-0">
                <div className="hidden sm:flex items-center gap-1 text-[11px]">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">
                    Fair
                  </span>
                  <span className="font-medium text-slate-400">
                    {fairOddsText}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">
                    Mkt
                  </span>
                  <span className="font-semibold text-slate-200">
                    {marketOddsText}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">
                    Edge
                  </span>
                  <span
                    className={`font-bold ${
                      edge && edge > 0 ? "text-emerald-400" : "text-slate-400"
                    }`}
                  >
                    {edge && edge > 0 ? `+${edge.toFixed(1)}%` : "--"}
                  </span>
                </div>
              </div>

              {/* Right: Inline Compact Action Button */}
              <button
                type="button"
                onClick={(e) => handleBetslipToggle(e, outcome)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 shrink-0 transition-all ${
                  inSlip
                    ? "bg-slate-800 text-emerald-400 border border-slate-700 hover:bg-slate-750"
                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-sm"
                }`}
              >
                {inSlip ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="hidden sm:inline">In Betslip</span>
                  </>
                ) : (
                  <>
                    <Plus size={13} />
                    <span>+ Add</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

