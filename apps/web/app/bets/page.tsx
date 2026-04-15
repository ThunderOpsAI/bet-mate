"use client";
import { useEffect, useState } from "react";
import { Plus, Check, X, RotateCcw, Trash2, List as ListIcon, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { ML_API } from "../lib/mlApi";
import { useAuth } from "../providers/AuthProvider";

type PredictionSnapshot = {
  probability: number | null;
  fair_odds: number | null;
  payload?: Record<string, unknown> | null;
};

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
  origin?: string;
  prediction?: PredictionSnapshot | null;
};

type PaperBetSummary = {
  total_bets: number;
  pending_bets: number;
  settled_bets: number;
  won_bets: number;
  lost_bets: number;
  void_bets: number;
  total_staked: number;
  total_returned: number;
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
  const { token } = useAuth();
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [summary, setSummary] = useState<PaperBetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "settled">("active");
  const [sportFilter, setSportFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedReasoning, setExpandedReasoning] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  const fetchBets = async () => {
    try {
      setError("");
      if (!token) {
        setBets([]);
        setSummary(null);
        throw new Error("Please sign in to view paper bets.");
      }
      const authHeaders = { Authorization: `Bearer ${token}` };
      const [betsResponse, summaryResponse] = await Promise.all([
        fetch(`${ML_API}/api/paper-bets?limit=200`, { headers: authHeaders }),
        fetch(`${ML_API}/api/paper-bets/summary`, { headers: authHeaders }),
      ]);

      if (!betsResponse.ok || !summaryResponse.ok) {
        if (betsResponse.status === 401 || summaryResponse.status === 401) {
          throw new Error("Session expired. Please sign in again.");
        }
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
    void fetchBets();
  }, [token]);

  const settle = async (betId: number, status: string) => {
    if (!token) {
      setError("Please sign in to update paper bets.");
      return;
    }
    await fetch(`${ML_API}/api/paper-bets/${betId}/settle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    void fetchBets();
  };

  const deleteBet = async (betId: number) => {
    if (!confirm("Delete this paper bet?")) return;
    if (!token) {
      setError("Please sign in to delete paper bets.");
      return;
    }
    await fetch(`${ML_API}/api/paper-bets/${betId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    void fetchBets();
  };

  return (
    <div>
      {summary && (
        <div className="stats-grid">
          <div className="stat-card accent">
            <div className="stat-label">Total Staked</div>
            <div className="stat-value">{fmt(summary.total_staked)}</div>
            <div className="stat-sub">{summary.total_bets} bets tracked</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-label">Total Returned</div>
            <div className="stat-value">{fmt(summary.total_returned)}</div>
            <div className="stat-sub">{summary.settled_bets} settled bets</div>
          </div>
          <div className={`stat-card ${summary.net_profit >= 0 ? "green" : "red"}`}>
            <div className="stat-label">Net P&amp;L</div>
            <div className="stat-value" style={{ color: summary.net_profit >= 0 ? "var(--green)" : "var(--red)" }}>{formatSignedCurrency(summary.net_profit)}</div>
            <div className="stat-sub">{summary.pending_bets} active · {formatPct(summary.roi)} ROI</div>
          </div>
          <div className="stat-card yellow">
            <div className="stat-label">Win Rate</div>
            <div className="stat-value">{formatPct(summary.win_rate)}</div>
            <div className="stat-sub">{summary.won_bets}W / {summary.lost_bets}L / {summary.void_bets}V</div>
          </div>
        </div>
      )}

      <div className="paper-bet-controls">
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <div className="paper-bet-tabs">
            {(["active", "settled"] as const).map((candidate) => (
              <button
                key={candidate}
                className={`btn btn-sm ${tab === candidate ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setTab(candidate)}
              >
                {candidate === "active" ? "Active" : "Settled"}
              </button>
            ))}
          </div>
          <div className="paper-bet-filter-row">
            <select className="form-input paper-bet-filter" value={sportFilter} onChange={(event) => setSportFilter(event.target.value)}>
              <option value="all">All Sports</option>
              {collectSports(bets).map((sport) => (
                <option key={sport} value={sport}>{formatSport(sport)}</option>
              ))}
            </select>
            <select className="form-input paper-bet-filter" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="all">All Sources</option>
              <option value="manual">Manual</option>
              <option value="strategy_copy">Strategy Copy</option>
              <option value="system">System</option>
            </select>
            <input className="form-input paper-bet-filter" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            <input className="form-input paper-bet-filter" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
        </div>
        <Link href="/bets/new" className="btn btn-primary btn-sm"><Plus size={15} /> Log Paper Bet</Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map((i) => <div key={i} className="card"><div className="skeleton" style={{ height: 60 }} /></div>)}
        </div>
      ) : filteredBets({ bets, tab, sportFilter, sourceFilter, fromDate, toDate }).length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><ListIcon size={48} /></div>
          <h4>No paper bets found</h4>
          <p>Try adjusting the filters or log a new paper bet.</p>
          <Link href="/bets/new" className="btn btn-primary" style={{ marginTop: "1rem" }}><Plus size={16} /> Log Paper Bet</Link>
        </div>
      ) : (
        <div className="bet-list">
          {filteredBets({ bets, tab, sportFilter, sourceFilter, fromDate, toDate }).map((bet) => {
            const source = sourceLabel(bet);
            const strategyDetails = parseStrategyDetails(bet);
            const isExpanded = expandedReasoning.has(bet.id);

            return (
              <div key={bet.id} className="paper-bet-card">
                <div className="bet-row">
                  <div className="bet-info">
                    <h4>{bet.selection} <span className={`badge ${statusBadge[bet.status]}`}>{bet.status}</span></h4>
                    <p>{formatSport(bet.sport)} · {bet.event_name} · {formatSport(bet.bet_type)} @ {bet.odds.toFixed(2)}</p>
                    <div className="paper-bet-meta-row">
                      <span className="badge badge-muted">Stake {fmt(bet.stake)}</span>
                      <span className={`badge ${source.badgeClass}`}>{source.label}</span>
                      <span className="badge badge-muted">{new Date(bet.created_at).toLocaleDateString("en-AU")}</span>
                    </div>
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

                {source.kind === "strategy_copy" && (
                  <div className="strategy-reasoning">
                    <button
                      className="strategy-reasoning-toggle"
                      onClick={() => setExpandedReasoning((existing) => {
                        const clone = new Set(existing);
                        if (clone.has(bet.id)) clone.delete(bet.id);
                        else clone.add(bet.id);
                        return clone;
                      })}
                    >
                      <span>Strategy reasoning</span>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    {isExpanded && (
                      <div className="strategy-reasoning-body">
                        <div className="strategy-reasoning-summary">
                          <span className="badge badge-blue">{strategyDetails.strategyName}</span>
                          <span className="badge badge-accent">Confidence: {strategyDetails.confidence}</span>
                        </div>
                        <ul>
                          {strategyDetails.snapshot.map((point) => (
                            <li key={`${bet.id}-${point.label}`}>
                              <strong>{point.label}:</strong> {point.value}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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

function collectSports(bets: PaperBet[]): string[] {
  return [...new Set(bets.map((bet) => bet.sport))].sort();
}

function filteredBets({
  bets,
  tab,
  sportFilter,
  sourceFilter,
  fromDate,
  toDate,
}: {
  bets: PaperBet[];
  tab: "active" | "settled";
  sportFilter: string;
  sourceFilter: string;
  fromDate: string;
  toDate: string;
}): PaperBet[] {
  const fromValue = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
  const toValue = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

  return bets.filter((bet) => {
    const isActive = bet.status === "PENDING";
    if (tab === "active" && !isActive) return false;
    if (tab === "settled" && isActive) return false;
    if (sportFilter !== "all" && bet.sport !== sportFilter) return false;

    const source = sourceLabel(bet).kind;
    if (sourceFilter !== "all" && source !== sourceFilter) return false;

    const createdAt = new Date(bet.created_at).getTime();
    if (fromValue && createdAt < fromValue) return false;
    if (toValue && createdAt > toValue) return false;
    return true;
  });
}

function sourceLabel(bet: PaperBet): { label: string; badgeClass: string; kind: "manual" | "strategy_copy" | "system" } {
  const origin = (bet.origin ?? "user").toLowerCase();
  if (origin.includes("strategy")) return { label: "Strategy Copy", badgeClass: "badge-blue", kind: "strategy_copy" };
  if (origin === "system") return { label: "System", badgeClass: "badge-yellow", kind: "system" };
  return { label: "Manual", badgeClass: "badge-muted", kind: "manual" };
}

function parseStrategyDetails(bet: PaperBet): { strategyName: string; confidence: string; snapshot: Array<{ label: string; value: string }> } {
  const notes = parseNotes(bet.notes);
  const payload = bet.prediction?.payload && typeof bet.prediction.payload === "object" ? bet.prediction.payload : {};
  const strategyName = asString(notes?.strategy_name) ?? asString(payload?.strategy_name) ?? "Strategy Copy";
  const confidence = asString(notes?.confidence) ?? asString(payload?.confidence) ?? "N/A";
  const snapshot = [
    { label: "Event", value: bet.event_name },
    { label: "Selection", value: bet.selection },
    { label: "Bet type", value: formatSport(bet.bet_type) },
    { label: "Odds at copy", value: bet.odds.toFixed(2) },
    { label: "Stake", value: fmt(bet.stake) },
    { label: "Model probability", value: bet.prediction?.probability != null ? formatPct(bet.prediction.probability) : "N/A" },
    { label: "Model fair odds", value: bet.prediction?.fair_odds != null ? bet.prediction.fair_odds.toFixed(2) : "N/A" },
  ];

  if (notes?.snapshot && typeof notes.snapshot === "object") {
    Object.entries(notes.snapshot).slice(0, 4).forEach(([label, value]) => {
      snapshot.push({ label: formatSport(label), value: String(value) });
    });
  }

  return { strategyName, confidence, snapshot };
}

function parseNotes(notes: string | null): Record<string, any> | null {
  if (!notes) return null;
  if (!notes.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(notes);
    return typeof parsed === "object" && parsed ? parsed as Record<string, any> : null;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
