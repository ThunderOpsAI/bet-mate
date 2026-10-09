"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DollarSign, Shield, Zap, Sparkles, Sliders, Check } from "lucide-react";
import { API_BASE, safeResponseJson } from "../../lib/api";

export interface KellyStakeControlProps {
  combinedOdds: number;
  trueProb: number;
  bankroll?: number;
  currentStake: number;
  onApplyStake: (stake: number) => void;
  className?: string;
}

export default function KellyStakeControl({
  combinedOdds,
  trueProb,
  bankroll = 10000,
  currentStake,
  onApplyStake,
  className = "",
}: KellyStakeControlProps) {
  // Slider: 0 = Safer (0.10x Kelly), 50 = Balanced (0.25x Kelly), 100 = Bigger (0.50x Kelly)
  const [sliderValue, setSliderValue] = useState<number>(50);
  const [recommendedStake, setRecommendedStake] = useState<number>(0);
  const [isPositiveEv, setIsPositiveEv] = useState<boolean>(true);
  const [rationale, setRationale] = useState<string>("");
  const [applied, setApplied] = useState<boolean>(false);

  // Map slider value (0-100) to fraction (0.10 to 0.50)
  const fraction = 0.10 + (sliderValue / 100) * 0.40;

  const calculateClientKelly = useCallback(
    (odds: number, prob: number, roll: number, frac: number) => {
      if (odds <= 1 || prob <= 0 || roll <= 0) return { stake: 0, pos: false, text: "Invalid parameters" };
      const edge = prob * odds - 1.0;
      if (edge <= 0) {
        return {
          stake: 0,
          pos: false,
          text: `Negative EV (${(edge * 100).toFixed(1)}%). Kelly recommends $0.00.`,
        };
      }
      const rawKelly = edge / (odds - 1.0);
      const adjKelly = Math.min(rawKelly * frac, 0.05); // cap at 5% of roll
      const rawStake = Math.round(roll * adjKelly * 100) / 100;
      const finalStake = rawStake < 1.0 ? (rawStake > 0 ? 1.0 : 0) : rawStake;
      return {
        stake: finalStake,
        pos: true,
        text: `Fractional Kelly (${frac.toFixed(2)}x) suggests $${finalStake.toFixed(2)} based on +${(edge * 100).toFixed(1)}% EV.`,
      };
    },
    [],
  );

  useEffect(() => {
    let isCancelled = false;

    async function fetchOrComputeKelly() {
      if (combinedOdds <= 1 || trueProb <= 0) {
        setRecommendedStake(0);
        setIsPositiveEv(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/recommendations/kelly-stake`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            combined_odds: combinedOdds,
            true_prob: trueProb,
            bankroll,
            fraction,
            max_stake_pct: 0.05,
            min_stake: 1.0,
          }),
        });

        if (res.ok && !isCancelled) {
          const data = await safeResponseJson(res);
          if (data && typeof data.recommended_stake === "number") {
            setRecommendedStake(data.recommended_stake);
            setIsPositiveEv(data.is_positive_ev ?? (data.edge_pct > 0));
            setRationale(data.rationale || "");
            return;
          }
        }
      } catch {}

      // Graceful client fallback
      if (!isCancelled) {
        const local = calculateClientKelly(combinedOdds, trueProb, bankroll, fraction);
        setRecommendedStake(local.stake);
        setIsPositiveEv(local.pos);
        setRationale(local.text);
      }
    }

    fetchOrComputeKelly();

    return () => {
      isCancelled = true;
    };
  }, [combinedOdds, trueProb, bankroll, fraction, calculateClientKelly]);

  const handleApply = () => {
    if (recommendedStake > 0) {
      onApplyStake(recommendedStake);
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    }
  };

  const profileLabel =
    sliderValue <= 30 ? "Safer / High Hit Rate" : sliderValue >= 70 ? "Bigger / High Payout" : "Balanced";

  return (
    <div className={`p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 ${className}`}>
      {/* Top Kelly Suggestion Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-400" />
          <span className="text-xs font-bold text-slate-200">Kelly Stake Sizing</span>
        </div>

        <button
          type="button"
          onClick={handleApply}
          disabled={recommendedStake <= 0}
          className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
            applied
              ? "bg-emerald-500 text-slate-950"
              : isPositiveEv && recommendedStake > 0
                ? "bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40"
                : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
          }`}
          title={rationale}
        >
          {applied ? (
            <>
              <Check size={13} />
              <span>Applied</span>
            </>
          ) : (
            <>
              <DollarSign size={13} />
              <span>Kelly: ${recommendedStake > 0 ? recommendedStake.toFixed(2) : "0.00"}</span>
            </>
          )}
        </button>
      </div>

      {/* Safer / Bigger Odds Slider */}
      <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 text-slate-400">
            <Sliders size={12} className="text-slate-500" />
            <span>Profile: <strong className="text-slate-200">{profileLabel}</strong></span>
          </span>
          <span className="text-slate-500 font-mono text-[10px]">
            {fraction.toFixed(2)}x Kelly
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-emerald-400 shrink-0 flex items-center gap-0.5">
            <Shield size={10} /> Safer
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={sliderValue}
            onChange={(e) => setSliderValue(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
          />
          <span className="text-[10px] uppercase font-bold text-amber-400 shrink-0 flex items-center gap-0.5">
            Bigger <Zap size={10} />
          </span>
        </div>
      </div>
    </div>
  );
}
