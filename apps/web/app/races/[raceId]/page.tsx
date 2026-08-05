"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Star, TrendingUp, AlertTriangle } from "lucide-react";
import { API_BASE, safeResponseJson } from "../../lib/api";

type Prediction = {
  horseName: string;
  barrier?: number;
  winProbability: number;
  placeProbability?: number;
  confidence: string;
  valueRating?: string;
  factors?: string[];
  odds?: number;
};

type RaceDetail = {
  id: string;
  raceNumber: number;
  venue?: string;
  raceDate?: string;
  distanceMeters?: number;
  distance?: number;
  trackCondition?: string;
  predictions: Prediction[];
};

const fmt = (n: number) => `${(n * 100).toFixed(0)}%`;

const confidenceColor: Record<string, string> = {
  high: "badge-green",
  medium: "badge-yellow",
  low: "badge-red",
};

const valueColor: Record<string, string> = {
  strong: "badge-green",
  fair: "badge-yellow",
  poor: "badge-red",
  avoid: "badge-muted",
};

export default function RaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const raceId = params.raceId as string;
  const [race, setRace] = useState<RaceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/races/${raceId}`)
      .then((r) => safeResponseJson(r))
      .then((data) => setRace(data?.race ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [raceId]);

  if (loading) {
    return <div className="card"><div className="skeleton" style={{ height: 300 }} /></div>;
  }

  if (!race) {
    return (
      <div className="empty-state">
        <h4>Race not found</h4>
        <button className="btn btn-secondary" onClick={() => router.push("/")}>Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => router.push("/")} className="btn btn-secondary btn-sm" style={{ marginBottom: "1rem" }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>
            {race.venue || "Race"} — Race {race.raceNumber}
          </h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {race.trackCondition && <span className="badge badge-blue">{race.trackCondition}</span>}
            <span className="badge badge-accent">{race.distanceMeters || race.distance}m</span>
          </div>
        </div>
      </div>

      <div className="section-header">
        <h3>Full Card — Sorted by AI Rank</h3>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {race.predictions.map((pred, i) => (
          <div key={pred.horseName} className="card" style={{ borderLeft: i === 0 ? "3px solid var(--accent)" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                  {i === 0 && <Star size={16} style={{ color: "var(--accent)" }} />}
                  <h4 style={{ fontSize: "1.05rem", fontWeight: 600 }}>
                    {pred.horseName}
                  </h4>
                  {pred.barrier != null && <span className="badge badge-muted">B{pred.barrier}</span>}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span className={`badge ${confidenceColor[pred.confidence] || "badge-muted"}`}>{pred.confidence}</span>
                  {pred.valueRating && <span className={`badge ${valueColor[pred.valueRating] || "badge-muted"}`}>{pred.valueRating} value</span>}
                </div>
                {pred.factors && pred.factors.length > 0 && (
                  <ul style={{ marginTop: "0.6rem", paddingLeft: "1rem", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    {pred.factors.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                )}
              </div>
              <div style={{ textAlign: "right", minWidth: 100 }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: i === 0 ? "var(--green)" : "var(--text-primary)" }}>
                  {fmt(pred.winProbability)}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Win Prob</div>
                {pred.odds && (
                  <div style={{ marginTop: "0.25rem", fontSize: "0.9rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                    ${pred.odds.toFixed(2)}
                  </div>
                )}
                {pred.placeProbability != null && (
                  <div style={{ marginTop: "0.25rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    {fmt(pred.placeProbability)} place
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="disclaimer" style={{ marginTop: "1.5rem" }}>
        <AlertTriangle size={14} style={{ verticalAlign: "middle" }} /> Predictions are AI-generated estimates — not guarantees. Always bet responsibly.
      </div>
    </div>
  );
}
