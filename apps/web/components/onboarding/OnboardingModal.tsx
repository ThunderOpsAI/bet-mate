"use client";

import React, { useState, useEffect } from "react";
import { Check, Shield, Flame, Target, Trophy, ArrowRight, ArrowLeft, X, Sparkles } from "lucide-react";
import { API_BASE, safeResponseJson } from "../../app/lib/api";
import { useAuth } from "../../app/providers/AuthProvider";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

const AVAILABLE_SPORTS = [
  { id: "NBA", name: "NBA Basketball", emoji: "🏀" },
  { id: "AFL", name: "AFL Australian Rules", emoji: "🏉" },
  { id: "NRL", name: "NRL Rugby League", emoji: "🏉" },
  { id: "RACING", name: "Thoroughbred Racing", emoji: "🏇" },
  { id: "SOCCER", name: "EPL / World Soccer", emoji: "⚽" },
  { id: "MMA", name: "MMA / UFC", emoji: "🥊" },
  { id: "TENNIS", name: "ATP / WTA Tennis", emoji: "🎾" },
];

const POPULAR_TEAMS: Record<string, string[]> = {
  NBA: ["Lakers", "Celtics", "Warriors", "Mavericks", "Nuggets", "Knicks", "Thunder"],
  AFL: ["Collingwood", "Brisbane Lions", "Carlton", "Geelong", "Sydney Swans", "Melbourne"],
  NRL: ["Penrith Panthers", "Brisbane Broncos", "Melbourne Storm", "Sydney Roosters", "Rabbitohs"],
  SOCCER: ["Arsenal", "Man City", "Liverpool", "Real Madrid", "Barcelona"],
};

export function OnboardingModal({ isOpen, onClose, onCompleted }: OnboardingModalProps) {
  const { token } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSports, setSelectedSports] = useState<string[]>(["NBA", "AFL"]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [riskTolerance, setRiskTolerance] = useState<"SAFE" | "BALANCED" | "LONG_SHOT">("BALANCED");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleSport = (sportId: string) => {
    setSelectedSports((prev) =>
      prev.includes(sportId) ? prev.filter((s) => s !== sportId) : [...prev, sportId]
    );
  };

  const toggleTeam = (team: string) => {
    setSelectedTeams((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/user-preferences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && token !== "guest" ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sports: selectedSports,
          favoriteTeams: selectedTeams,
          riskTolerance,
          onboarded: true,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save preferences");
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("betmate_user_onboarded", "true");
      }

      onCompleted?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save preferences. Please retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header with progress */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">Welcome to BetMate</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step progress bar */}
        <div className="px-6 pt-4 pb-2 bg-slate-950/30 flex items-center justify-between">
          <div className="flex items-center gap-3 w-full">
            <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? "bg-cyan-500" : "bg-slate-800"}`} />
            <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? "bg-cyan-500" : "bg-slate-800"}`} />
            <div className={`flex-1 h-1.5 rounded-full ${step >= 3 ? "bg-cyan-500" : "bg-slate-800"}`} />
          </div>
          <span className="text-xs font-semibold text-slate-400 ml-4 shrink-0">Step {step} of 3</span>
        </div>

        {/* Modal content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
              {error}
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Which sports do you follow?</h3>
              <p className="text-sm text-slate-400 mb-5">
                We will curate your Today hub and daily value alerts around these sports.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AVAILABLE_SPORTS.map((sport) => {
                  const isSelected = selectedSports.includes(sport.id);
                  return (
                    <button
                      key={sport.id}
                      type="button"
                      onClick={() => toggleSport(sport.id)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                        isSelected
                          ? "bg-cyan-950/30 border-cyan-500 text-white shadow-sm shadow-cyan-950"
                          : "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{sport.emoji}</span>
                        <span className="font-semibold text-sm">{sport.name}</span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                          isSelected ? "bg-cyan-500 border-cyan-400 text-black" : "border-slate-600"
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Pick your favorite teams</h3>
              <p className="text-sm text-slate-400 mb-5">
                Get high-priority lineup notices and player prop coverage on game days.
              </p>

              <div className="space-y-4">
                {selectedSports.map((sportId) => {
                  const teams = POPULAR_TEAMS[sportId] || [];
                  if (teams.length === 0) return null;
                  return (
                    <div key={sportId} className="space-y-2">
                      <h4 className="text-xs font-semibold text-cyan-400 tracking-wider uppercase">
                        {sportId} Teams
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {teams.map((team) => {
                          const isSelected = selectedTeams.includes(team);
                          return (
                            <button
                              key={team}
                              type="button"
                              onClick={() => toggleTeam(team)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                isSelected
                                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500"
                                  : "bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600"
                              }`}
                            >
                              {team} {isSelected && "✓"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="text-xl font-bold text-white mb-1">What is your multi risk profile?</h3>
              <p className="text-sm text-slate-400 mb-5">
                Bob calibrates multi recommendations and Kelly sizing according to your risk tolerance.
              </p>

              <div className="space-y-3">
                {/* SAFE */}
                <button
                  type="button"
                  onClick={() => setRiskTolerance("SAFE")}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                    riskTolerance === "SAFE"
                      ? "bg-emerald-950/20 border-emerald-500 text-white shadow-sm"
                      : "bg-slate-800/30 border-slate-700/60 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-0.5">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-emerald-400">Safe Profile</span>
                      <span className="text-xs text-slate-400">Target Odds ~2.00 - 2.50</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Conservative doubles and high-probability props (50%+ true hit rate). Minimal correlation drag.
                    </p>
                  </div>
                </button>

                {/* BALANCED */}
                <button
                  type="button"
                  onClick={() => setRiskTolerance("BALANCED")}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                    riskTolerance === "BALANCED"
                      ? "bg-cyan-950/20 border-cyan-500 text-white shadow-sm"
                      : "bg-slate-800/30 border-slate-700/60 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mt-0.5">
                    <Target className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-cyan-400">Balanced (Recommended)</span>
                      <span className="text-xs text-slate-400">Target Odds ~4.00 - 5.50</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Optimized risk-adjusted ROI. 2-3 legs combining positive edge with healthy joint hit likelihood.
                    </p>
                  </div>
                </button>

                {/* LONG_SHOT */}
                <button
                  type="button"
                  onClick={() => setRiskTolerance("LONG_SHOT")}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                    riskTolerance === "LONG_SHOT"
                      ? "bg-purple-950/20 border-purple-500 text-white shadow-sm"
                      : "bg-slate-800/30 border-slate-700/60 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 mt-0.5">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-purple-400">Long-Shot Upside</span>
                      <span className="text-xs text-slate-400">Target Odds ~8.00 - 15.00+</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Higher payouts and explosive multipliers with disciplined positive model edge. Smaller Kelly stakes.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              disabled={selectedSports.length === 0}
              onClick={() => setStep((s) => (s + 1) as any)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 text-black hover:bg-cyan-400 transition-colors disabled:opacity-50"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 text-black hover:bg-cyan-400 transition-colors disabled:opacity-50"
            >
              <span>{saving ? "Saving Preferences..." : "Complete Setup"}</span>
              <Trophy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OnboardingModal;
