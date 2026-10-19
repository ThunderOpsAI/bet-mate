import React, { useState } from "react";
import { ShieldCheck, Lock, FileText, ArrowLeft, Clock } from "lucide-react";

interface LegalViewProps {
  initialTab?: "privacy" | "terms";
  onBack: () => void;
}

export const LegalView: React.FC<LegalViewProps> = ({ initialTab = "privacy", onBack }) => {
  const [tab, setTab] = useState<"privacy" | "terms">(initialTab);

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to App</span>
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("privacy")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              tab === "privacy"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                : "bg-slate-900 text-slate-400 border border-slate-800"
            }`}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => setTab("terms")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              tab === "terms"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                : "bg-slate-900 text-slate-400 border border-slate-800"
            }`}
          >
            Terms &amp; Conditions
          </button>
        </div>
      </div>

      {tab === "privacy" ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-white">Privacy Policy</h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Clock size={12} /> Last updated: October 2026 • Version 1.4
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs leading-relaxed">
            BetMate collects minimal account information strictly necessary for saving virtual paper-betting simulation history, watch rules, and strategy lab preferences. We do not sell or monetize personal betting preferences.
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs text-slate-300 leading-relaxed">
            <h3 className="text-sm font-bold text-white">Data Retention &amp; Local Storage</h3>
            <p>
              Your virtual bankroll, paper betslip selections, and simulated trade records are cached locally in your browser storage. You can clear or reset this data at any time via Platform Settings.
            </p>
            <h3 className="text-sm font-bold text-white pt-2">Analytical Cookies</h3>
            <p>
              We monitor model accuracy, feature calibration, and page load telemetry to continuously refine our machine learning pipelines. No tracking cookies are shared with third-party advertisers.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-white">Terms &amp; Conditions</h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Clock size={12} /> Last updated: October 2026 • Version 2.0
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs leading-relaxed">
            BetMate is an informational, educational quantitative analytics and paper-betting simulation service. It does not accept wagers, offer gambling services, or process monetary payouts.
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs text-slate-300 leading-relaxed">
            <h3 className="text-sm font-bold text-white">1. Simulation &amp; Virtual Currency</h3>
            <p>
              All currency references ($) represent simulated paper currency used strictly for strategy benchmarking and educational analysis. They hold zero monetary value and cannot be redeemed.
            </p>
            <h3 className="text-sm font-bold text-white pt-2">2. Model Disclaimer</h3>
            <p>
              Past statistical performance, machine learning win probabilities, and expected value (+EV) indicators are not guarantees of future outcomes. Sports and racing events inherently contain statistical variance.
            </p>
            <h3 className="text-sm font-bold text-white pt-2">3. Responsible Wagering</h3>
            <p>
              Users in jurisdictions where gambling is permitted must wager responsibly within their means. If gambling is causing harm, contact Gambling Help Online at 1800 858 858.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
