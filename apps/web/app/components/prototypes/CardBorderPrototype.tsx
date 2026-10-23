"use client";

import React, { useState } from "react";
import { Plus, Check, ChevronRight, Zap } from "lucide-react";

export default function CardBorderPrototype() {
  const [activeVariant, setActiveVariant] = useState<"old" | "white" | "halfway">("halfway");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 text-slate-100 shadow-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-800">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            UI Prototype — Card Borders & Inset Padding
          </span>
          <h2 className="text-lg font-extrabold text-slate-100 mt-1">
            IDE-Style Card Border & Spacing Comparison
          </h2>
          <p className="text-xs text-slate-400">
            Toggle below to compare border color, opacity, and text inset padding.
          </p>
        </div>

        {/* Variant Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveVariant("old")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeVariant === "old"
                ? "bg-slate-800 text-slate-200 border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            1. Old Dark Gray
          </button>
          <button
            type="button"
            onClick={() => setActiveVariant("white")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeVariant === "white"
                ? "bg-slate-800 text-white border border-white/60"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            2. Thick IDE White
          </button>
          <button
            type="button"
            onClick={() => setActiveVariant("halfway")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeVariant === "halfway"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            3. Recommended Halfway White-Slate ✓
          </button>
        </div>
      </div>

      {/* Card Preview Area */}
      <div className="space-y-4">
        {/* Preview Card */}
        <div
          className={`transition-all duration-300 backdrop-blur-md rounded-2xl ${
            activeVariant === "old"
              ? "bg-slate-950 border border-slate-800 p-3"
              : activeVariant === "white"
              ? "bg-slate-950 border-2 border-white p-6"
              : "bg-slate-950/90 border border-slate-400/35 p-5 shadow-xl hover:border-slate-300/60"
          }`}
        >
          {/* Card Header */}
          <div className="flex items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-slate-800/80">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                NBA
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 mt-1">
                Boston Celtics vs Los Angeles Lakers
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Start time: Today 7:30 PM (TD Garden)</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl shrink-0">
              <span>Match Details</span>
              <ChevronRight size={14} />
            </div>
          </div>

          {/* Outcome Rows */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-900/70 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-colors">
              <div className="min-w-0 flex-1">
                <span className="font-bold text-sm text-slate-100 block">Boston Celtics</span>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>Model Win: <strong className="text-emerald-400">55.0%</strong></span>
                  <span>Fair: <strong className="text-slate-200">$1.82</strong></span>
                  <span>Mkt: <strong className="text-amber-400">$1.85</strong></span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold shadow-sm"
              >
                <Plus size={14} />
                <span>+ Add to Betslip</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-900/70 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-colors">
              <div className="min-w-0 flex-1">
                <span className="font-bold text-sm text-slate-100 block">Los Angeles Lakers</span>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>Model Win: <strong className="text-emerald-400">45.0%</strong></span>
                  <span>Fair: <strong className="text-slate-200">$2.22</strong></span>
                  <span>Mkt: <strong className="text-amber-400">$2.20</strong></span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold border border-slate-700"
              >
                <Plus size={14} />
                <span>+ Add to Betslip</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span>Active Border: <strong className="text-slate-200">1px border-slate-400/35 (rgba(255,255,255,0.22))</strong></span>
        <span>Inset Padding: <strong className="text-slate-200">p-5 (20px off edges)</strong></span>
      </div>
    </div>
  );
}
