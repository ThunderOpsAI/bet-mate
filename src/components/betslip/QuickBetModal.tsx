import React, { useState, useEffect } from "react";
import {
  X,
  Zap,
  TrendingUp,
  DollarSign,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Users,
  FileText,
  Tag,
} from "lucide-react";
import { useBetslip } from "../../context/BetslipContext";
import { useAuth } from "../../context/AuthContext";
import { useSyndicates } from "../../context/SyndicateContext";

export const QuickBetModal: React.FC = () => {
  const {
    isQuickBetOpen,
    quickBetItem,
    closeQuickBet,
    placeQuickBet,
    calculateKellyStake,
  } = useBetslip();
  const { user } = useAuth();
  const { syndicates } = useSyndicates();

  const [stake, setStake] = useState<number>(20);
  const [walletSource, setWalletSource] = useState<"personal" | "syndicate">("personal");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (quickBetItem) {
      // Calculate a smart default stake based on edge
      const edge = quickBetItem.edge_pct || 15;
      const kelly = calculateKellyStake(50, quickBetItem.odds, 0.25);
      setStake(Math.max(10, kelly));
      setNotes("");
    }
  }, [quickBetItem, calculateKellyStake]);

  if (!isQuickBetOpen || !quickBetItem) return null;

  const odds = quickBetItem.odds || 2.0;
  const potentialPayout = Number((stake * odds).toFixed(2));
  const potentialProfit = Number((potentialPayout - stake).toFixed(2));
  const hasInsufficientFunds = user.currentBankroll < stake;

  const handleKellyClick = () => {
    const kelly = calculateKellyStake(
      quickBetItem.edge_pct ? quickBetItem.edge_pct * 2 : 45,
      odds,
      0.25
    );
    setStake(Math.max(5, kelly));
  };

  const handleConfirm = async () => {
    if (stake <= 0 || hasInsufficientFunds) return;
    setIsSubmitting(true);
    try {
      await placeQuickBet(stake, notes);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950/50 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap size={18} className="fill-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                <span>Instant Quick Bet</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Paper Mode
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Confirm paper wager directly without leaving the view
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeQuickBet}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Bet Selection Target Card */}
        <div className="p-5 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {quickBetItem.event_name}
              </span>
              {quickBetItem.edge_pct && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  +{quickBetItem.edge_pct}% EV Edge
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <h4 className="text-lg font-black text-white leading-tight">
                {quickBetItem.selection}
              </h4>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Odds</span>
                <span className="text-lg font-mono font-black text-emerald-400">
                  ${odds.toFixed(2)}
                </span>
              </div>
            </div>

            {quickBetItem.fair_odds && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Model Fair Price:</span>
                <span className="font-mono font-bold text-cyan-300">
                  ${quickBetItem.fair_odds.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Staking Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <label htmlFor="quick-stake-input" className="flex items-center gap-1.5">
                <Wallet size={13} className="text-emerald-400" />
                <span>Enter Stake Amount</span>
              </label>
              <span className="text-slate-400">
                Available: <strong className="text-emerald-400 font-mono">${user.currentBankroll.toLocaleString()}</strong>
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                $
              </span>
              <input
                id="quick-stake-input"
                type="number"
                min="1"
                max={user.currentBankroll}
                value={stake || ""}
                onChange={(e) => setStake(Math.max(0, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-8 pr-4 text-white font-mono font-black text-lg focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="20"
              />
            </div>

            {/* Quick Stake Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[10, 25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setStake(amt)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    stake === amt
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-600"
                  }`}
                >
                  ${amt}
                </button>
              ))}

              <button
                type="button"
                onClick={handleKellyClick}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-all flex items-center gap-1 cursor-pointer ml-auto"
                title="Calculate quarter-Kelly optimal stake"
              >
                <Sparkles size={11} />
                <span>Kelly Optimal</span>
              </button>
            </div>
          </div>

          {/* Custom Betting Notes & Thesis */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <label htmlFor="quick-notes-input" className="flex items-center gap-1.5">
                <FileText size={13} className="text-cyan-400" />
                <span>Custom Betting Notes &amp; Thesis</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {notes.length}/120
              </span>
            </div>

            <input
              id="quick-notes-input"
              type="text"
              maxLength={120}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Backed on speed map lead, barrier 2, model overlay +18%..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />

            {/* Quick Thesis Tag Chips */}
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              {[
                "+EV Value",
                "Speed Map Leader",
                "Pace Advantage",
                "Market Drift",
                "Quarter Kelly",
              ].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (notes.includes(tag)) return;
                    setNotes((prev) => (prev ? `${prev} • ${tag}` : tag).slice(0, 120));
                  }}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-950 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors cursor-pointer"
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Wallet Source Toggle (Personal or Syndicate) */}
          {syndicates.length > 0 && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Users size={13} className="text-indigo-400" />
                <span>Funding Source:</span>
              </span>
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setWalletSource("personal")}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                    walletSource === "personal"
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Personal
                </button>
                <button
                  type="button"
                  onClick={() => setWalletSource("syndicate")}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                    walletSource === "syndicate"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {syndicates[0].name.slice(0, 10)}
                </button>
              </div>
            </div>
          )}

          {/* Potential Return Summary Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/30 via-slate-950 to-slate-950 border border-emerald-500/25 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400 font-semibold">
              <span>Potential Return</span>
              <span>Net Paper Profit</span>
            </div>
            <div className="flex justify-between items-baseline font-mono font-black">
              <span className="text-xl sm:text-2xl text-white">
                ${potentialPayout.toFixed(2)}
              </span>
              <span className="text-lg sm:text-xl text-emerald-400">
                +${potentialProfit.toFixed(2)}
              </span>
            </div>
          </div>

          {hasInsufficientFunds && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
              <AlertCircle size={14} className="shrink-0" />
              <span>Insufficient virtual bankroll. Reduce stake or reset funds in settings.</span>
            </div>
          )}

          {/* Auto-Sync with My Bets Dashboard Note */}
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Direct Sync to 'My Bets' Dashboard</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Live Portfolio</span>
          </div>

          {/* Confirm Button */}
          <div className="pt-1">
            <button
              type="button"
              disabled={stake <= 0 || hasInsufficientFunds || isSubmitting}
              onClick={handleConfirm}
              className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                stake <= 0 || hasInsufficientFunds || isSubmitting
                  ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed shadow-none"
                  : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25 hover:scale-[1.01]"
              }`}
            >
              {isSubmitting ? (
                <span>Confirming...</span>
              ) : (
                <>
                  <Zap size={16} className="fill-slate-950" />
                  <span>Confirm Paper Bet (${stake})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
