"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { BarChart3, TrendingUp, Target, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";

const fmt = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

export default function AnalyticsPage() {
  const { token } = useAuth();
  const [bk, setBk] = useState<any>(null);
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

  useEffect(() => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API}/user/bankroll`, { headers: h }).then((r) => r.json()),
      fetch(`${API}/bets?limit=100`, { headers: h }).then((r) => r.json()),
    ])
      .then(([bankrollData, betsData]) => {
        setBk(bankrollData?.bankroll);
        setBets(betsData?.bets ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="card"><div className="skeleton" style={{ height: 400 }} /></div>;

  const won = bets.filter((b) => b.status === "WON").length;
  const lost = bets.filter((b) => b.status === "LOST").length;
  const pending = bets.filter((b) => b.status === "PENDING").length;
  const totalStaked = bets.reduce((s, b) => s + b.stake, 0);
  const totalReturned = bets.filter((b) => b.status === "WON").reduce((s, b) => s + (b.payout ?? 0), 0);

  const pieData = [
    { name: "Won", value: won, color: "var(--green)" },
    { name: "Lost", value: lost, color: "var(--red)" },
    { name: "Pending", value: pending, color: "var(--yellow)" },
  ].filter((d) => d.value > 0);

  // Group bets by date for bar chart
  const byDate = new Map<string, { date: string; profit: number }>();
  bets.filter((b) => b.status !== "PENDING").forEach((b) => {
    const d = new Date(b.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    const entry = byDate.get(d) ?? { date: d, profit: 0 };
    if (b.status === "WON") entry.profit += (b.payout ?? 0) - b.stake;
    else if (b.status === "LOST") entry.profit -= b.stake;
    byDate.set(d, entry);
  });
  const barData = [...byDate.values()];

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-label"><TrendingUp size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Net P&L</div>
          <div className="stat-value" style={{ color: (bk?.netProfit ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(bk?.netProfit ?? totalReturned - totalStaked)}</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-label">ROI</div>
          <div className="stat-value">{bk?.roi ?? (totalStaked > 0 ? (((totalReturned - totalStaked) / totalStaked) * 100).toFixed(1) : 0)}%</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label"><Target size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Win Rate</div>
          <div className="stat-value">{bk?.winRate ?? (bets.length > 0 ? Math.round((won / (won + lost || 1)) * 100) : 0)}%</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label"><DollarSign size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Staked</div>
          <div className="stat-value">{fmt(bk?.totalStaked ?? totalStaked)}</div>
          <div className="stat-sub">Returned: {fmt(bk?.totalReturned ?? totalReturned)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        {/* P&L by day */}
        {barData.length > 0 && (
          <div className="chart-container">
            <h4>Daily P&L</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="profit" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Win/Loss pie */}
        {pieData.length > 0 && (
          <div className="chart-container">
            <h4>Outcomes</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "0.5rem" }}>
              {pieData.map((d) => (
                <span key={d.name} style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: d.color, marginRight: 4, verticalAlign: "middle" }} />
                  {d.name}: {d.value}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {bets.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon"><BarChart3 size={48} /></div>
          <h4>No analytics yet</h4>
          <p>Log some bets and settle them to see your performance data.</p>
        </div>
      )}
    </div>
  );
}
