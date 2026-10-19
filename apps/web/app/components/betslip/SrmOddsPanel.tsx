"use client";
import { AlertTriangle, Radio } from "lucide-react";
import type { PaperBet } from "../../providers/PaperBetslipProvider";

type Props = {
  bet: PaperBet;
  onOddsChange: (odds: number | undefined) => void;
};

/**
 * SRM pricing panel for the betslip. Shows the model estimate, where its inputs
 * came from, a notice when live bookmaker inputs were unavailable, and a required
 * field for the actual bookmaker SRM price.
 */
export default function SrmOddsPanel({ bet, onOddsChange }: Props) {
  const isLive = bet.srm_input_source === "LADBROKES";
  const estimate = bet.model_fair_odds;

  return (
    <div className="flex flex-col gap-2">
      {estimate ? (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Model estimate</span>
          <span className="flex items-center gap-2">
            <span className="font-mono font-bold text-fuchsia-200">${estimate.toFixed(2)}</span>
            {isLive ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/40">
                <Radio size={10} /> Live inputs · Ladbrokes
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/40">
                Model only
              </span>
            )}
          </span>
        </div>
      ) : null}

      {estimate && !isLive ? (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] leading-snug text-amber-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Live bookmaker odds unavailable — showing model estimates, not live odds. Enter your actual bookmaker price
            when placing.
          </span>
        </div>
      ) : null}

      <label className="flex items-center justify-between gap-2 text-xs">
        <span className="font-bold uppercase text-slate-400">Your bookmaker SRM odds</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="1.01"
          value={bet.odds ?? ""}
          onChange={(e) => {
            const value = Number(e.target.value);
            onOddsChange(e.target.value === "" || !(value > 1) ? undefined : value);
          }}
          placeholder="e.g. 7.50"
          className="w-24 rounded-lg border border-slate-700 bg-slate-950 py-1.5 px-2 text-right text-sm font-bold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </label>
    </div>
  );
}
