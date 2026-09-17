"use client";

import React from "react";
import { Plus, Check, ChevronRight, Clock } from "lucide-react";
import { usePaperBetslip } from "../../providers/PaperBetslipProvider";
import { getEdgePercent } from "../../lib/opportunityScore";
import type { MatchupDrawerData, DrawerOutcome } from "./SportMatchupDrawer";

function formatCardDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const weekday = d.toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne", weekday: "short" });
    const day = d.toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne", day: "numeric" });
    const month = d.toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne", month: "short" });
    const timeFormatted = d.toLocaleTimeString("en-AU", {
      timeZone: "Australia/Melbourne",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${weekday}, ${day} ${month} ${timeFormatted}`;
  } catch {
    return dateStr;
  }
}

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

  const formattedDate = formatCardDate(matchup.date);

  return (
    <div
      onClick={() => onOpenDrawer(matchup)}
      className="group card-content-padded bg-slate-950/90 border border-slate-400/35 hover:border-slate-300/60 rounded-2xl transition-all duration-200 cursor-pointer shadow-xl hover:shadow-2xl hover:shadow-slate-900/40 mb-4"
    >
      {/* Header Row: Matchup Name & Details trigger */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-2.5 border-b border-slate-800/80 px-1">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="font-bold text-sm sm:text-base text-slate-100 group-hover:text-emerald-400 transition-colors">
            {title}
          </span>
          {formattedDate && (
            <span className="text-[11px] font-semibold text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded flex items-center gap-1">
              <Clock size={11} className="text-sky-400 shrink-0" />
              <span>{formattedDate}</span>
            </span>
          )}
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
      <div className="flex flex-col gap-2">
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
              className="card-inner-item flex items-center justify-between gap-2 bg-slate-900/70 border border-slate-800/70 rounded-lg hover:border-slate-700 transition-colors px-3 py-1.5"
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

              {/* Middle & Right: Unified Odds Button */}
              <div className="flex items-center gap-3 shrink-0">
                {/* Fair Odds (Hidden on mobile for space, visible on sm+) */}
                <div className="hidden sm:flex flex-col items-end mr-2">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    Fair
                  </span>
                  <span className="font-medium text-slate-400 text-xs">
                    {fairOddsText}
                  </span>
                </div>

                {/* Clickable Odds Box (The "Add" Button) */}
                <button
                  type="button"
                  onClick={(e) => handleBetslipToggle(e, outcome)}
                  className={`group relative flex flex-col items-center justify-center min-w-[72px] sm:min-w-[80px] h-[42px] px-2 rounded-lg transition-all overflow-hidden ${
                    inSlip
                      ? "bg-slate-800 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                      : edge && edge > 0
                        ? "bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-400"
                        : "bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-slate-500"
                  }`}
                >
                  {inSlip ? (
                    <div className="flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-400" />
                      <span className="text-emerald-400 font-bold text-xs sm:text-sm">Added</span>
                    </div>
                  ) : (
                    <>
                      <span className={`font-black text-sm sm:text-base ${edge && edge > 0 ? "text-emerald-400" : "text-slate-200"}`}>
                        {marketOddsText}
                      </span>
                      {edge && edge > 0 && (
                        <div className="absolute top-0 right-0 w-0 h-0 border-t-[16px] border-l-[16px] border-t-emerald-500 border-l-transparent">
                          <Plus size={8} className="absolute -top-[15px] -left-[9px] text-slate-900 font-black" />
                        </div>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

