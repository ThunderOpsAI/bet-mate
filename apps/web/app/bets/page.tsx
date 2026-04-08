"use client";
import { useEffect, useState } from "react";
import { Plus, Check, X, RotateCcw, Trash2, List as ListIcon } from "lucide-react";
import Link from "next/link";
import { ML_API } from "../lib/mlApi";

type PaperBet = {
  id: number;
  created_at: string;
  settled_at: string | null;
  sport: string;
  event_id: string;
  event_name: string;
  selection: string;
  bet_type: string;
  odds: number;
  stake: number;
  status: string;
  payout: number | null;
  profit: number | null;
  notes: string | null;
};

type PaperBetSummary = {
  total_bets: number;
  pending_bets: number;
  settled_bets: number;
  won_bets: number;
  lost_bets: number;
  void_bets: number;
  total_staked: number;
  pending_exposure: number;
  net_profit: number;
  roi: number;
  win_rate: number;
};

const fmt = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

const statusBadge: Record<string, string> = {
  PENDING: "badge-yellow",
  WON: "badge-green",
  LOST: "badge-red",
  VOID: "badge-muted",
};

export default function BetsPage() {
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [summary, setSummary] = useState<PaperBetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const fetchBets = async () => {
    try {
      setError("");
      const params = filter !== "all" ? `?status=${filter}` : "";
      const [betsResponse, summaryResponse] = await Promise.all([
        fetch(`${ML_API}/api/paper-bets${params}`),
        fetch(`${ML_API}/api/paper-bets/summary`),
      ]);

      if (!betsResponse.ok || !summaryResponse.ok) {
        throw new Error("Paper bets unavailable");
      }

      const betsData = await betsResponse.json();
      const summaryData = await summaryResponse.json();
      setBets(betsData?.bets ?? []);
      setSummary(summaryData?.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Paper bets unavailable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchBets();
  }, [filter]);

  const settle = async (betId: number, status: string) => {
    await fetch(`${ML_API}/api/paper-bets/${betId}/settle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchBets();
  };

  const deleteBet = async (betId: number) => {
    if (!confirm("Delete this paper bet?")) return;
    await fetch(`${ML_API}/api/paper-bets/${betId}`, { method: "DELETE" });
    fetchBets();
  };

  return (
    <div>
      {summary && (
        <div className="stats-grid">
          <div className="stat-card accent">
            <div className="stat-label">Paper Bets</div>
            <div className="stat-value">{summary.total_bets}</div>
            <div className="stat-sub">{summary.pending_bets} pending</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">Net Profit</div>
            <div className="stat-value" style={{ color: summary.net_profit >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(summary.net_profit)}</div>
            <div className="stat-sub">{fmt(summary.pending_exposure)} pending exposure</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-label">ROI</div>
            <div className="stat-value">{formatPct(summary.roi)}</div>
            <div className="stat-sub">{fmt(summary.total_staked)} total staked</div>
          </div>
          <div className="stat-card yellow">
            <div className="stat-label">Win Rate</div>
            <div className="stat-value">{formatPct(summary.win_rate)}</div>
            <div className="stat-sub">{summary.won_bets}W / {summary.lost_bets}L / {summary.void_bets}V</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {["all", "PENDING", "WON", "LOST", "VOID"].map((f) => (
            <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <Link href="/bets/new" className="btn btn-primary btn-sm"><Plus size={15} /> Log Paper Bet</Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map((i) => <div key={i} className="card"><div className="skeleton" style={{ height: 60 }} /></div>)}
        </div>
      ) : bets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><ListIcon size={48} /></div>
          <h4>No paper bets found</h4>
          <p>Log a prediction-linked bet to track ROI without placing a wager.</p>
          <Link href="/bets/new" className="btn btn-primary" style={{ marginTop: "1rem" }}><Plus size={16} /> Log Paper Bet</Link>
        </div>
      ) : (
        <div className="bet-list">
          {bets.map((bet) => (
            <div key={bet.id} className="bet-row">
              <div className="bet-info">
                <h4>{bet.selection} <span className={`badge ${statusBadge[bet.status]}`}>{bet.status}</span></h4>
                <p>{formatSport(bet.sport)} · {bet.event_name} · {formatSport(bet.bet_type)} @ {bet.odds.toFixed(2)} · {new Date(bet.created_at).toLocaleDateString("en-AU")}</p>
              </div>
              <div className="bet-amounts">
                <div className="stake">{fmt(bet.stake)}</div>
                {bet.payout != null && (
                  <div className="payout" style={{ color: (bet.profit ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>
                    {formatSignedCurrency(bet.profit ?? 0)}
                  </div>
                )}
              </div>
              <div className="bet-actions">
                {bet.status === "PENDING" && (
                  <>
                    <button className="btn btn-sm btn-secondary" title="Won" onClick={() => settle(bet.id, "WON")} style={{ color: "var(--green)" }}><Check size={14} /></button>
                    <button className="btn btn-sm btn-secondary" title="Lost" onClick={() => settle(bet.id, "LOST")} style={{ color: "var(--red)" }}><X size={14} /></button>
                    <button className="btn btn-sm btn-secondary" title="Void" onClick={() => settle(bet.id, "VOID")}><RotateCcw size={14} /></button>
                  </>
                )}
                <button className="btn btn-sm btn-danger" title="Delete" onClick={() => deleteBet(bet.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSport(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSignedCurrency(value: number): string {
  const formatted = fmt(Math.abs(value));
  if (value === 0) return formatted;
  return `${value > 0 ? "+" : "-"}${formatted}`;
}
