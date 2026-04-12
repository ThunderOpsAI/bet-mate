"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";

export default function CompliancePage() {
  const router = useRouter();
  const { acceptCompliance, declineCompliance } = useAuth();
  const [ageAccepted, setAgeAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ageAccepted || !termsAccepted) {
      setError("You must confirm you are 18+ and accept the Terms of Service to continue.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      await acceptCompliance();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save compliance confirmation.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDecline() {
    await declineCompliance();
    router.replace("/login?compliance=declined");
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div className="card">
        <h3 style={{ marginBottom: "0.75rem" }}>Account confirmation</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginBottom: "1rem" }}>
          BetMate is for adults only and provides sports statistics, tracking, and recommendations. It does not accept wagers or provide betting services.
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label className="checkbox-row">
            <input type="checkbox" checked={ageAccepted} onChange={(event) => setAgeAccepted(event.target.checked)} />
            <span>I confirm I am 18 years or older.</span>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
            <span>
              I accept the <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.
            </span>
          </label>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Continue"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={handleDecline}>
              Decline
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
