"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  TrendingUp,
  Activity,
  Layers,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Scale,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { API_BASE, safeResponseJson } from "../lib/api";
import { NoData } from "../../components/common/EmptyStates";

interface CalibrationBin {
  bin: string;
  predicted: number;
  actual: number;
  difference: number;
}

interface ModelTrackRecordItem {
  id: string;
  sport: string;
  modelVariant: string;
  evalDate: string;
  sampleSize: number;
  brierScore: number | null;
  calibrationJson: any;
  simulatedRoi: number;
  actualRoi: number | null;
}

interface TrackRecordSummary {
  totalEvaluations: number;
  totalSampleSize: number;
  weightedBrierScore: number | null;
  averageSimulatedRoi: number;
  averageActualRoi: number | null;
}

export default function TrackRecordPage() {
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState("ALL");
  const [summary, setSummary] = useState<TrackRecordSummary | null>(null);
  const [calibrationCurve, setCalibrationCurve] = useState<CalibrationBin[]>([]);
  const [records, setRecords] = useState<ModelTrackRecordItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchTrackRecord = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sportFilter !== "ALL") params.append("sport", sportFilter);

      const res = await fetch(`${API_BASE}/trust/track-record?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load model track record");
      }

      const json = await safeResponseJson(res);
      if (json && json.status === "ok") {
        setSummary(json.summary);
        setCalibrationCurve(json.calibrationCurve || []);
        setRecords(json.trackRecords || []);
      } else {
        setSummary(null);
        setCalibrationCurve([]);
        setRecords([]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load track record");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTrackRecord();
  }, [sportFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 animate-fade-in">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold tracking-wider uppercase mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Public Model Trust &amp; Verification</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Model Track Record &amp; Probability Calibration
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Sport Filter */}
          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Sports &amp; Models</option>
            <option value="NBA">NBA Prop Sim</option>
            <option value="AFL">AFL Correlation Copula</option>
            <option value="RACING">Racing Harville</option>
          </select>

          <button
            type="button"
            onClick={fetchTrackRecord}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh track record"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Transparency Mission Statement Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
            <span>Zero Survivorship Bias. Full Quantitative Transparency.</span>
          </h3>
          <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
            BetMate publishes mathematical verification metrics including Brier calibration curves, simulated backtest yields, and out-of-sample closing line value. Every prediction is permanently logged prior to event start.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-700 text-xs text-emerald-300 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Real-time Audited</span>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
          {error}
        </div>
      ) : summary ? (
        <div className="space-y-8">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Evaluated Sample Size
              </span>
              <span className="text-2xl font-black text-white font-mono">
                {summary.totalSampleSize.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Across {summary.totalEvaluations} model test runs
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Weighted Brier Score
              </span>
              <span className="text-2xl font-black text-cyan-400 font-mono">
                {summary.weightedBrierScore !== null ? summary.weightedBrierScore.toFixed(4) : "N/A"}
              </span>
              <span className="text-[10px] text-cyan-500/80 block mt-0.5">
                Benchmark: &lt; 0.20 is strong calibration
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Simulated Model ROI
              </span>
              <span
                className={`text-2xl font-black font-mono ${
                  summary.averageSimulatedRoi >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {summary.averageSimulatedRoi > 0 ? "+" : ""}
                {summary.averageSimulatedRoi}%
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Optimal fractional Kelly staking
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Actual Realized ROI
              </span>
              <span
                className={`text-2xl font-black font-mono ${
                  summary.averageActualRoi !== null && summary.averageActualRoi >= 0
                    ? "text-emerald-400"
                    : "text-white"
                }`}
              >
                {summary.averageActualRoi !== null
                  ? `${summary.averageActualRoi > 0 ? "+" : ""}${summary.averageActualRoi}%`
                  : "Tracking"}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Settled live paper bankroll
              </span>
            </div>
          </div>

          {/* Probability Calibration Curve Section */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  <span>Probability Calibration Curve (Predicted vs. Actual Win Rate)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  A perfectly calibrated model has identical predicted probability and actual realized frequency (45° line).
                </p>
              </div>
            </div>

            {calibrationCurve.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {calibrationCurve.map((bin) => {
                  const predPct = Math.round(bin.predicted * 100);
                  const actPct = Math.round(bin.actual * 100);
                  const delta = Math.round(bin.difference * 100);

                  return (
                    <div
                      key={bin.bin}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{bin.bin} Bin</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            Math.abs(delta) <= 3
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : "bg-amber-950 text-amber-300 border border-amber-800"
                          }`}
                        >
                          {delta > 0 ? `+${delta}%` : `${delta}%`} error
                        </span>
                      </div>

                      {/* Bar comparison */}
                      <div className="space-y-2 text-xs">
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                            <span>Predicted Prob</span>
                            <span className="font-mono text-cyan-400 font-bold">{predPct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-cyan-400 rounded-full"
                              style={{ width: `${predPct}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                            <span>Actual Hit Rate</span>
                            <span className="font-mono text-emerald-400 font-bold">{actPct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 rounded-full"
                              style={{ width: `${actPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <NoData
                title="Awaiting Probability Bins"
                message="Calibration curves render once sufficient evaluated predictions are recorded in ModelPerformance."
                statusLabel="Awaiting Calibration Bins"
              />
            )}
          </div>

          {/* Model Performance Evaluation History Table */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Evaluation Runs Log ({records.length})</span>
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Eval Date</th>
                    <th className="py-2.5 px-3 font-semibold">Sport</th>
                    <th className="py-2.5 px-3 font-semibold">Model Variant</th>
                    <th className="py-2.5 px-3 font-semibold">Sample (N)</th>
                    <th className="py-2.5 px-3 font-semibold">Brier Score</th>
                    <th className="py-2.5 px-3 font-semibold">Simulated ROI</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actual ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {new Date(r.evalDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 font-bold text-white">{r.sport}</td>
                      <td className="py-3 px-3 font-mono text-cyan-400">{r.modelVariant}</td>
                      <td className="py-3 px-3 text-slate-300 font-mono">{r.sampleSize}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {r.brierScore !== null ? r.brierScore.toFixed(4) : "—"}
                      </td>
                      <td
                        className={`py-3 px-3 font-bold font-mono ${
                          r.simulatedRoi >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {r.simulatedRoi > 0 ? "+" : ""}
                        {r.simulatedRoi}%
                      </td>
                      <td
                        className={`py-3 px-4 font-bold font-mono text-right ${
                          r.actualRoi !== null && r.actualRoi >= 0 ? "text-emerald-400" : "text-slate-400"
                        }`}
                      >
                        {r.actualRoi !== null ? `${r.actualRoi > 0 ? "+" : ""}${r.actualRoi}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mathematical Foundations Explainer */}
          <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4">
            <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4" />
              <span>Quantitative Foundations &amp; Evaluation Philosophy</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <strong className="text-white block mb-1">Brier Score Calibration</strong>
                Strict strictly proper scoring rule that penalizes overconfident predictions. Sub-0.20 Brier scores signify statistical edge over closing market prices.
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <strong className="text-white block mb-1">Fractional Kelly (0.25x)</strong>
                Staking sized proportionally to quantified edge divided by decimal odds, scaled to a 25% fraction to curb maximum drawdown.
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <strong className="text-white block mb-1">Closing Line Value (CLV)</strong>
                The true north metric of sports wagering: consistently beating the final bookmaker consensus price guarantees mathematical long-term expectation.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <NoData
          title="No Model Performance Evaluations Recorded"
          message="Public calibration curves and Brier scores will populate automatically upon completion of the scheduled backtest calibration run."
          statusLabel="Awaiting Model Backtest Run"
          onRefresh={fetchTrackRecord}
        />
      )}
    </div>
  );
}
