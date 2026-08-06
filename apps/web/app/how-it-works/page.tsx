import Link from "next/link";
import { Brain, ShieldAlert, Trophy, FlaskConical, Target, CheckCircle2, ArrowRight } from "lucide-react";

export default function HowItWorksPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 px-4">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <Brain size={14} />
          <span>Quantitative AI Engine</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          How BetMate Works
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          BetMate is an advanced quantitative prediction engine and paper-betting simulation platform built to test betting strategies risk-free.
        </p>
      </div>

      {/* 4 Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Target size={20} />
          </div>
          <h3 className="text-lg font-bold text-white">1. Automated Ingestion & Odds Tracking</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Our data pipelines continuously ingest form guides, speed maps, track conditions, jockey stats, and live market odds drift across Thoroughbred, Harness, Greyhounds, and major sports.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Brain size={20} />
          </div>
          <h3 className="text-lg font-bold text-white">2. ML Predictive Engine & Bob AI</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Ensemble Machine Learning models evaluate winning probability vs market odds to pinpoint true Expected Value (+EV). Ask Bob gives real-time explanations on model decisions.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <FlaskConical size={20} />
          </div>
          <h3 className="text-lg font-bold text-white">3. Strategy Lab & Custom Filters</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Configure risk thresholds, minimum probability filters, overlay requirements, and staking strategies (Kelly Criterion, Flat Stake, Confidence Weighted) in the Strategy Lab.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Trophy size={20} />
          </div>
          <h3 className="text-lg font-bold text-white">4. Risk-Free Paper Betslip</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Test your models with a starting baseline virtual bankroll ($10,000). Place simulated paper bets to evaluate yield, ROI, strike rate, and drawdowns without real currency.
          </p>
        </div>
      </div>

      {/* Guidelines List */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>Platform Principles</span>
        </h2>
        <ul className="space-y-2.5 text-xs text-slate-300">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
            <span><strong>No Real Money Gambling:</strong> BetMate is purely an educational paper-betting strategy tool. No financial transactions take place.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
            <span><strong>Data-Driven Transparency:</strong> All model picks display confidence levels, overlay metrics, and historical performance breakdowns.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
            <span><strong>Disciplined Staking:</strong> Protect your virtual bankroll with automated unit sizing calculated from model edge.</span>
          </li>
        </ul>
      </div>

      {/* Responsible Gambling Notice */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-2 text-center">
        <div className="flex items-center justify-center gap-1.5 font-bold text-amber-400">
          <ShieldAlert size={16} />
          <span>Responsible Gambling Notice</span>
        </div>
        <p className="text-amber-200/90 leading-relaxed">
          18+ | Gamble Responsibly | Australian Users: Gambling Help Online 1800 858 858
        </p>
      </div>

      {/* CTA */}
      <div className="flex justify-center pt-2">
        <Link
          href="/racing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
        >
          <span>Explore Today&apos;s Predictions</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

