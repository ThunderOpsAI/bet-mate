"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Star, TrendingUp, AlertTriangle, Bookmark, Check, Plus } from "lucide-react";
import { API_BASE, safeResponseJson } from "../../lib/api";
import { useBlackbookQuickAdd } from "../../lib/useBlackbookQuickAdd";
import ErrorBoundary from "../../components/ErrorBoundary";

type Prediction = {
  horseName: string;
  barrier?: number;
  winProbability: number;
  placeProbability?: number;
  confidence: string;
  valueRating?: string;
  factors?: string[];
  odds?: number;
  finishPosition?: number;
  jockeyName?: string;
  trainerName?: string;
};

type RaceDetail = {
  id: string;
  raceNumber: number;
  venue?: string;
  raceDate?: string;
  distanceMeters?: number;
  distance?: number;
  trackCondition?: string;
  predictions: Prediction[];
  isSettled?: boolean;
};

const fmt = (n: number) => `${(n * 100).toFixed(0)}%`;

const confidenceColor: Record<string, string> = {
  high: "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30",
  medium: "bg-amber-950/60 text-amber-300 border border-amber-500/30",
  low: "bg-rose-950/60 text-rose-400 border border-rose-500/30",
};

const valueColor: Record<string, string> = {
  strong: "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30",
  fair: "bg-amber-950/60 text-amber-300 border border-amber-500/30",
  poor: "bg-rose-950/60 text-rose-400 border border-rose-500/30",
  avoid: "bg-slate-800 text-slate-400 border border-slate-700",
};

export default function RaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const raceId = params?.raceId as string;

  const [race, setRace] = useState<RaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [openDropdownFor, setOpenDropdownFor] = useState<string | null>(null);
  const { isSaved, addToBlackbook } = useBlackbookQuickAdd();

  useEffect(() => {
    if (!raceId) return;
    fetch(`${API_BASE}/races/${raceId}`)
      .then((r) => safeResponseJson(r))
      .then((data) => setRace(data?.race ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [raceId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="skeleton h-32 w-full rounded-xl" />
        <div className="skeleton h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!race) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 text-center card bg-slate-950 border border-slate-800 rounded-xl space-y-3">
        <h4 className="text-lg font-bold text-slate-200">Race not found</h4>
        <p className="text-xs text-slate-400">The requested race details could not be loaded.</p>
        <button
          type="button"
          className="btn btn-secondary btn-sm bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-4 py-2 rounded-lg"
          onClick={() => router.push("/")}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary sectionName="Race Details & Results">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <button
          type="button"
          onClick={() => router.push("/racing")}
          className="btn btn-secondary btn-sm bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
        >
          <ArrowLeft size={16} /> Back to Racing
        </button>

        {/* Header card */}
        <div className="card p-4 md:p-6 bg-slate-950/90 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-100">
              {race.venue || "Race"} — Race {race.raceNumber}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Racecard results matrix and AI predictions analysis.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {race.trackCondition && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-950/60 text-blue-300 border border-blue-500/30">
                {race.trackCondition}
              </span>
            )}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-950/60 text-purple-300 border border-purple-500/30">
              {race.distanceMeters || race.distance}m
            </span>
          </div>
        </div>

        {/* Section title */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <Star className="text-amber-400" size={18} /> Race Results Matrix & Cards
          </h2>
          <span className="text-xs text-slate-400">Quick-add runner, jockey, trainer, or combination to Blackbook</span>
        </div>

        {/* Results Matrix / Runner Cards */}
        <div className="space-y-3">
          {race.predictions.map((pred, i) => {
            const saved = isSaved(pred.horseName);

            return (
              <div
                key={pred.horseName}
                className={`card p-4 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                  i === 0 ? "border-l-4 border-l-amber-400" : ""
                }`}
              >
                {/* Left: Runner details & Bookmark Icon */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Rank / Finish Position */}
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-xs font-bold text-slate-300 flex items-center justify-center">
                      {pred.finishPosition || i + 1}
                    </span>

                    {/* Quick Add Dropdown Container */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenDropdownFor(openDropdownFor === pred.horseName ? null : pred.horseName)}
                        className={`p-1.5 rounded-full transition-colors ${
                          saved
                            ? "text-amber-400 bg-amber-950/40 border border-amber-500/30"
                            : "text-slate-400 hover:text-cyan-400 hover:bg-slate-800"
                        }`}
                        title="Add to Blackbook"
                      >
                        {saved ? <Check size={16} /> : <Plus size={16} />}
                      </button>

                      {openDropdownFor === pred.horseName && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setOpenDropdownFor(null)}
                          />
                          <div className="absolute left-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden text-left">
                            <div className="px-3 py-2 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Add to Blackbook
                            </div>

                            {/* Horse Option */}
                            <button
                              type="button"
                              onClick={() => {
                                addToBlackbook({ runner: pred.horseName, type: "RUNNER", horseName: pred.horseName });
                                setOpenDropdownFor(null);
                              }}
                              className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex flex-col"
                            >
                              <span className="font-semibold">Horse</span>
                              <span className="text-[10px] text-slate-500 truncate">{pred.horseName}</span>
                            </button>

                            {/* Jockey Option */}
                            {pred.jockeyName && (
                              <button
                                type="button"
                                onClick={() => {
                                  addToBlackbook({ runner: pred.jockeyName!, type: "JOCKEY", jockeyName: pred.jockeyName });
                                  setOpenDropdownFor(null);
                                }}
                                className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex flex-col border-t border-slate-800"
                              >
                                <span className="font-semibold">Jockey</span>
                                <span className="text-[10px] text-slate-500 truncate">{pred.jockeyName}</span>
                              </button>
                            )}

                            {/* Trainer Option */}
                            {pred.trainerName && (
                              <button
                                type="button"
                                onClick={() => {
                                  addToBlackbook({ runner: pred.trainerName!, type: "TRAINER", trainerName: pred.trainerName });
                                  setOpenDropdownFor(null);
                                }}
                                className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex flex-col border-t border-slate-800"
                              >
                                <span className="font-semibold">Trainer</span>
                                <span className="text-[10px] text-slate-500 truncate">{pred.trainerName}</span>
                              </button>
                            )}

                            {/* Combination Option */}
                            {pred.jockeyName && (
                              <button
                                type="button"
                                onClick={() => {
                                  addToBlackbook({
                                    runner: `${pred.horseName} + ${pred.jockeyName}`,
                                    type: "COMBINATION",
                                    horseName: pred.horseName,
                                    jockeyName: pred.jockeyName,
                                  });
                                  setOpenDropdownFor(null);
                                }}
                                className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex flex-col border-t border-slate-800"
                              >
                                <span className="font-semibold">Combination</span>
                                <span className="text-[10px] text-slate-500 truncate">Horse + Jockey</span>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Runner Name */}
                    <h3 className="text-base font-bold text-slate-100">{pred.horseName}</h3>

                    {/* Barrier */}
                    {pred.barrier != null && (
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        B{pred.barrier}
                      </span>
                    )}

                    {/* Optimistic "Saved ✓" Badge */}
                    {saved && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        <Check size={11} /> Saved ✓
                      </span>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${confidenceColor[pred.confidence] || "bg-slate-800 text-slate-300"}`}>
                      {pred.confidence} confidence
                    </span>
                    {pred.valueRating && (
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${valueColor[pred.valueRating] || "bg-slate-800 text-slate-300"}`}>
                        {pred.valueRating} value
                      </span>
                    )}
                  </div>

                  {/* Key factors */}
                  {pred.factors && pred.factors.length > 0 && (
                    <ul className="text-xs text-slate-400 list-disc list-inside space-y-0.5 pt-1">
                      {pred.factors.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Right: Win probability & odds */}
                <div className="text-right min-w-[120px] self-end md:self-auto">
                  <div className={`text-xl font-black ${i === 0 ? "text-emerald-400" : "text-slate-100"}`}>
                    {fmt(pred.winProbability)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">Win Probability</div>
                  {pred.odds && (
                    <div className="text-sm font-bold text-slate-300 mt-0.5">
                      ${pred.odds.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs text-amber-300/80 flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0 text-amber-400" />
          <span>Predictions are AI-generated probability estimates. Please gamble responsibly.</span>
        </div>
      </div>
    </ErrorBoundary>
  );
}
