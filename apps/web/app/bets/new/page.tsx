"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { ML_API } from "../../lib/mlApi";

export default function NewBetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [sport, setSport] = useState("racing");
  const [eventId, setEventId] = useState("");
  const [eventName, setEventName] = useState("");
  const [betType, setBetType] = useState("win");
  const [selection, setSelection] = useState("");
  const [odds, setOdds] = useState("");
  const [stake, setStake] = useState("10");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSport(params.get("sport") || "racing");
    setEventId(params.get("event_id") || "");
    setEventName(params.get("event_name") || "");
    setBetType(params.get("bet_type") || "win");
    setSelection(params.get("selection") || "");
    setOdds(params.get("odds") || "");
    setStake(params.get("stake") || "10");
    setNotes(params.get("notes") || "");
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${ML_API}/api/paper-bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport,
          event_id: eventId,
          event_name: eventName,
          bet_type: betType,
          selection,
          odds: odds ? Number(odds) : undefined,
          stake: Number(stake),
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to log paper bet");
      }
      router.push("/bets");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <button onClick={() => router.back()} className="btn btn-secondary btn-sm" style={{ marginBottom: "1rem" }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="card">
        <h3 style={{ marginBottom: "1.25rem", fontWeight: 700 }}>Log a Paper Bet</h3>
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Sport</label>
            <select className="form-input" value={sport} onChange={(e) => setSport(e.target.value)}>
              <option value="racing">Racing</option>
              <option value="nba">Basketball (NBA)</option>
              <option value="afl">AFL</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Event ID</label>
            <input className="form-input" placeholder="e.g. Squiggle game ID, NBA game ID, or race market ID" value={eventId} onChange={(e) => setEventId(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Event</label>
            <input className="form-input" placeholder="e.g. Collingwood vs Carlton" value={eventName} onChange={(e) => setEventName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Bet Type</label>
            <select className="form-input" value={betType} onChange={(e) => setBetType(e.target.value)}>
              <option value="win">Win</option>
              <option value="head_to_head">Head to Head</option>
              <option value="line">Line/Spread</option>
              <option value="over_under">Over/Under</option>
              <option value="place">Place</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Selection</label>
            <input className="form-input" placeholder="Must match the prediction selection for auto-settlement" value={selection} onChange={(e) => setSelection(e.target.value)} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Odds</label>
              <input className="form-input" type="number" step="0.01" min="1.01" placeholder="Blank uses fair odds" value={odds} onChange={(e) => setOdds(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Stake ($)</label>
              <input className="form-input" type="number" step="1" min="1" placeholder="e.g. 10" value={stake} onChange={(e) => setStake(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" placeholder="Optional rationale or source note" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            <Save size={16} /> {loading ? "Saving..." : "Log Paper Bet"}
          </button>
        </form>
      </div>

      <div className="disclaimer" style={{ marginTop: "1rem" }}>
        Paper bets are tracking records only. BetMate does not accept wagers or provide betting services.
      </div>
    </div>
  );
}
