import Link from "next/link";
import { Activity, ArrowRight, BarChart3, Brain, TrendingUp, Trophy } from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";

export default function SportPage() {
  const sports = [
    { name: "NBA", path: "/nba" },
    { name: "NFL", path: "/nfl" },
    { name: "AFL", path: "/afl" },
    { name: "NRL", path: "/nrl" },
    { name: "Soccer", path: "/soccer" },
    { name: "MMA", path: "/mma" },
    { name: "Golf", path: "/golf" },
  ];

  return (
    <ErrorBoundary sectionName="Sport Landing">
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6">
        <section className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
          <div className="text-emerald-400 font-semibold text-sm mb-2 flex items-center gap-2">
            <Trophy size={16} />
            <span>Select a Sport</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
            Sports Dashboard
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-2xl">
            Choose a sport below to view AI-powered predictions, upcoming matches, and high-value betting opportunities.
          </p>
        </section>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {sports.map((s) => (
            <Link
              key={s.path}
              href={s.path}
              className="flex flex-col items-center justify-center p-6 bg-slate-950/50 border border-slate-800 rounded-2xl hover:bg-slate-800 hover:border-emerald-500/50 transition-all group"
            >
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 group-hover:bg-emerald-900/50 transition-colors">
                <Trophy size={28} className="text-slate-400 group-hover:text-emerald-400" />
              </div>
              <span className="text-slate-200 font-bold text-lg">{s.name}</span>
            </Link>
          ))}
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Activity, value: "7", label: "sports covered", detail: "AFL, NBA, NFL, NRL, Soccer, MMA and Golf" },
            { icon: TrendingUp, value: "Live", label: "model vs market", detail: "Compare fair odds, market prices and value gaps" },
            { icon: Brain, value: "Deep", label: "matchup analysis", detail: "Open any event for form, confidence and feature impact" },
          ].map(({ icon: Icon, value, label, detail }) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="flex items-center gap-3 mb-3">
                <Icon size={18} className="text-emerald-400" />
                <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">{label}</span>
              </div>
              <p className="text-2xl font-black text-slate-100">{value}</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{detail}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-sky-400" />
            <h2 className="text-base font-bold text-slate-100">How to use the sport dashboard</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {[
              ["1", "Choose a sport", "Start with the sport whose fixtures and markets you want to inspect."],
              ["2", "Scan the board", "Use the summary cards to find confidence, timing and model-led edges."],
              ["3", "Open deep stats", "Select a matchup for feature impact, fair odds and matchup context."],
            ].map(([step, title, detail]) => (
              <div key={step} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-black text-emerald-300">{step}</span>
                <div><p className="font-bold text-slate-200">{title}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">{detail}</p></div>
              </div>
            ))}
          </div>
          <Link href="/nba" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300">
            Open a sample dashboard <ArrowRight size={15} />
          </Link>
        </section>
      </div>
    </ErrorBoundary>
  );
}
