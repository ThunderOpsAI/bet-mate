import React, { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Activity,
  ShieldCheck,
  Award,
  Wallet,
  Zap,
  CheckCircle2,
  Database
} from "lucide-react";
import { MOCK_CALIBRATION_BUCKETS, MOCK_FEATURE_IMPORTANCE } from "../../data/mockData";
import { useBetslip } from "../../context/BetslipContext";
import { useAuth } from "../../context/AuthContext";

export const AnalyticsView: React.FC = () => {
  const { settledBets, activeBets } = useBetslip();
  const { user } = useAuth();
  const [tab, setTab] = useState<"user" | "strategy" | "ml">("user");

  // User stats
  const wonBets = settledBets.filter((b) => b.status === "won");
  const winRate = settledBets.length > 0 ? (wonBets.length / settledBets.length) * 100 : 0;
  const totalStaked = settledBets.reduce((sum, b) => sum + b.stake, 0);
  const totalPayout = settledBets.reduce((sum, b) => sum + (b.payout || 0), 0);
  const netProfit = totalPayout - totalStaked;
  const roi = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0;

  // Cumulative PnL curve points
  let runningPnL = 0;
  const pnlPoints = settledBets.map((b) => {
    const change = (b.payout || 0) - b.stake;
    runningPnL += change;
    return runningPnL;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <BarChart3 className="text-cyan-400" size={24} />
            <span>Portfolio Analytics &amp; Model Calibration</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Realized paper trading yield, strategy drawdowns, and XGBoost probabilistic reliability curves.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          {(["user", "strategy", "ml"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTab(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                tab === mode
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {mode === "user"
                ? "Paper Trading"
                : mode === "strategy"
                ? "Quant Yields"
                : "ML Calibration"}
            </button>
          ))}
        </div>
      </div>

      {/* ================= TAB 1: USER PAPER BETS ================= */}
      {tab === "user" && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Total Settled</span>
              <div className="text-2xl font-black text-white mt-1 font-mono">${totalStaked.toFixed(2)}</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Total Returned</span>
              <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">${totalPayout.toFixed(2)}</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Net Yield / ROI</span>
              <div className={`text-2xl font-black mt-1 font-mono ${netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Win Rate</span>
              <div className="text-2xl font-black text-cyan-400 mt-1 font-mono">{winRate.toFixed(1)}%</div>
            </div>
          </div>

          {/* Interactive SVG Cumulative Profit Curve */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-400" />
                  <span>Cumulative Profit &amp; Loss Trajectory</span>
                </h3>
                <p className="text-xs text-slate-400">Tracking equity curve across historical paper trades</p>
              </div>
              <span className="text-sm font-black font-mono text-emerald-400">
                +${Math.max(0, netProfit).toFixed(2)} Net Gain
              </span>
            </div>

            {/* SVG Curve Diagram */}
            <div className="h-44 w-full relative pt-4">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid lines */}
                <line x1="0" y1="20" x2="500" y2="20" stroke="#1e293b" strokeDasharray="4" />
                <line x1="0" y1="60" x2="500" y2="60" stroke="#334155" />
                <line x1="0" y1="100" x2="500" y2="100" stroke="#1e293b" strokeDasharray="4" />

                {/* Path */}
                <path
                  d="M 0,60 Q 70,80 140,50 T 280,35 T 400,25 L 500,18"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                />
                <path
                  d="M 0,60 Q 70,80 140,50 T 280,35 T 400,25 L 500,18 L 500,120 L 0,120 Z"
                  fill="url(#profitGrad)"
                />

                {/* Points */}
                <circle cx="140" cy="50" r="4" fill="#34d399" />
                <circle cx="280" cy="35" r="4" fill="#34d399" />
                <circle cx="400" cy="25" r="4" fill="#34d399" />
                <circle cx="500" cy="18" r="5" fill="#10b981" />
              </svg>
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Trade 1</span>
              <span>Trade 10</span>
              <span>Trade 25</span>
              <span>Latest Trade</span>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: STRATEGY YIELD ================= */}
      {tab === "strategy" && (
        <div className="space-y-6">
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white">Strategy Alpha Comparison</h3>
            <p className="text-xs text-slate-400">Yield and risk metrics across quant strategy profiles</p>

            <div className="space-y-3 pt-2">
              {[
                { name: "Kelly Conservative Core", edge: "+16.8% Yield", trades: 412, win: "44.2%", bar: "85%" },
                { name: "High Overlay Value Hunter", edge: "+24.5% Yield", trades: 280, win: "31.8%", bar: "95%" },
                { name: "Metro Jockey Synergy", edge: "+12.2% Yield", trades: 520, win: "38.5%", bar: "65%" },
                { name: "Front-Runner Pace Bias", edge: "+14.1% Yield", trades: 345, win: "36.4%", bar: "72%" }
              ].map((s, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <strong className="text-white text-sm">{s.name}</strong>
                    <span className="font-mono font-black text-emerald-400">{s.edge}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: s.bar }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Sample: {s.trades} trades</span>
                    <span>Strike Rate: {s.win}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: ML CALIBRATION ================= */}
      {tab === "ml" && (
        <div className="space-y-6">
          {/* Calibration Table & Reliability Curve */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">XGBoost Probabilistic Calibration</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Predicted winning probability buckets vs observed win frequency
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Brier Score: 0.182 (Strong)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px]">
                    <th className="py-2">Bucket</th>
                    <th className="py-2">Sample Count</th>
                    <th className="py-2">Mean Forecast</th>
                    <th className="py-2">Observed Rate</th>
                    <th className="py-2">Reliability Deviation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {MOCK_CALIBRATION_BUCKETS.map((b, idx) => {
                    const dev = Math.abs(b.avg_predicted - b.observed_rate) * 100;
                    return (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-2.5 font-bold text-white">{b.bucket}</td>
                        <td className="py-2.5 text-slate-300">{b.count} events</td>
                        <td className="py-2.5 text-cyan-400">{(b.avg_predicted * 100).toFixed(1)}%</td>
                        <td className="py-2.5 text-emerald-400">{(b.observed_rate * 100).toFixed(1)}%</td>
                        <td className="py-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                            &plusmn;{dev.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Feature Importance Weights */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white">Global Feature Importance (SHAP Normalized)</h3>
            <div className="space-y-3 pt-2">
              {MOCK_FEATURE_IMPORTANCE.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">{item.feature}</span>
                    <span className="text-cyan-400 font-mono">{(item.importance * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="bg-cyan-500 h-full rounded-full"
                      style={{ width: `${item.importance * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
