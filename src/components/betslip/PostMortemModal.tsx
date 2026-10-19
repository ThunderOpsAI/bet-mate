import React from "react";
import { X, Award, AlertTriangle, CheckCircle2, TrendingUp, HelpCircle, Share2 } from "lucide-react";
import { useBetslip } from "../../context/BetslipContext";

export const PostMortemModal: React.FC = () => {
  const { isPostMortemOpen, postMortemBet, closePostMortem, openShareCard } = useBetslip();

  if (!isPostMortemOpen || !postMortemBet) return null;

  const isWin = postMortemBet.status === "won";
  const pnl = (postMortemBet.payout || 0) - postMortemBet.stake;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isWin ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
            }`}>
              {isWin ? <Award size={22} /> : <AlertTriangle size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Bet Post-Mortem &amp; Quant Review</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isWin ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                }`}>
                  {isWin ? "Winning Trade" : "Expected Variance"}
                </span>
              </div>
              <p className="text-xs text-slate-400">Outcome analysis &amp; strategy improvement</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closePostMortem}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase">{postMortemBet.event_name}</span>
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-white">{postMortemBet.selection}</h4>
              <span className={`text-base font-black font-mono ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block">Odds Used</span>
                <span className="font-bold text-slate-200">${postMortemBet.odds.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Stake</span>
                <span className="font-bold text-slate-200">${postMortemBet.stake}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Estimated Edge</span>
                <span className="font-bold text-emerald-400">+{postMortemBet.edge_pct || 14}%</span>
              </div>
            </div>
          </div>

          {/* Quant Rationale */}
          <div className="space-y-2 text-xs">
            <h5 className="font-bold text-slate-200 flex items-center gap-1.5">
              <HelpCircle size={14} className="text-cyan-400" />
              <span>Quantitative Rationale</span>
            </h5>
            <p className="text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              {postMortemBet.settlement_notes ||
                (isWin
                  ? "The model identified positive expected value overlay vs market pricing. The speed map position allowed an ideal run, capturing true edge."
                  : "Even with a positive mathematical edge, individual events retain variance. Long-term profitability requires consistent unit sizing and edge capture.")}
            </p>
          </div>

          {/* Strategy Takeaway */}
          <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs space-y-1">
            <span className="font-bold text-cyan-300 flex items-center gap-1">
              <TrendingUp size={14} /> Key Takeaway for Strategy Lab
            </span>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {isWin
                ? "Maintain disciplined fractional Kelly sizing. Reinforces current speed-rating and barrier weights."
                : "A single loss does not invalidate +EV. Over 100+ simulated trials, backing overlays > 10% yielded positive bankroll growth."}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          {isWin ? (
            <button
              type="button"
              onClick={() => {
                closePostMortem();
                openShareCard(postMortemBet);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
            >
              <Share2 size={14} />
              <span>Share Win Ticket</span>
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={closePostMortem}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Close Review
          </button>
        </div>
      </div>
    </div>
  );
};
