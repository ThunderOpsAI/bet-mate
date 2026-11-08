"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import {
  Sparkles,
  Sliders,
  Plus,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Percent,
  CheckCircle2,
  Calendar,
  Clock,
  ChevronRight,
  Trophy,
  Zap,
} from "lucide-react";
import { usePaperBetslip } from "../../providers/PaperBetslipProvider";

export interface MultiLeg {
  sport: string;
  event_id: string;
  event_name: string;
  market_type: string;
  selection: string;
  odds_used: number;
  odds_source: string;
  model_probability: number;
  edge: number;
  confidence: string;
  start_time?: string;
}

export interface RecommendedMulti {
  id: string;
  event_id: string;
  event_name: string;
  market_type: string;
  selection: string;
  odds: number;
  true_prob: number;
  model_probability: number;
  edge: number;
  expected_value: number;
  confidence: "high" | "medium" | "low";
  legs: MultiLeg[];
  win_legs_count: number;
  place_legs_count: number;
  writeup: string;
}

export interface BoosterLeg {
  sport: string;
  event_id: string;
  event_name: string;
  market_type: string;
  selection: string;
  odds: number;
  model_probability: number;
  edge: number;
  confidence: string;
  start_time?: string;
  boost_odds: number;
  boost_edge: number;
  recommendation_reason: string;
}

export default function SmartMultiHub() {
  const { addBet, addToast } = usePaperBetslip();

  // Formula Controls
  const [winLegs, setWinLegs] = useState<number>(1);
  const [placeLegs, setPlaceLegs] = useState<number>(2);
  const [sportMode, setSportMode] = useState<"combined" | "racing_only" | "sport_only">("combined");
  const [targetMinOdds, setTargetMinOdds] = useState<number>(3.0);
  const [targetMaxOdds, setTargetMaxOdds] = useState<number>(20.0);
  const [afterTime, setAfterTime] = useState<string>("");

  // Recommendations State
  const [multis, setMultis] = useState<RecommendedMulti[]>([]);
  const [boosterLegs, setBoosterLegs] = useState<BoosterLeg[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [addedMultiId, setAddedMultiId] = useState<string | null>(null);

  // Fetch recommendations from API
  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/multis/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          win_legs: winLegs,
          place_legs: placeLegs,
          sport_mode: sportMode,
          min_odds: targetMinOdds,
          max_odds: targetMaxOdds,
          after_time: afterTime || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to load multis (${response.status})`);
      }

      const data = await response.json();
      setMultis(data.multis || []);
      setBoosterLegs(data.booster_legs || []);
    } catch (err: any) {
      console.error("Smart Multi fetch error:", err);
      setError("Unable to generate multis for this configuration. Try broadening your criteria.");
      setMultis([]);
      setBoosterLegs([]);
    } finally {
      setIsLoading(false);
    }
  }, [winLegs, placeLegs, sportMode, targetMinOdds, targetMaxOdds, afterTime]);

  // Debounce slider & stepper changes (200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecommendations();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchRecommendations]);

  // 1-Click Add Multi to Paper Betslip
  const handleAddMultiToSlip = (multi: RecommendedMulti) => {
    multi.legs.forEach((leg, idx) => {
      addBet(
        {
          sport: leg.sport,
          event_id: leg.event_id,
          event_name: leg.event_name,
          selection: leg.selection,
          bet_type: leg.market_type === "place" ? "PLACE" : "WIN",
          market_type: leg.market_type,
          odds: leg.odds_used,
          stake: 10,
          model_prob: leg.model_probability,
          model_edge_pct: Math.round(leg.edge * 1000) / 10,
          confidence: (leg.confidence as "high" | "medium" | "low") || "medium",
          notes: `Leg ${idx + 1} of ${multi.win_legs_count}W + ${multi.place_legs_count}P Multi ($${multi.odds.toFixed(2)})`,
        },
        { openBetslip: false }
      );
    });

    setAddedMultiId(multi.id);
    addToast(`Added ${multi.legs.length}-leg Multi ($${multi.odds.toFixed(2)}) to Paper Slip`, "success");
    setTimeout(() => setAddedMultiId(null), 3000);
  };

  // 1-Click Add Single Booster Leg
  const handleAddBoosterLeg = (leg: BoosterLeg) => {
    addBet(
      {
        sport: leg.sport,
        event_id: leg.event_id,
        event_name: leg.event_name,
        selection: leg.selection,
        bet_type: leg.market_type === "place" ? "PLACE" : "WIN",
        market_type: leg.market_type,
        odds: leg.odds,
        stake: 10,
        model_prob: leg.model_probability,
        model_edge_pct: Math.round(leg.edge * 1000) / 10,
        confidence: (leg.confidence as "high" | "medium" | "low") || "medium",
        notes: `Smart Booster: ${leg.recommendation_reason}`,
      },
      { openBetslip: true }
    );
    addToast(`Added booster leg: ${leg.selection} to slip`, "success");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Dynamic Formula Control Panel */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-purple-950/20 border border-slate-800 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Multi Formula Studio</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Live EV Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Tune your multi mix: Anchor high-conviction wins with high-yield place roughies
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchRecommendations}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all flex items-center gap-1.5"
          >
            <Zap className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-purple-400" : "text-yellow-400"}`} />
            <span>Re-Roll</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Win Legs Stepper */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Win Anchors
              </label>
              <span className="text-sm font-extrabold text-white px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                {winLegs} {winLegs === 1 ? "Leg" : "Legs"}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              {[0, 1, 2, 3].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setWinLegs(val)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    winLegs === val
                      ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                      : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Top-ranked straight winners</p>
          </div>

          {/* Place Legs Stepper */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-purple-400">
                Place Roughies
              </label>
              <span className="text-sm font-extrabold text-white px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                {placeLegs} {placeLegs === 1 ? "Leg" : "Legs"}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              {[0, 1, 2, 3, 4].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPlaceLegs(val)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    placeLegs === val
                      ? "bg-purple-500 text-white shadow-md shadow-purple-500/20"
                      : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Henery-calibrated place EV picks</p>
          </div>

          {/* Sport Mix Selector */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Sport Mix
              </label>
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              {[
                { id: "combined", label: "Combined (Sport + Race)" },
                { id: "racing_only", label: "Racing Only" },
                { id: "sport_only", label: "Sports Only (NBA/NFL/AFL)" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSportMode(opt.id as any)}
                  className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sportMode === opt.id
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Odds Range Slider */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Target Odds
                </label>
                <span className="text-xs font-extrabold text-amber-300 font-mono">
                  ${targetMinOdds.toFixed(1)} – ${targetMaxOdds >= 50 ? "50+" : targetMaxOdds.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={2.5}
                max={50}
                step={2.5}
                value={targetMaxOdds}
                onChange={(e) => setTargetMaxOdds(parseFloat(e.target.value))}
                className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer mt-3"
              />
            </div>
            <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-800/60">
              {[
                { min: 2.5, max: 7.5, label: "$3–$7" },
                { min: 5.0, max: 15.0, label: "$5–$15" },
                { min: 10.0, max: 30.0, label: "$10–$30" },
                { min: 20.0, max: 50.0, label: "$20–$50+" },
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setTargetMinOdds(preset.min);
                    setTargetMaxOdds(preset.max);
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-bold ${
                    targetMaxOdds === preset.max
                      ? "bg-amber-400 text-slate-950"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Recommended Strategic Multis */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h3 className="text-base font-extrabold text-white tracking-tight">
              Top Recommended Multis
            </h3>
            <span className="text-xs text-slate-400">
              (Ranked by Combined Edge & True Model Probability)
            </span>
          </div>
          {isLoading && (
            <span className="text-xs text-purple-400 animate-pulse font-medium">
              Calculating optimal formulas...
            </span>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            {error}
          </div>
        )}

        {!isLoading && multis.length === 0 && !error && (
          <div className="p-8 rounded-2xl bg-slate-900/30 border border-slate-800 text-center">
            <p className="text-sm text-slate-400">
              No multis matched this exact formula combination. Try adjusting the Win or Place steppers or expanding the odds slider.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {multis.map((multi, idx) => {
            const isAdded = addedMultiId === multi.id;
            return (
              <div
                key={multi.id}
                className="relative flex flex-col justify-between rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-purple-500/40 transition-all p-5 shadow-lg group hover:shadow-purple-950/20"
              >
                <div>
                  {/* Multi Header Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wide">
                      Option #{idx + 1} • {multi.legs.length} Legs
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      +{Math.round(multi.edge * 1000) / 10}% Edge
                    </span>
                  </div>

                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-4 text-center">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Odds</p>
                      <p className="text-base font-extrabold text-white font-mono">
                        ${multi.odds.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">True Prob</p>
                      <p className="text-base font-extrabold text-cyan-300 font-mono">
                        {(multi.true_prob * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Exp. Value</p>
                      <p className="text-base font-extrabold text-emerald-300 font-mono">
                        {multi.expected_value >= 0 ? "+" : ""}
                        {(multi.expected_value * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Legs Breakdown */}
                  <div className="space-y-2 mb-4">
                    {multi.legs.map((leg, legIdx) => {
                      const isPlace = leg.market_type === "place";
                      return (
                        <div
                          key={legIdx}
                          className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                  isPlace
                                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                }`}
                              >
                                {isPlace ? "Place" : "Win"}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                {leg.sport}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-100 truncate">
                              {leg.selection}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {leg.event_name}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-mono font-extrabold text-white">
                              ${leg.odds_used.toFixed(2)}
                            </p>
                            <p className="text-[10px] text-emerald-400 font-mono">
                              +{Math.round(leg.edge * 100)}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 1-Click Action Button */}
                <button
                  type="button"
                  onClick={() => handleAddMultiToSlip(multi)}
                  disabled={isAdded}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isAdded
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default"
                      : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-900/40"
                  }`}
                >
                  {isAdded ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Added to Paper Slip!</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Add Multi to Paper Slip</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Complementary Booster Legs Shelf */}
      {boosterLegs.length > 0 && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-extrabold text-white tracking-tight uppercase">
                Complementary Booster Legs
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              High-EV individual anchors & roughies to amplify your slip
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {boosterLegs.slice(0, 6).map((leg, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                        leg.market_type === "place"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {leg.market_type}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">
                      {leg.sport}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-white truncate">{leg.selection}</p>
                  <p className="text-[10px] text-slate-400 truncate">{leg.event_name}</p>
                  <p className="text-[10px] text-amber-300 mt-1 font-medium truncate">
                    {leg.recommendation_reason}
                  </p>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-xs font-bold font-mono text-white">${leg.odds.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => handleAddBoosterLeg(leg)}
                    className="p-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 transition-all cursor-pointer"
                    title="Add leg to slip"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
