"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  Layers,
  BarChart3,
  Percent,
  RefreshCw,
  Clock,
  Sparkles,
} from "lucide-react";
import { API_BASE, safeResponseJson } from "../../app/lib/api";
import { useAuth } from "../../app/providers/AuthProvider";
import { NoData } from "../common/EmptyStates";

interface SlipLegPostMortem {
  id: string;
  sport: string;
  gameId: string;
  marketType: string;
  selection: string;
  line: number | null;
  odds: number;
  fairOdds: number | null;
  status: "PENDING" | "WON" | "LOST" | "VOID";
  resultValue: number | null;
  outcomeDiff: number | null;
  clvPct: number | null;
  beatCLV: boolean;
  isWeakestLeg: boolean;
  rationale?: string | null;
}

interface SlipPostMortemData {
  id: string;
  name: string;
  slipType: string;
  status: string;
  combinedOdds: number;
  actualStake: number | null;
  settledAt: string | null;
  shareCode: string | null;
  wonLegs: number;
  lostLegs: number;
  totalLegs: number;
  postMortemDiagnosis: string;
  legs: SlipLegPostMortem[];
}

interface RoiBreakdownItem {
  category: string;
  staked: number;
  payout: number;
  netProfit: number;
  roiPct: number;
  betsPlaced: number;
  wins: number;
  winRatePct: number;
}

interface RoiAnalyticsData {
  summary: {
    totalSlips: number;
    wonSlips: number;
    lostSlips: number;
    voidSlips: number;
    winRatePct: number;
    totalStaked: number;
    totalPayout: number;
    netProfit: number;
    overallRoiPct: number;
    clvBeatRatePct: number;
  } | null;
  byLegType: RoiBreakdownItem[];
  bySport: RoiBreakdownItem[];
  byMarket: RoiBreakdownItem[];
}

interface SlipPostMortemModalProps {
  isOpen: boolean;
  onClose: () => void;
  slipId?: string;
}

export function SlipPostMortemModal({ isOpen, onClose, slipId }: SlipPostMortemModalProps) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<"slip" | "analytics">("slip");
  const [loading, setLoading] = useState(true);
  const [slipData, setSlipData] = useState<SlipPostMortemData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<RoiAnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(token && token !== "guest" ? { Authorization: `Bearer ${token}` } : {}),
        };

        // Fetch ROI history analytics
        const roiPromise = fetch(`${API_BASE}/slips/history/roi-breakdown`, { headers });

        // Fetch specific slip post-mortem if slipId provided, or recent settled slip
        let slipPromise = Promise.resolve(null as any);
        if (slipId) {
          slipPromise = fetch(`${API_BASE}/slips/${slipId}/post-mortem`, { headers });
        } else {
          // Find first settled slip
          const listRes = await fetch(`${API_BASE}/slips`, { headers });
          if (listRes.ok) {
            const listData = await safeResponseJson(listRes);
            const settled = (listData?.slips || []).find((s: any) => s.status !== "DRAFT");
            if (settled) {
              slipPromise = fetch(`${API_BASE}/slips/${settled.id}/post-mortem`, { headers });
            }
          }
        }

        const [roiRes, slipRes] = await Promise.all([roiPromise, slipPromise]);

        if (isMounted) {
          if (roiRes && roiRes.ok) {
            const roiJson = await safeResponseJson(roiRes);
            setAnalyticsData(roiJson);
          }

          if (slipRes && slipRes.ok) {
            const slipJson = await safeResponseJson(slipRes);
            if (slipJson?.slip) {
              setSlipData(slipJson.slip);
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "Failed to load post-mortem analytics");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, slipId, token]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Settled Multi Post-Mortem & ROI Analytics
              </h2>
              <p className="text-xs text-slate-400">
                Quantitative outcome attribution, Closing Line Value (CLV), and historical edge audit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("slip")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "slip"
                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Slip Post-Mortem (Leg Tracking)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "analytics"
                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>ROI Breakdown by Leg Type & Market</span>
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <p className="text-sm">Calculating post-mortem attribution and historical ROI...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm">
              {error}
            </div>
          ) : activeTab === "slip" ? (
            slipData ? (
              <div className="space-y-6">
                {/* Slip Summary Banner */}
                <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="font-bold text-white text-base">{slipData.name}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {slipData.slipType}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          slipData.status === "WON"
                            ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700"
                            : slipData.status === "LOST"
                            ? "bg-rose-950/80 text-rose-300 border border-rose-700"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {slipData.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Combined Odds: <span className="text-white font-semibold">${slipData.combinedOdds.toFixed(2)}</span>
                      {slipData.actualStake ? ` • Stake: $${slipData.actualStake.toFixed(2)}` : ""}
                      {slipData.shareCode ? ` • Code: ${slipData.shareCode}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Legs Hit</span>
                      <span className="text-sm font-bold text-white">
                        {slipData.wonLegs} / {slipData.totalLegs}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quantitative Post-Mortem Diagnosis */}
                <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-1">
                      Algorithmic Post-Mortem Diagnosis
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {slipData.postMortemDiagnosis}
                    </p>
                  </div>
                </div>

                {/* Leg by Leg Tracking Cards */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Leg-by-Leg Execution & Line Outcome
                  </h4>

                  {slipData.legs.map((leg, idx) => {
                    const isWon = leg.status === "WON";
                    const isLost = leg.status === "LOST";

                    return (
                      <div
                        key={leg.id || idx}
                        className={`p-4 rounded-xl border transition-all ${
                          isWon
                            ? "bg-slate-900/60 border-emerald-900/40"
                            : isLost
                            ? "bg-slate-900/60 border-rose-900/40"
                            : "bg-slate-900/40 border-slate-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              {isWon ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                              ) : isLost ? (
                                <XCircle className="w-5 h-5 text-rose-400" />
                              ) : (
                                <Clock className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-semibold text-sm text-white">{leg.selection}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                                  {leg.sport.toUpperCase()}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                                  {leg.marketType}
                                </span>
                                {leg.isWeakestLeg && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800">
                                    Flagged Weakest Leg
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 flex-wrap">
                                <span>
                                  Odds: <strong className="text-slate-200">${leg.odds.toFixed(2)}</strong>
                                </span>
                                {leg.line !== null && (
                                  <span>
                                    Line: <strong className="text-slate-200">{leg.line}</strong>
                                  </span>
                                )}
                                {leg.resultValue !== null && (
                                  <span>
                                    Actual Result:{" "}
                                    <strong className={isWon ? "text-emerald-400" : "text-rose-400"}>
                                      {leg.resultValue}
                                    </strong>
                                    {leg.outcomeDiff !== null && (
                                      <span className="ml-1 text-slate-400">
                                        ({leg.outcomeDiff > 0 ? `+${leg.outcomeDiff}` : leg.outcomeDiff})
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* CLV badge */}
                          {leg.clvPct !== null && (
                            <div className="text-right shrink-0">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                                  leg.beatCLV
                                    ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/60"
                                    : "bg-slate-800 text-slate-400 border-slate-700"
                                }`}
                              >
                                {leg.beatCLV ? (
                                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <TrendingDown className="w-3 h-3 text-slate-400" />
                                )}
                                <span>CLV {leg.clvPct > 0 ? `+${leg.clvPct}%` : `${leg.clvPct}%`}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <NoData
                title="No Settled Slips Found"
                message="Settled slips and leg-by-leg outcomes appear here once sporting events conclude."
                statusLabel="Awaiting Settled Slip"
              />
            )
          ) : analyticsData?.summary ? (
            <div className="space-y-6">
              {/* ROI Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Overall ROI</span>
                  <span
                    className={`text-xl font-bold ${
                      analyticsData.summary.overallRoiPct >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {analyticsData.summary.overallRoiPct > 0 ? "+" : ""}
                    {analyticsData.summary.overallRoiPct}%
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Win Rate</span>
                  <span className="text-xl font-bold text-white">
                    {analyticsData.summary.winRatePct}%
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {analyticsData.summary.wonSlips} of {analyticsData.summary.totalSlips} slips
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">CLV Beat Rate</span>
                  <span className="text-xl font-bold text-cyan-400">
                    {analyticsData.summary.clvBeatRatePct}%
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">legs beat closing price</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Net P&L</span>
                  <span
                    className={`text-xl font-bold ${
                      analyticsData.summary.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {analyticsData.summary.netProfit >= 0 ? "+$" : "-$"}
                    {Math.abs(analyticsData.summary.netProfit).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* By Leg Type Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>ROI Breakdown by Leg Type</span>
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Leg Type</th>
                        <th className="py-2.5 px-3 font-semibold">Bets</th>
                        <th className="py-2.5 px-3 font-semibold">Win Rate</th>
                        <th className="py-2.5 px-3 font-semibold">Staked</th>
                        <th className="py-2.5 px-3 font-semibold">Profit</th>
                        <th className="py-2.5 px-4 font-semibold text-right">ROI %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {analyticsData.byLegType.map((row) => (
                        <tr key={row.category} className="hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-medium text-white">{row.category}</td>
                          <td className="py-3 px-3 text-slate-400">{row.betsPlaced}</td>
                          <td className="py-3 px-3 text-slate-300">{row.winRatePct}%</td>
                          <td className="py-3 px-3 text-slate-400">${row.staked.toFixed(2)}</td>
                          <td
                            className={`py-3 px-3 font-semibold ${
                              row.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {row.netProfit >= 0 ? "+$" : "-$"}
                            {Math.abs(row.netProfit).toFixed(2)}
                          </td>
                          <td
                            className={`py-3 px-4 font-bold text-right ${
                              row.roiPct >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {row.roiPct > 0 ? "+" : ""}
                            {row.roiPct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* By Sport Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />
                  <span>ROI Breakdown by Sport</span>
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Sport</th>
                        <th className="py-2.5 px-3 font-semibold">Legs</th>
                        <th className="py-2.5 px-3 font-semibold">Win Rate</th>
                        <th className="py-2.5 px-3 font-semibold">Profit</th>
                        <th className="py-2.5 px-4 font-semibold text-right">ROI %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {analyticsData.bySport.map((row) => (
                        <tr key={row.category} className="hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-medium text-white">{row.category}</td>
                          <td className="py-3 px-3 text-slate-400">{row.betsPlaced}</td>
                          <td className="py-3 px-3 text-slate-300">{row.winRatePct}%</td>
                          <td
                            className={`py-3 px-3 font-semibold ${
                              row.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {row.netProfit >= 0 ? "+$" : "-$"}
                            {Math.abs(row.netProfit).toFixed(2)}
                          </td>
                          <td
                            className={`py-3 px-4 font-bold text-right ${
                              row.roiPct >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {row.roiPct > 0 ? "+" : ""}
                            {row.roiPct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <NoData
              title="No Settled Slips Recorded"
              message="ROI analytics by leg type, sport, and market are computed from settled slips in your paper bankroll history."
              statusLabel="Awaiting Settled History"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default SlipPostMortemModal;
