import Link from "next/link";
import { Trophy } from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";

export default function SportPage() {
  const sports = [
    { name: "AFL", path: "/afl" },
    { name: "NRL", path: "/nrl" },
    { name: "NBA", path: "/nba" },
    { name: "Soccer", path: "/soccer" },
    { name: "Golf", path: "/golf" },
    { name: "MMA", path: "/mma" },
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
      </div>
    </ErrorBoundary>
  );
}
