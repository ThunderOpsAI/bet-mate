import React, { useState } from "react";
import {
  Layers,
  Zap,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  RotateCw
} from "lucide-react";
import { MOCK_EV_FEED } from "../../data/mockData";
import { useBetslip } from "../../context/BetslipContext";
import { useAuth } from "../../context/AuthContext";
import { calculateCopulaMultiPricing } from "../../lib/copula";
import type { EVLeg, SportCode } from "../../types";

export const MultiBuilderView: React.FC = () => {
  const { bets, addBet, clearBetslip, placeBets, setSlipMode, setMultiStake, multiStake } = useBetslip();
  const { user } = useAuth();

  const [filterSport, setFilterSport] = useState<SportCode | "ALL">("ALL");
  const [selectedLegs, setSelectedLegs] = useState<EVLeg[]>(MOCK_EV_FEED.slice(0, 3));
  const [stake, setStake] = useState<number>(multiStake || 20);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [placedSuccess, setPlacedSuccess] = useState(false);

  const pricing = calculateCopulaMultiPricing(selectedLegs);

  const toggleLeg = (leg: EVLeg) => {
    setSelectedLegs((prev) => {
      const exists = prev.find((l) => l.id === leg.id);
      if (exists) {
        return prev.filter((l) => l.id !== leg.id);
      }
      return [...prev, leg];
    });
  };

  const handleApplyPreset = (presetName: string) => {
    if (presetName === "anchor") {
      // Highest true probability legs
      const sorted = [...MOCK_EV_FEED].sort((a, b) => b.true_prob - a.true_prob).slice(0, 3);
      setSelectedLegs(sorted);
    } else if (presetName === "high_yield") {
      // Highest EV edge
      const sorted = [...MOCK_EV_FEED].sort((a, b) => b.edge_pct - a.edge_pct).slice(0, 4);
      setSelectedLegs(sorted);
    } else if (presetName === "racing") {
      // All racing quad
      const racingOnly = MOCK_EV_FEED.filter((l) => l.sport === "racing").slice(0, 4);
      setSelectedLegs(racingOnly);
    } else {
      // Cross-sport
      const cross = [
        MOCK_EV_FEED.find((l) => l.sport === "racing")!,
        MOCK_EV_FEED.find((l) => l.sport === "nba")!,
        MOCK_EV_FEED.find((l) => l.sport === "afl")!,
        MOCK_EV_FEED.find((l) => l.sport === "nrl")!,
      ].filter(Boolean);
      setSelectedLegs(cross);
    }
    setIsWizardOpen(false);
  };

  const handlePlaceMulti = async () => {
    if (selectedLegs.length < 2) return;
    clearBetslip();
    setSlipMode("multi");
    setMultiStake(stake);

    selectedLegs.forEach((leg) => {
      addBet({
        sport: leg.sport,
        event_id: leg.id,
        event_name: leg.game_context,
        selection: leg.selection,
        bet_type: "win",
        odds: leg.best_odds,
        stake,
        fair_odds: leg.fair_odds,
        edge_pct: leg.edge_pct,
      });
    });

    await placeBets();
    setPlacedSuccess(true);
    setTimeout(() => setPlacedSuccess(false), 4000);
  };

  const filteredFeed = MOCK_EV_FEED.filter((l) =>
    filterSport === "ALL" ? true : l.sport === filterSport
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Layers className="text-emerald-400" size={24} />
            <span>Gaussian Copula Multi &amp; SGM Builder</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Build correlated accumulators with mathematically adjusted odds and expected value (+EV) overlay.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsWizardOpen(true)}
          className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-slate-950 flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer self-start md:self-auto"
        >
          <Sparkles size={15} />
          <span>Multi Wizard Presets</span>
        </button>
      </div>

      {/* Main Grid: Feed on left, Active multi math on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: High EV Feed Leg Selector */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={14} className="text-yellow-400 fill-yellow-400" />
              Available High EV Legs ({filteredFeed.length})
            </span>

            {/* Sport Filter Pills */}
            <div className="flex items-center gap-1 text-[11px] font-bold">
              {["ALL", "racing", "nba", "afl", "nrl"].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setFilterSport(code as any)}
                  className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer uppercase ${
                    filterSport === code
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredFeed.map((leg) => {
              const isSelected = selectedLegs.some((l) => l.id === leg.id);

              return (
                <div
                  key={leg.id}
                  onClick={() => toggleLeg(leg)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-emerald-950/25 border-emerald-500/50 shadow-md shadow-emerald-950/40"
                      : "bg-slate-950/90 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
                        isSelected
                          ? "bg-emerald-500 text-slate-950 font-black"
                          : "border border-slate-700 text-transparent hover:border-slate-500"
                      }`}
                    >
                      ✓
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          {leg.sport}
                        </span>
                        <span className="text-xs text-slate-400 truncate">{leg.game_context}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white truncate">{leg.selection}</h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-400 font-mono block">
                        ${leg.best_odds.toFixed(2)}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-300/80">
                        +{leg.edge_pct}% EV
                      </span>
                    </div>

                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        isSelected ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {isSelected ? "Selected" : "Add Leg"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Multi Math Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl space-y-5 sticky top-20">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-black flex items-center justify-center">
                  {selectedLegs.length}
                </span>
                <h3 className="text-base font-extrabold text-white">Selected Multi Legs</h3>
              </div>
              {selectedLegs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedLegs([])}
                  className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {selectedLegs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Click legs on the left to start building your multi.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {selectedLegs.map((leg) => (
                  <div
                    key={leg.id}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-[10px] text-slate-400 block truncate">{leg.game_context}</span>
                      <strong className="text-white truncate block">{leg.selection}</strong>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-emerald-400">${leg.best_odds.toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => toggleLeg(leg)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pairwise warnings */}
            {pricing.warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-1 text-xs">
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={13} /> Pairwise Correlation
                </span>
                {pricing.warnings.map((w, idx) => (
                  <p key={idx} className="text-[11px] text-amber-200/90 leading-relaxed">
                    {w.message}
                  </p>
                ))}
              </div>
            )}

            {/* Gaussian Copula Math Table */}
            <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Raw Combined Odds:</span>
                <span className="font-bold text-slate-200 font-mono">${pricing.combined_odds.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Independence Fair Prob:</span>
                <span className="font-bold text-slate-200">{(pricing.fair_probability * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Correlation Haircut:</span>
                <span className="font-bold text-amber-400 font-mono">-{pricing.correlation_haircut}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Copula Adjusted Odds:</span>
                <span className="font-bold text-slate-200 font-mono">${pricing.adjusted_odds.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <span className="text-slate-200 font-bold">Overall Edge (+EV):</span>
                <span
                  className={`font-black font-mono text-sm ${
                    pricing.combined_edge_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {pricing.combined_edge_pct >= 0 ? "+" : ""}
                  {pricing.combined_edge_pct}% EV
                </span>
              </div>
            </div>

            {/* Staking Input */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-300">Virtual Stake:</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={stake}
                    onChange={(e) => setStake(Number(e.target.value))}
                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-right text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-between text-xs text-slate-400">
                <span>Estimated Payout:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  ${(stake * pricing.combined_odds).toFixed(2)}
                </span>
              </div>
            </div>

            {placedSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>Multi bet placed successfully! Tracking in Active Bets.</span>
              </div>
            )}

            <button
              type="button"
              disabled={selectedLegs.length < 2}
              onClick={handlePlaceMulti}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 size={16} />
              <span>Place {selectedLegs.length}-Leg Virtual Multi (${stake})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Multi Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="text-cyan-400" size={18} />
                <h3 className="text-base font-bold text-white">Multi Wizard Presets</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWizardOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Select an algorithmically pre-calculated accumulator template:
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleApplyPreset("anchor")}
                className="w-full p-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 text-sm">Safe Value Anchor</span>
                  <span className="text-[11px] font-bold text-slate-400">3 Legs • ~60% Win Prob</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Combines the 3 highest true probability selections with conservative risk profile.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset("high_yield")}
                className="w-full p-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-400 text-sm">High Yield Alpha Accumulator</span>
                  <span className="text-[11px] font-bold text-slate-400">4 Legs • +18% Combined Edge</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Maximizes expected value by accumulating legs with market edge exceeding 15%.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset("racing")}
                className="w-full p-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-orange-400 text-sm">Saturday Metro Racing Quad</span>
                  <span className="text-[11px] font-bold text-slate-400">4 Legs • Flemington &amp; Randwick</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Picks model-top thoroughbred runners across feature metro races.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset("cross")}
                className="w-full p-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-400 text-sm">Cross-Sport Power Multi</span>
                  <span className="text-[11px] font-bold text-slate-400">4 Legs • Racing + NBA + AFL + NRL</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Zero inter-game correlation haircut since all events take place in separate sports leagues.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
