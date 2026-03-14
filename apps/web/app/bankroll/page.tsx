"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../providers/AuthProvider";
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, Plus, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const fmt = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

export default function BankrollPage() {
  const { token, refreshUser } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("deposit");
  const [adjLoading, setAdjLoading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchData = () => {
    fetch(`${API}/user/bankroll`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (token) fetchData(); }, [token]);

  const handleAdjust = async (e: FormEvent) => {
    e.preventDefault();
    setAdjLoading(true);
    const amount = adjReason === "withdrawal" ? -Math.abs(Number(adjAmount)) : Math.abs(Number(adjAmount));
    await fetch(`${API}/user/bankroll/adjust`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount, reason: adjReason }),
    });
    setShowAdjust(false);
    setAdjAmount("");
    setAdjLoading(false);
    refreshUser();
    fetchData();
  };

  if (loading) return <div className="card"><div className="skeleton" style={{ height: 400 }} /></div>;

  const bk = data?.bankroll;
  const history = data?.history ?? [];

  // Build chart data from history (reversed so oldest first)
  const chartData = [...history].reverse().reduce((acc: any[], entry: any, i: number) => {
    const prev = i > 0 ? acc[i - 1].balance : (bk?.starting ?? 0);
    acc.push({ name: new Date(entry.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" }), balance: prev + entry.amount });
    return acc;
  }, []);

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="stat-label"><DollarSign size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Current</div>
          <div className="stat-value">{fmt(bk?.current ?? 0)}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label"><TrendingUp size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Net Profit</div>
          <div className="stat-value" style={{ color: (bk?.netProfit ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(bk?.netProfit ?? 0)}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">ROI</div>
          <div className="stat-value">{bk?.roi ?? 0}%</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">Win Rate</div>
          <div className="stat-value">{bk?.winRate ?? 0}%</div>
          <div className="stat-sub">{bk?.totalBets ?? 0} total bets</div>
        </div>
      </div>

      {/* Adjust bankroll */}
      <div style={{ marginBottom: "1.5rem" }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowAdjust(!showAdjust)}>
          <DollarSign size={15} /> Adjust Bankroll
        </button>
        {showAdjust && (
          <form onSubmit={handleAdjust} className="card" style={{ marginTop: "0.75rem", maxWidth: 400 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={adjReason} onChange={(e) => setAdjReason(e.target.value)}>
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="correction">Correction</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount ($)</label>
                <input className="form-input" type="number" min="1" step="1" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={adjLoading}>{adjLoading ? "Saving…" : "Apply"}</button>
          </form>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="chart-container">
          <h4>Bankroll Over Time</h4>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="balance" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* History */}
      <div className="section-header"><h3>Recent History</h3></div>
      {history.length === 0 ? (
        <div className="empty-state"><h4>No history yet</h4><p>Your bankroll changes will appear here.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Reason</th><th>Amount</th></tr></thead>
            <tbody>
              {history.map((h: any) => (
                <tr key={h.id}>
                  <td>{new Date(h.createdAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{h.reason}</td>
                  <td style={{ color: h.amount >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                    {h.amount >= 0 ? <ArrowUpRight size={14} style={{ verticalAlign: "middle" }} /> : <ArrowDownRight size={14} style={{ verticalAlign: "middle" }} />}
                    {" "}{fmt(Math.abs(h.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
