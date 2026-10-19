import React, { useState } from "react";
import { FlaskConical, TrendingUp, Sliders, ShieldCheck, Sparkles, Check, Plus, AlertCircle, Play } from "lucide-react";
import { MOCK_STRATEGIES } from "../../data/mockData";
import { useBetslip } from "../../context/BetslipContext";
import type { QuantStrategy } from "../../types";

export const StrategyLabView: React.FC = () => {
  const { addToast } = useBetslip();
  const [strategies, setStrategies] = useState<QuantStrategy[]>(MOCK_STRATEGIES);
  const [activeStrategyId, setActiveStrategyId] = useState<string>("strat-1");
  const [isBuildingNew, setIsBuildingNew] = useState(false);

  // New Strategy Form
  const [newName, setNewName] = useState("");
  const [minProb, setMinProb] = useState(30);
  const [minEdge, setMinEdge] = useState(10);
  const [maxOdds, setMaxOdds] = useState(6.0);
  const [stakingModel, setStakingModel] = useState<QuantStrategy["staking_model"]>("Kelly (25%)");

  const activeStrategy = strategies.find((s) => s.id === activeStrategyId) || strategies[0];

  const toggleStrategyActive = (id: string) => {
    setStrategies((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const nextActive = !s.active;
          addToast(`${s.name} ${nextActive ? "activated" : "deactivated"}!`, "success");
          return { ...s, active: nextActive };
        }
        return s;
      })
    );
  };

  const handleCreateCustomStrategy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const created: QuantStrategy = {
      id: `strat_${Date.now()}`,
      name: newName.trim(),
      description: `Custom model rule: min prob ${minProb}%, min overlay +${minEdge}%, max odds $${maxOdds.toFixed(2)}.`,
      tag: "Custom Quant",
      win_rate: 38.2,
      yield_roi: 18.5,
      total_trades: 120,
      avg_odds: 3.10,
      profit_100u: 54.0,
      min_prob: minProb,
      min_edge: minEdge,
      max_odds: maxOdds,
      staking_model: stakingModel,
      active: true,
    };

    setStrategies((prev) => [created, ...prev]);
    setActiveStrategyId(created.id);
    setIsBuildingNew(false);
    setNewName("");
    addToast(`Strategy "${created.name}" created and loaded into backtester!`, "success");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <FlaskConical className="text-amber-400" size={24} />
            <span>Strategy Lab &amp; Quant Backtesting</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Test and backtest automated staking rules, Kelly fraction unit sizing, and edge thresholds.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsBuildingNew(true)}
          className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Build Custom Rule</span>
        </button>
      </div>

      {/* Strategies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {strategies.map((strat) => {
          const isSelected = activeStrategy?.id === strat.id;

          return (
            <div
              key={strat.id}
              onClick={() => setActiveStrategyId(strat.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                isSelected
                  ? "bg-amber-950/20 border-amber-500/60 shadow-lg shadow-amber-950/30"
                  : "bg-slate-950 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300">
                    {strat.tag}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      strat.active ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 bg-slate-900"
                    }`}
                  >
                    {strat.active ? "Active" : "Off"}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white">{strat.name}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{strat.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Win Rate</span>
                  <span className="font-bold text-white font-mono">{strat.win_rate}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Sim Yield</span>
                  <span className="font-black text-emerald-400 font-mono">+{strat.yield_roi}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Strategy Deep Analytics Card */}
      {activeStrategy && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-white">{activeStrategy.name}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {activeStrategy.staking_model}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{activeStrategy.description}</p>
            </div>

            <button
              type="button"
              onClick={() => toggleStrategyActive(activeStrategy.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer self-start sm:self-auto ${
                activeStrategy.active
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              {activeStrategy.active ? "Enabled (Auto-Paper Trade)" : "Enable Strategy"}
            </button>
          </div>

          {/* Quant Performance Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Sample Size</span>
              <span className="text-lg font-black text-white font-mono mt-0.5 block">{activeStrategy.total_trades} Bets</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Average Odds</span>
              <span className="text-lg font-black text-slate-200 font-mono mt-0.5 block">${activeStrategy.avg_odds.toFixed(2)}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Historical Strike</span>
              <span className="text-lg font-black text-cyan-400 font-mono mt-0.5 block">{activeStrategy.win_rate}%</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">100-Unit Profit</span>
              <span className="text-lg font-black text-emerald-400 font-mono mt-0.5 block">+{activeStrategy.profit_100u} Units</span>
            </div>
          </div>

          {/* Rule Filters Breakdown */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders size={14} className="text-amber-400" />
              <span>Configured Execution Criteria</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400 block">Min Win Probability</span>
                <strong className="text-white text-sm font-mono">&ge; {activeStrategy.min_prob}%</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400 block">Min Market Overlay Edge</span>
                <strong className="text-emerald-400 text-sm font-mono">&ge; +{activeStrategy.min_edge}%</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400 block">Maximum Allowed Odds</span>
                <strong className="text-white text-sm font-mono">&le; ${activeStrategy.max_odds.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Build Custom Rule Modal */}
      {isBuildingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Create Custom Quant Strategy</h3>
              <button
                type="button"
                onClick={() => setIsBuildingNew(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomStrategy} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Strategy Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sprint Leaders & Overlays"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Min Probability (%)</label>
                  <input
                    type="number"
                    min={10}
                    max={90}
                    value={minProb}
                    onChange={(e) => setMinProb(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Min Edge (%)</label>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={minEdge}
                    onChange={(e) => setMinEdge(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Max Odds ($)</label>
                  <input
                    type="number"
                    step={0.5}
                    min={1.5}
                    max={50}
                    value={maxOdds}
                    onChange={(e) => setMaxOdds(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Staking Model</label>
                  <select
                    value={stakingModel}
                    onChange={(e) => setStakingModel(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Kelly (25%)">Quarter Kelly (25%)</option>
                    <option value="Flat 1.0u">Flat 1.0 Unit</option>
                    <option value="Confidence Weighted">Confidence Weighted</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBuildingNew(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950"
                >
                  Save &amp; Run Backtest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
