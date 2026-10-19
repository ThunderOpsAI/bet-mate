import React, { useState } from "react";
import {
  X,
  Trash2,
  Share2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCw,
  Coins,
  Layers,
  ChevronRight,
  TrendingUp,
  Award,
  Zap,
} from "lucide-react";
import { useBetslip } from "../../context/BetslipContext";
import { useAuth } from "../../context/AuthContext";
import { useSyndicates } from "../../context/SyndicateContext";
import { calculateCopulaMultiPricing } from "../../lib/copula";
import type { EVLeg, PaperBetItem } from "../../types";

export const PaperBetslipDrawer: React.FC = () => {
  const {
    bets,
    activeBets,
    settledBets,
    isBetslipOpen,
    activeTab,
    slipMode,
    defaultStake,
    multiStake,
    setIsBetslipOpen,
    setActiveTab,
    setSlipMode,
    setDefaultStake,
    setMultiStake,
    removeBet,
    updateBetStake,
    clearBetslip,
    placeBets,
    simulateSettleNextBet,
    simulateSettleAllBets,
    openPostMortem,
    addToast,
    calculateKellyStake,
  } = useBetslip();

  const { user } = useAuth();
  const { activeSyndicate, addSyndicateBet } = useSyndicates();

  const [useSyndicateWallet, setUseSyndicateWallet] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);

  if (!isBetslipOpen) return null;

  // Multi calculations
  const evLegs: EVLeg[] = bets.map((b) => ({
    id: b.id,
    sport: b.sport,
    game_context: b.event_name,
    market_type: b.bet_type,
    selection: b.selection,
    best_odds: b.odds,
    true_prob: b.fair_odds ? 1 / b.fair_odds : 0.5,
    fair_odds: b.fair_odds || b.odds,
    edge_pct: b.edge_pct || 10,
    correlation_group: b.event_id,
  }));

  const pricing = calculateCopulaMultiPricing(evLegs);

  const totalSinglesStake = bets.reduce((sum, b) => sum + (b.stake || defaultStake), 0);
  const totalMultiStake = multiStake || defaultStake;
  const currentStakeTotal = slipMode === "singles" ? totalSinglesStake : totalMultiStake;

  const handleApplyKellyAll = () => {
    bets.forEach((bet) => {
      const prob = bet.fair_odds ? (1 / bet.fair_odds) * 100 : 50;
      const kStake = calculateKellyStake(prob, bet.odds, 0.25);
      updateBetStake(bet.id, kStake);
    });
    addToast("Applied Fractional Kelly (25%) stake to selections based on edge!", "success");
  };

  const handlePlace = async () => {
    if (useSyndicateWallet && activeSyndicate) {
      if (activeSyndicate.balance < currentStakeTotal) {
        addToast(`Syndicate balance insufficient ($${activeSyndicate.balance.toFixed(2)} available)`, "error");
        return;
      }
      addSyndicateBet(currentStakeTotal, `Multi Bet (${bets.length} legs) placed by Captain`);
    }

    setIsPlacing(true);
    await placeBets();
    setIsPlacing(false);
  };

  const handleShare = () => {
    const code = `BM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    setShareCode(code);
    navigator.clipboard?.writeText?.(
      `https://betmate.ai/slips/${code} - Check out my ${bets.length}-leg BetMate quantitative multi!`
    );
    addToast(`Share code ${code} generated and copied to clipboard!`, "success");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm pointer-events-auto transition-opacity"
        onClick={() => setIsBetslipOpen(false)}
      />

      {/* Slide-out Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-6 pointer-events-auto">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Drawer Top Header */}
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-black text-white text-base tracking-tight">Paper Betslip</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ${user.currentBankroll.toLocaleString()} Virtual
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsBetslipOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-3 bg-slate-950/80 border-b border-slate-800 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("slip")}
              className={`py-2 rounded-lg transition-all ${
                activeTab === "slip"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Bet Slip ({bets.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={`py-2 rounded-lg transition-all ${
                activeTab === "active"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Active ({activeBets.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("settled")}
              className={`py-2 rounded-lg transition-all ${
                activeTab === "settled"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Settled ({settledBets.length})
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* ================= TAB 1: BET SLIP ================= */}
            {activeTab === "slip" && (
              <>
                {bets.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-500 mx-auto">
                      <Layers size={22} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-300">Your Betslip is Empty</h4>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Click any odds button or &ldquo;+ EV Leg&rdquo; on racing and sports cards to add simulated paper bets.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mode Toggle & Kelly Button */}
                    <div className="flex items-center justify-between gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                      <div className="flex flex-1 gap-1">
                        <button
                          type="button"
                          onClick={() => setSlipMode("singles")}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                            slipMode === "singles"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Singles ({bets.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlipMode("multi")}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                            slipMode === "multi"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Multi / SGM
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleApplyKellyAll}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition-colors"
                        title="Calculate unit sizing via Kelly Criterion"
                      >
                        <Zap size={12} className="text-amber-400" />
                        <span>Auto Kelly</span>
                      </button>
                    </div>

                    {/* Correlation Warnings if Multi */}
                    {slipMode === "multi" && pricing.warnings.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-amber-400">
                          <AlertTriangle size={14} />
                          <span>Correlation Warning &amp; Haircut</span>
                        </div>
                        {pricing.warnings.map((w, idx) => (
                          <p key={idx} className="text-[11px] text-amber-200/90 leading-relaxed">
                            {w.message}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Selections List */}
                    <div className="space-y-2.5">
                      {bets.map((bet) => (
                        <div
                          key={bet.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2 relative group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block truncate">
                                {bet.event_name} • {bet.bet_type.toUpperCase()}
                              </span>
                              <h5 className="text-sm font-bold text-white truncate">{bet.selection}</h5>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-emerald-400 font-mono">
                                ${bet.odds.toFixed(2)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeBet(bet.id)}
                                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Stake input per single */}
                          {slipMode === "singles" && (
                            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                              <span className="text-[11px] text-slate-400 font-medium">Virtual Stake:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-500 font-bold">$</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={2000}
                                  value={bet.stake}
                                  onChange={(e) => updateBetStake(bet.id, Number(e.target.value))}
                                  className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-right text-white focus:outline-none focus:border-cyan-500"
                                />
                                <span className="text-[10px] text-slate-500">
                                  Return ${(bet.stake * bet.odds).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Multi Math Panel */}
                    {slipMode === "multi" && (
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">{bets.length}-Leg Multi Odds</span>
                          <span className="text-base font-black text-emerald-400 font-mono">
                            ${pricing.combined_odds.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Model True Prob:</span>
                          <span className="font-semibold text-slate-300">
                            {(pricing.fair_probability * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Copula Correlation Haircut:</span>
                          <span className="font-semibold text-amber-400">
                            -{pricing.correlation_haircut}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800">
                          <span className="text-slate-300 font-bold">Model Expected Value:</span>
                          <span
                            className={`font-black font-mono ${
                              pricing.combined_edge_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {pricing.combined_edge_pct >= 0 ? "+" : ""}
                            {pricing.combined_edge_pct}% EV
                          </span>
                        </div>

                        {/* Multi Stake Input */}
                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">Multi Stake:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500 font-bold">$</span>
                            <input
                              type="number"
                              min={1}
                              max={2000}
                              value={multiStake}
                              onChange={(e) => setMultiStake(Number(e.target.value))}
                              className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-right text-white focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>

                        {/* Quick stake pills */}
                        <div className="flex gap-1.5 pt-1">
                          {[5, 10, 25, 50, 100].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setMultiStake(amt)}
                              className={`flex-1 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                                multiStake === amt
                                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                              }`}
                            >
                              ${amt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Syndicate Group Wallet Toggle */}
                    {activeSyndicate && (
                      <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Coins size={16} className="text-purple-400" />
                          <div>
                            <span className="font-bold text-purple-200">Syndicate Wallet</span>
                            <p className="text-[10px] text-purple-300/80">
                              {activeSyndicate.name} (${activeSyndicate.balance.toFixed(2)})
                            </p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={useSyndicateWallet}
                          onChange={(e) => setUseSyndicateWallet(e.target.checked)}
                          className="w-4 h-4 accent-purple-500 rounded"
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* ================= TAB 2: ACTIVE BETS ================= */}
            {activeTab === "active" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Unsettled Paper Bets ({activeBets.length})
                  </span>
                  {activeBets.length > 0 && (
                    <button
                      type="button"
                      onClick={simulateSettleNextBet}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Play size={12} />
                      <span>Simulate Next Event</span>
                    </button>
                  )}
                </div>

                {activeBets.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 space-y-1">
                    <p className="font-semibold text-slate-400">No Active Paper Bets</p>
                    <p>Place bets from your betslip to see them tracking here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeBets.map((bet) => (
                      <div
                        key={bet.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold">
                              {bet.event_name}
                            </span>
                            <h5 className="text-xs font-bold text-white">{bet.selection}</h5>
                          </div>
                          <span className="text-xs font-black text-emerald-400 font-mono">
                            ${bet.odds.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                          <span>Stake: <strong className="text-slate-200">${bet.stake}</strong></span>
                          <span>To Return: <strong className="text-emerald-400">${(bet.stake * bet.odds).toFixed(2)}</strong></span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Active
                          </span>
                        </div>
                        {bet.notes && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] text-cyan-300">
                            <span className="font-semibold text-slate-500">Note:</span>
                            <span className="truncate">{bet.notes}</span>
                          </div>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={simulateSettleAllBets}
                      className="w-full py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-2"
                    >
                      <RotateCw size={13} />
                      <span>Simulate All Results Now</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ================= TAB 3: SETTLED BETS ================= */}
            {activeTab === "settled" && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Settled Performance ({settledBets.length})
                </span>

                {settledBets.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    No settled bets yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {settledBets.map((bet) => {
                      const isWin = bet.status === "won";
                      const pnl = (bet.payout || 0) - bet.stake;
                      return (
                        <div
                          key={bet.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[10px] text-slate-500 uppercase font-bold">
                                {bet.event_name}
                              </span>
                              <h5 className="text-xs font-bold text-white">{bet.selection}</h5>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                isWin
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              }`}
                            >
                              {bet.status.toUpperCase()}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                            <span>Stake: ${bet.stake}</span>
                            <span>
                              P&amp;L:{" "}
                              <strong className={pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                                {pnl >= 0 ? "+" : ""}
                                ${pnl.toFixed(2)}
                              </strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => openPostMortem(bet)}
                              className="text-[10px] font-bold text-cyan-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>Post-Mortem</span>
                              <ChevronRight size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drawer Bottom Actions */}
          {activeTab === "slip" && bets.length > 0 && (
            <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Total Stake:</span>
                <span className="text-sm font-black text-white font-mono">
                  ${currentStakeTotal.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={clearBetslip}
                  className="py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-colors flex items-center justify-center cursor-pointer"
                  title="Clear all selections"
                >
                  <Trash2 size={16} />
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="py-2.5 rounded-xl border border-cyan-500/30 hover:bg-cyan-500/15 text-cyan-300 text-xs font-bold transition-colors flex items-center justify-center cursor-pointer"
                  title="Share slip"
                >
                  <Share2 size={16} />
                </button>

                <button
                  type="button"
                  disabled={isPlacing}
                  onClick={handlePlace}
                  className="col-span-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  <span>{isPlacing ? "Placing..." : "Place Paper Bet"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
