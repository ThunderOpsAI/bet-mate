"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import { ArrowLeft, Save } from "lucide-react";

export default function NewBetPage() {
  const { token, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [eventType, setEventType] = useState("race");
  const [eventName, setEventName] = useState("");
  const [betType, setBetType] = useState("win");
  const [selection, setSelection] = useState("");
  const [odds, setOdds] = useState("");
  const [stake, setStake] = useState("");
  const [notes, setNotes] = useState("");

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/bets`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          eventId: `manual-${Date.now()}`,
          eventName,
          betType,
          selection,
          odds: Number(odds),
          stake: Number(stake),
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to log bet");
      }
      await refreshUser();
      router.push("/bets");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <button onClick={() => router.back()} className="btn btn-secondary btn-sm" style={{ marginBottom: "1rem" }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="card">
        <h3 style={{ marginBottom: "1.25rem", fontWeight: 700 }}>Log a Bet</h3>
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Sport</label>
            <select className="form-input" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="race">Racing</option>
              <option value="nba_game">Basketball (NBA)</option>
              <option value="afl_game">AFL</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Event</label>
            <input className="form-input" placeholder="e.g. Flemington R3" value={eventName} onChange={(e) => setEventName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Bet Type</label>
            <select className="form-input" value={betType} onChange={(e) => setBetType(e.target.value)}>
              <option value="win">Win</option>
              <option value="place">Place</option>
              <option value="each_way">Each Way</option>
              <option value="exacta">Exacta</option>
              <option value="trifecta">Trifecta</option>
              <option value="first4">First 4</option>
              <option value="quinella">Quinella</option>
              <option value="head_to_head">Head to Head</option>
              <option value="line">Line/Spread</option>
              <option value="over_under">Over/Under</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Selection</label>
            <input className="form-input" placeholder="e.g. Golden Star" value={selection} onChange={(e) => setSelection(e.target.value)} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Odds</label>
              <input className="form-input" type="number" step="0.01" min="1.01" placeholder="e.g. 4.50" value={odds} onChange={(e) => setOdds(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Stake ($)</label>
              <input className="form-input" type="number" step="1" min="1" placeholder="e.g. 20" value={stake} onChange={(e) => setStake(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <input className="form-input" placeholder="Any notes about this bet" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            <Save size={16} /> {loading ? "Saving…" : "Log Bet"}
          </button>
        </form>
      </div>
    </div>
  );
}
