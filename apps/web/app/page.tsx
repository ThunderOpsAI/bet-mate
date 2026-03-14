"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./providers/AuthProvider";
import { TrendingUp, DollarSign, Target, Zap, MapPin, Clock, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";

type RacePick = { horseName: string; winProbability: number; confidence: string };
type Race = { id: string; raceNumber: number; postTime: string; distance: number; topPicks: RacePick[] };
type Meeting = { venueName: string; raceDate: string; races: Race[] };

const fmt = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

export default function DashboardPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [bankroll, setBankroll] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API}/races/today`).then((r) => r.json()),
      fetch(`${API}/user/bankroll`, { headers }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([racesData, bankrollData]) => {
        setMeetings(racesData?.meetings ?? []);
        setBankroll(bankrollData?.bankroll ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, API]);

  if (loading) {
    return (
      <div>
        <div className="stats-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card"><div className="skeleton" style={{ height: 60 }} /></div>
          ))}
        </div>
        <div className="races-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card"><div className="skeleton" style={{ height: 120 }} /></div>
          ))}
        </div>
      </div>
    );
  }

  const bk = bankroll;

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="stat-label"><DollarSign size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Balance</div>
          <div className="stat-value">{fmt(bk?.current ?? user?.currentBankroll ?? 0)}</div>
          <div className="stat-sub">{bk ? `Started at ${fmt(bk.starting)}` : ""}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label"><TrendingUp size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Net Profit</div>
          <div className="stat-value" style={{ color: (bk?.netProfit ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>
            {bk ? fmt(bk.netProfit) : "$0.00"}
          </div>
          <div className="stat-sub">{bk ? `ROI: ${bk.roi}%` : ""}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label"><Target size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Win Rate</div>
          <div className="stat-value">{bk?.winRate ?? 0}%</div>
          <div className="stat-sub">{bk ? `${bk.wonBets}W / ${bk.totalBets - bk.wonBets}L` : "No bets yet"}</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label"><Zap size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Total Bets</div>
          <div className="stat-value">{bk?.totalBets ?? 0}</div>
          <div className="stat-sub">{bk ? `Staked: ${fmt(bk.totalStaked)}` : ""}</div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Link href="/bets/new" className="btn btn-primary"><Plus size={16} /> Log a Bet</Link>
      </div>

      {/* Today's Races */}
      <div className="section-header">
        <h3>🏇 Today&apos;s Races</h3>
      </div>

      {meetings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><MapPin size={48} /></div>
          <h4>No races scheduled today</h4>
          <p>Check back when meeting data is available.</p>
        </div>
      ) : (
        meetings.map((meeting) => (
          <div key={`${meeting.venueName}-${meeting.raceDate}`} className="venue-group">
            <h3><MapPin size={18} /> {meeting.venueName} <span className="badge badge-accent">{meeting.raceDate}</span></h3>
            <div className="races-grid">
              {meeting.races.map((race) => (
                <div key={race.id} className="race-card" onClick={() => router.push(`/races/${race.id}`)}>
                  <div className="race-header">
                    <span className="race-number">Race {race.raceNumber}</span>
                    <div className="race-meta">
                      <span><Clock size={13} style={{ verticalAlign: "middle" }} /> {new Date(race.postTime).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span>{race.distance}m</span>
                    </div>
                  </div>
                  <ul className="picks-list">
                    {race.topPicks.map((pick, i) => (
                      <li key={pick.horseName} className="pick-row">
                        <span className="pick-name">
                          <span className={`pick-rank rank-${i + 1}`}>{i + 1}</span>
                          {pick.horseName}
                        </span>
                        <span className="pick-prob" style={{ color: i === 0 ? "var(--green)" : "var(--text-secondary)" }}>
                          {(pick.winProbability * 100).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--accent)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      View Details <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Disclaimer */}
      <div className="disclaimer">
        ⚠️ <strong>Disclaimer:</strong> This app is for information and tracking purposes only. We do not facilitate betting or handle payments. Predictions are not guarantees. Past performance does not indicate future results. Please gamble responsibly. If you need help, visit <a href="https://www.gamblinghelponline.org.au/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--yellow)", textDecoration: "underline" }}>Gambling Help Online</a>.
      </div>
    </div>
  );
}
