"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  Check,
  Plus,
  History,
  TrendingUp,
  Award,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";
import { useBlackbookQuickAdd } from "../lib/useBlackbookQuickAdd";
import { useAuth } from "../providers/AuthProvider";
import { API_BASE, safeResponseJson } from "../lib/api";
import ErrorBoundary from "../components/ErrorBoundary";

export type BetRecord = {
  id: string;
  selection: string;
  event_name: string;
  sport: string;
  bet_type: string;
  odds: number;
  stake: number;
  status: "active" | "won" | "lost" | "settled" | "pending";
  payout?: number;
  placed_at?: string;
  settled_at?: string;
};

export default function BetsPage() {
  const { bets: activeBetslipItems } = usePaperBetslip();
  const { token, user } = useAuth();
  const { isSaved, addToBlackbook } = useBlackbookQuickAdd();

  const [tab, setTab] = useState<"all" | "active" | "settled">("active");
  const [historyBets, setHistoryBets] = useState<BetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch placed/settled bets from API if user is authenticated
  useEffect(() => {
    async function fetchBetHistory() {
      if (!user || user.id === "guest" || !token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/bets/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await safeResponseJson(res);
          setHistoryBets(data?.bets || []);
        }
      } catch (err) {
        console.error("Failed to load bet history", err);
      } finally {
        setLoading(false);
      }
    }
    void fetchBetHistory();
  }, [token, user]);

  // Combine local active paper betslip items with backend history bets
  const activePaperBets: BetRecord[] = activeBetslipItems.map((b) => ({
    id: b.id,
    selection: b.selection,
    event_name: b.event_name,
    sport: b.sport,
    bet_type: b.bet_type,
    odds: b.odds || 1.0,
    stake: b.stake,
    status: "active",
    placed_at: b.added_at,
  }));

  const allBets: BetRecord[] = [...activePaperBets, ...historyBets];

  const filteredBets = allBets.filter((bet) => {
    if (tab === "active") return bet.status === "active" || bet.status === "pending";
    if (tab === "settled") return bet.status === "won" || bet.status === "lost" || bet.status === "settled";
    return true;
  });

  const activeCount = allBets.filter((b) => b.status === "active" || b.status === "pending").length;
  const settledCount = allBets.filter((b) => b.status === "won" || b.status === "lost" || b.status === "settled").length;

  return (
    <ErrorBoundary sectionName="My Bets">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
              <History className="text-purple-400" size={24} /> My Bets & Bet History
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Track active paper bets, settled outcomes, and quick-bookmark selections to your Blackbook.
            </p>
          </div>

          <Link
            href="/racing"
            className="btn btn-sm bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs self-start md:self-auto"
          >
            <span>Explore Races</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
            <span className="text-[11px] font-medium text-slate-400">Active Bets</span>
            <div className="text-xl font-bold text-purple-400 mt-0.5">{activeCount}</div>
          </div>

          <div className="card p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
            <span className="text-[11px] font-medium text-slate-400">Settled Bets</span>
            <div className="text-xl font-bold text-slate-200 mt-0.5">{settledCount}</div>
          </div>

          <div className="card p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
            <span className="text-[11px] font-medium text-slate-400">Total Selections</span>
            <div className="text-xl font-bold text-slate-200 mt-0.5">{allBets.length}</div>
          </div>

          <div className="card p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
            <span className="text-[11px] font-medium text-slate-400">Blackbook Ready</span>
            <div className="text-xl font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
              <Bookmark size={16} /> Quick-Add
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setTab("active")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              tab === "active"
                ? "bg-purple-900/50 text-purple-200 border border-purple-500/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            Active Bets ({activeCount})
          </button>

          <button
            type="button"
            onClick={() => setTab("settled")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              tab === "settled"
                ? "bg-purple-900/50 text-purple-200 border border-purple-500/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            Settled Bets ({settledCount})
          </button>

          <button
            type="button"
            onClick={() => setTab("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              tab === "all"
                ? "bg-purple-900/50 text-purple-200 border border-purple-500/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            All History ({allBets.length})
          </button>
        </div>

        {/* Bet list or empty state */}
        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-20 w-full rounded-xl" />
            <div className="skeleton h-20 w-full rounded-xl" />
          </div>
        ) : filteredBets.length === 0 ? (
          <div className="card p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <History size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-200">No {tab} bets found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Add selections to your paper betslip from live racecards or match markets to build your history.
            </p>
            <Link
              href="/racing"
              className="inline-flex items-center gap-1.5 btn btn-sm bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2 rounded-lg font-semibold"
            >
              Browse Next Races
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBets.map((bet) => {
              const saved = isSaved(bet.selection);

              return (
                <div
                  key={bet.id}
                  className="card p-4 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                >
                  {/* Left: Selection & Event */}
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Selection Name */}
                      <span className="font-bold text-base text-slate-100">{bet.selection}</span>

                      {/* Inline + Bookmark Star/Plus Icon */}
                      {saved ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          <Check size={11} /> Saved ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            addToBlackbook({
                              runner: bet.selection,
                              type: "selection",
                              sport: bet.sport || "racing",
                            })
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-300 hover:text-purple-100 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 px-2 py-0.5 rounded-full transition-colors"
                          title="Save selection to Blackbook"
                        >
                          <Plus size={12} className="text-purple-400" />
                          <span>Blackbook</span>
                        </button>
                      )}

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          bet.status === "active" || bet.status === "pending"
                            ? "bg-purple-950/60 text-purple-300 border border-purple-500/30 animate-pulse"
                            : bet.status === "won"
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
                            : bet.status === "lost"
                            ? "bg-rose-950/60 text-rose-400 border border-rose-500/30"
                            : "bg-slate-800 text-slate-300 border border-slate-700"
                        }`}
                      >
                        {bet.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                      <span>{bet.event_name}</span>
                      <span>•</span>
                      <span className="uppercase text-[10px] text-slate-500 font-semibold">{bet.sport}</span>
                      <span>•</span>
                      <span className="capitalize">{bet.bet_type}</span>
                    </div>
                  </div>

                  {/* Right: Odds, Stake, Payout */}
                  <div className="flex items-center gap-6 text-right self-end md:self-auto">
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Odds</div>
                      <div className="text-sm font-bold text-slate-200">${bet.odds.toFixed(2)}</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Stake</div>
                      <div className="text-sm font-bold text-slate-200">${bet.stake.toFixed(2)}</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Est. Return</div>
                      <div className="text-sm font-bold text-emerald-400">
                        ${(bet.stake * bet.odds).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
