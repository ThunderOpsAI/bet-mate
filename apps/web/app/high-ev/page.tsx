import { Suspense } from "react";
import ErrorBoundary from "../components/ErrorBoundary";
import { Zap, AlertCircle } from "lucide-react";

export default function HighEVPage() {
  return (
    <ErrorBoundary>
      <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl animate-in fade-in">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Zap className="w-8 h-8 text-yellow-400 fill-yellow-400" />
            High EV Feed
          </h1>
          <p className="text-slate-400 mt-2">
            Top algorithmic value picks across Racing and Sports.
          </p>
        </header>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-bold mb-4 text-emerald-400">Top 10 Racing Tips (Today)</h2>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-8 h-8 text-slate-500 mb-3" />
              <h3 className="text-lg font-medium text-slate-300">Awaiting Live Feed</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-md">
                Live predictions and High EV tips are currently being processed. No synthetic fallbacks or fake odds will be generated.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4 text-amber-400">Top 10 Sports Tips (This Week)</h2>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-8 h-8 text-slate-500 mb-3" />
              <h3 className="text-lg font-medium text-slate-300">Awaiting Live Feed</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-md">
                Live predictions and High EV tips are currently being processed. No synthetic fallbacks or fake odds will be generated.
              </p>
            </div>
          </section>
        </div>
      </div>
    </ErrorBoundary>
  );
}
