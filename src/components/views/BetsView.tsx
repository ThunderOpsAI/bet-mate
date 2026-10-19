import React, { useState } from "react";
import {
  History,
  TrendingUp,
  Award,
  Bookmark,
  Play,
  RotateCw,
  Plus,
  Check,
  ChevronRight,
  ArrowRight,
  Share2,
  FileText,
} from "lucide-react";
import { useBetslip } from "../../context/BetslipContext";
import { useBlackbook } from "../../context/BlackbookContext";
import type { PaperBetItem } from "../../types";

interface BetsViewProps {
  onNavigate: (view: string) => void;
}

export const BetsView: React.FC<BetsViewProps> = ({ onNavigate }) => {
  const {
    activeBets,
    settledBets,
    simulateSettleNextBet,
    simulateSettleAllBets,
    openPostMortem,
    openShareCard,
    addToast,
  } = useBetslip();

  const { isBookmarked, quickAdd } = useBlackbook();
  const [tab, setTab] = useState<"active" | "settled" | "all">("active");

  const allBets = [...activeBets, ...settledBets];

  const filteredBets = allBets.filter((bet) => {
    if (tab === "active") return bet.status === "active";
    if (tab === "settled") return bet.status === "won" || bet.status === "lost" || bet.status === "void";
    return true;
  });

  const wonBets = settledBets.filter((b) => b.status === "won");
  const winRate = settledBets.length > 0 ? (wonBets.length / settledBets.length) * 100 : 0;
  const totalSettledStaked = settledBets.reduce((sum, b) => sum + b.stake, 0);
  const totalSettledPayout = settledBets.reduce((sum, b) => sum + (b.payout || 0), 0);
  const totalPnL = totalSettledPayout - totalSettledStaked;
  const roi = totalSettledStaked > 0 ? (totalPnL / totalSettledStaked) * 100 : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <History className="text-purple-400" size={24} />
            <span>My Bets &amp; Portfolio History</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track active paper bets, simulated outcomes, and review quant post-mortems.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeBets.length > 0 && (
            <button
              type="button"
              onClick={simulateSettleNextBet}
              className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Play size={13} />
              <span>Simulate Next Result</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate("racing")}
            className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>Explore Races</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Active Bets</span>
          <div className="text-2xl font-black text-purple-400 mt-1">{activeBets.length}</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Settled Bets</span>
          <div className="text-2xl font-black text-slate-200 mt-1">{settledBets.length}</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Simulated Win Rate</span>
          <div className="text-2xl font-black text-cyan-400 mt-1 font-mono">
            {winRate.toFixed(1)}%
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Simulated ROI</span>
          <div className={`text-2xl font-black mt-1 font-mono ${totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setTab("active")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            tab === "active"
              ? "bg-purple-900/40 text-purple-200 border border-purple-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Active Bets ({activeBets.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("settled")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            tab === "settled"
              ? "bg-purple-900/40 text-purple-200 border border-purple-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Settled Bets ({settledBets.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("all")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            tab === "all"
              ? "bg-purple-900/40 text-purple-200 border border-purple-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          All History ({allBets.length})
        </button>
      </div>

      {/* Bets List */}
      <div className="space-y-3">
        {filteredBets.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 rounded-2xl bg-slate-950 border border-slate-800">
            No bets found in this view.
          </div>
        ) : (
          filteredBets.map((bet) => {
            const isSettled = bet.status === "won" || bet.status === "lost" || bet.status === "void";
            const isWin = bet.status === "won";
            const bookmarked = isBookmarked(bet.selection);

            return (
              <div
                key={bet.id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {bet.event_name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        bet.status === "active"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : isWin
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {bet.status}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-white truncate">{bet.selection}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>Odds: <strong className="text-slate-200">${bet.odds.toFixed(2)}</strong></span>
                    <span>•</span>
                    <span>Stake: <strong className="text-slate-200">${bet.stake}</strong></span>
                    {isSettled && (
                      <>
                        <span>•</span>
                        <span>
                          Payout:{" "}
                          <strong className={isWin ? "text-emerald-400" : "text-slate-500"}>
                            ${(bet.payout || 0).toFixed(2)}
                          </strong>
                        </span>
                      </>
                    )}
                  </div>

                  {bet.notes && (
                    <div className="mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-cyan-300">
                      <FileText size={11} className="text-cyan-400 shrink-0" />
                      <span className="font-semibold text-slate-500">Thesis Note:</span>
                      <span className="truncate text-slate-200">{bet.notes}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                  {isSettled && isWin && (
                    <button
                      type="button"
                      onClick={() => openShareCard(bet)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Generate shareable image ticket"
                    >
                      <Share2 size={13} />
                      <span>Share</span>
                    </button>
                  )}

                  {isSettled && (
                    <button
                      type="button"
                      onClick={() => openPostMortem(bet)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Award size={13} />
                      <span>Post-Mortem</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => quickAdd(bet.selection, "RUNNER", bet.sport)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      bookmarked
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                    title={bookmarked ? "Saved in Blackbook" : "Add to Blackbook"}
                  >
                    <Bookmark size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
