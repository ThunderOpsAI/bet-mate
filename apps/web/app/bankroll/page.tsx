"use client";
import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ML_API } from "../lib/mlApi";
import { useAuth } from "../providers/AuthProvider";
const fmt = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

type PaperBetSummary = {
  total_bets: number;
  pending_bets: number;
  settled_bets: number;
  won_bets: number;
  lost_bets: number;
  void_bets: number;
  total_staked: number;
  settled_staked: number;
  pending_exposure: number;
  total_returned: number;
  net_profit: number;
  roi: number;
  win_rate: number;
};

type PaperBet = {
  id: number;
  created_at: string;
  settled_at: string | null;
  sport: string;
  event_name: string;
  selection: string;
  stake: number;
  odds: number;
  status: string;
  payout: number | null;
  profit: number | null;
};

type PaperBetTrendPoint = {
  date: string;
  sport: string;
  settled_bets: number;
  decision_bets: number;
  settled_staked: number;
  total_returned: number;
  net_profit: number;
  roi: number;
  cumulative_staked: number;
  cumulative_profit: number;
  cumulative_roi: number;
};

export default function BankrollPage() {
  const [summary, setSummary] = useState<PaperBetSummary | null>(null);
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [trend, setTrend] = useState<PaperBetTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { token } = useAuth();

  const fetchData = async () => {
    try {
      setError("");
      const headers = { Authorization: `Bearer ${token || "guest"}` };
      const [summaryResponse, betsResponse, trendResponse] = await Promise.all([
        fetch(`${ML_API}/api/paper-bets/summary`, { headers }),
        fetch(`${ML_API}/api/paper-bets?limit=25`, { headers }),
        fetch(`${ML_API}/api/paper-bets/trend?days=30`, { headers }),
      ]);

      if (!summaryResponse.ok || !betsResponse.ok || !trendResponse.ok) {
        throw new Error("Paper bankroll unavailable");
      }

      const summaryData = await summaryResponse.json();
      const betsData = await betsResponse.json();
      const trendData = await trendResponse.json();
      setSummary(summaryData?.summary ?? null);
      setBets(betsData?.bets ?? []);
      setTrend(trendData?.trend ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Paper bankroll unavailable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  if (loading) return <div className="card"><div className="skeleton" style={{ height: 400 }} /></div>;

  const netProfit = summary?.net_profit ?? 0;
  const chartData = trend.map((point) => ({
    date: point.date.slice(5),
    dailyProfit: point.net_profit,
    cumulativeProfit: point.cumulative_profit,
  }));

  return (
    <div>
      {error && <div className="error-message">{error}</div>}

      <div className="section-header">
        <h3>Paper Bankroll</h3>
        <button className="btn btn-sm btn-secondary" type="button" onClick={fetchData}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="stat-label"><DollarSign size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Settled Stake</div>
          <div className="stat-value">{fmt(summary?.settled_staked ?? 0)}</div>
          <div className="stat-sub">{fmt(summary?.pending_exposure ?? 0)} pending exposure</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label"><TrendingUp size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Net Profit</div>
          <div className="stat-value" style={{ color: netProfit >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(netProfit)}</div>
          <div className="stat-sub">{fmt(summary?.total_returned ?? 0)} returned</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">ROI</div>
          <div className="stat-value">{formatPct(summary?.roi ?? 0)}</div>
          <div className="stat-sub">{summary?.settled_bets ?? 0} settled bets</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">Win Rate</div>
          <div className="stat-value">{formatPct(summary?.win_rate ?? 0)}</div>
          <div className="stat-sub">{summary?.won_bets ?? 0}W / {summary?.lost_bets ?? 0}L / {summary?.void_bets ?? 0}V</div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="chart-container">
          <h4>Paper Bankroll Trend</h4>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="dailyProfit" name="Daily profit" stroke="var(--blue)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="cumulativeProfit" name="Cumulative profit" stroke="var(--green)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="section-header"><h3>Recent Paper Bet History</h3></div>
      {bets.length === 0 ? (
        <div className="empty-state"><h4>No paper bets yet</h4><p>Log paper bets from the Bets page to track ROI.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Selection</th><th>Sport</th><th>Status</th><th>Stake</th><th>Profit</th></tr></thead>
            <tbody>
              {bets.map((bet) => (
                <tr key={bet.id}>
                  <td>{new Date(bet.created_at).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{bet.selection}<br /><span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>{bet.event_name}</span></td>
                  <td>{formatLabel(bet.sport)}</td>
                  <td>{bet.status}</td>
                  <td>{fmt(bet.stake)} @ {bet.odds.toFixed(2)}</td>
                  <td style={{ color: (bet.profit ?? 0) >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                    {(bet.profit ?? 0) >= 0 ? <ArrowUpRight size={14} style={{ verticalAlign: "middle" }} /> : <ArrowDownRight size={14} style={{ verticalAlign: "middle" }} />}
                    {" "}{bet.profit == null ? "-" : fmt(Math.abs(bet.profit))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="disclaimer">
        Paper bankroll is for tracking simulated outcomes only. BetMate does not facilitate betting or handle payments.
      </div>
    </div>
  );
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
