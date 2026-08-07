"use client";

import Link from "next/link";
import { Plus, Check, Zap } from "lucide-react";
import type { RankedOpportunity } from "../lib/opportunityScore";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";

type OpportunitySectionProps = {
  title: string;
  description?: string;
  opportunities: RankedOpportunity[];
  emptyMessage: string;
  href: string;
  linkLabel: string;
  compact?: boolean;
};

export default function OpportunitySection({
  title,
  opportunities,
  emptyMessage,
  href,
  linkLabel,
}: OpportunitySectionProps) {
  const { addBet, bets, removeBet } = usePaperBetslip();

  const handleBetslipToggle = (
    e: React.MouseEvent,
    opp: RankedOpportunity,
  ) => {
    e.stopPropagation();

    const inSlip = bets.some(
      (b) => b.event_name === opp.eventLabel && b.selection === opp.selectionName,
    );

    if (inSlip) {
      const existing = bets.find(
        (b) => b.event_name === opp.eventLabel && b.selection === opp.selectionName,
      );
      if (existing) {
        removeBet(existing.id);
      }
    } else {
      const effectiveOdds =
        opp.marketOdds && opp.marketOdds > 1
          ? opp.marketOdds
          : opp.fairOdds && opp.fairOdds > 1
          ? opp.fairOdds
          : undefined;

      addBet(
        {
          sport: opp.sport,
          event_id: opp.id,
          event_name: opp.eventLabel,
          selection: opp.selectionName,
          odds: effectiveOdds,
          stake: 10,
          bet_type: "win",
          odds_source: opp.marketOdds && opp.marketOdds > 1 ? "market" : "model_fair",
        },
        { openBetslip: false },
      );
    }
  };

  return (
    <section className="bg-slate-900/90 border border-slate-400/35 hover:border-slate-300/60 rounded-2xl p-4 sm:p-5 backdrop-blur-md mb-6 shadow-xl transition-all">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
            <Zap size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>{title}</span>
              {opportunities.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {opportunities.length}
                </span>
              )}
            </h3>
          </div>
        </div>
        <Link href={href} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
          <span>{linkLabel}</span>
        </Link>
      </div>

      {opportunities.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opportunities.map((opp, index) => {
            const inSlip = bets.some(
              (b) => b.event_name === opp.eventLabel && b.selection === opp.selectionName,
            );

            const displayOdds = opp.marketOdds ?? opp.fairOdds;
            const probPct = (opp.probability * 100).toFixed(1);

            return (
              <article
                key={opp.id}
                className="bg-slate-950/70 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-3 sm:p-4 transition-all flex items-center justify-between gap-2 shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                      #{index + 1} OPP
                    </span>
                    <span className="text-[11px] font-medium text-slate-400 truncate">
                      {opp.eventLabel}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-100 truncate mb-1">
                    {opp.selectionName}
                  </h4>
                  <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
                    <span>Win: <strong className="text-emerald-400">{probPct}%</strong></span>
                    <span>Fair: <strong className="text-slate-200">${opp.fairOdds.toFixed(2)}</strong></span>
                    {opp.marketOdds && (
                      <span>Mkt: <strong className="text-amber-400">${opp.marketOdds.toFixed(2)}</strong></span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleBetslipToggle(e, opp)}
                  className={`btn text-[11px] py-1.5 px-3 flex items-center gap-1 transition-all shrink-0 font-semibold rounded-lg ${
                    inSlip
                      ? "bg-slate-800 text-emerald-400 border border-slate-700"
                      : "btn-primary shadow-sm"
                  }`}
                >
                  {inSlip ? (
                    <>
                      <Check size={13} className="text-emerald-400" />
                      <span>Added</span>
                    </>
                  ) : (
                    <>
                      <Plus size={13} />
                      <span>+ Add to Betslip</span>
                    </>
                  )}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
