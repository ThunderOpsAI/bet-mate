"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { Plus, Check, X, RotateCcw, Trash2, Filter, List as ListIcon } from "lucide-react";
import Link from "next/link";

type Bet = {
  id: string;
  eventType: string;
  eventName: string;
  selection: string;
  betType: string;
  odds: number;
  stake: number;
  payout: number | null;
  status: string;
  createdAt: string;
};

const fmt = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

const statusBadge: Record<string, string> = {
  PENDING: "badge-yellow",
  WON: "badge-green",
  LOST: "badge-red",
  VOID: "badge-muted",
};

export default function BetsPage() {
  const { token, refreshUser } = useAuth();
  const router = useRouter();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [settleModal, setSettleModal] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchBets = () => {
    const params = filter !== "all" ? `?status=${filter}` : "";
    fetch(`${API}/bets${params}`, { headers })
      .then((r) => r.json())
      .then((data) => setBets(data.bets ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (token) fetchBets(); }, [token, filter]);

  const settle = async (betId: string, status: string) => {
    await fetch(`${API}/bets/${betId}/settle`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status }),
    });
    setSettleModal(null);
    refreshUser();
    fetchBets();
  };

  const deleteBet = async (betId: string) => {
    if (!confirm("Delete this bet?")) return;
    await fetch(`${API}/bets/${betId}`, { method: "DELETE", headers });
    refreshUser();
    fetchBets();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {["all", "PENDING", "WON", "LOST", "VOID"].map((f) => (
            <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-secondary"}`} onClick={() => { setFilter(f); setLoading(true); }}>
              {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <Link href="/bets/new" className="btn btn-primary btn-sm"><Plus size={15} /> Log Bet</Link>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map((i) => <div key={i} className="card"><div className="skeleton" style={{ height: 60 }} /></div>)}
        </div>
      ) : bets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><ListIcon size={48} /></div>
          <h4>No bets found</h4>
          <p>Log your first bet to start tracking.</p>
          <Link href="/bets/new" className="btn btn-primary" style={{ marginTop: "1rem" }}><Plus size={16} /> Log a Bet</Link>
        </div>
      ) : (
        <div className="bet-list">
          {bets.map((bet) => (
            <div key={bet.id} className="bet-row">
              <div className="bet-info">
                <h4>{bet.selection} <span className={`badge ${statusBadge[bet.status]}`}>{bet.status}</span></h4>
                <p>{bet.eventName} · {bet.betType} @ {bet.odds.toFixed(2)} · {new Date(bet.createdAt).toLocaleDateString("en-AU")}</p>
              </div>
              <div className="bet-amounts">
                <div className="stake">{fmt(bet.stake)}</div>
                {bet.payout != null && <div className="payout" style={{ color: bet.status === "WON" ? "var(--green)" : "var(--text-muted)" }}>→ {fmt(bet.payout)}</div>}
              </div>
              <div className="bet-actions">
                {bet.status === "PENDING" && (
                  <>
                    <button className="btn btn-sm btn-secondary" title="Won" onClick={() => settle(bet.id, "won")} style={{ color: "var(--green)" }}><Check size={14} /></button>
                    <button className="btn btn-sm btn-secondary" title="Lost" onClick={() => settle(bet.id, "lost")} style={{ color: "var(--red)" }}><X size={14} /></button>
                    <button className="btn btn-sm btn-secondary" title="Void" onClick={() => settle(bet.id, "void")}><RotateCcw size={14} /></button>
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
