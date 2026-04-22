"use client";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../providers/AuthProvider";
import { Save, SlidersHorizontal, User, RefreshCw } from "lucide-react";
import { ML_API } from "../lib/mlApi";
import { API_BASE } from "../lib/api";
import { useActionGuard } from "../lib/useActionGuard";

type JamesRuleSet = {
  display_name: string;
  min_edge: number;
  min_confidence: "high" | "medium" | "low";
  max_bets_per_day: number;
  max_stake_per_bet: number;
  kelly_fraction: number;
  allowed_markets: string[];
  allow_multis: boolean;
  max_multi_legs: number;
  sport_weights: {
    racing: number;
    afl: number;
    nba: number;
  };
  notes: string;
};

function SettingsContent() {
  const { user, token, refreshUser } = useAuth();
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [jamesConfig, setJamesConfig] = useState<JamesRuleSet | null>(null);
  const [jamesLoading, setJamesLoading] = useState(true);
  const [jamesSaving, setJamesSaving] = useState(false);
  const [jamesMessage, setJamesMessage] = useState("");
  const [resettingBankroll, setResettingBankroll] = useState(false);
  const { requireAuthAction } = useActionGuard();

  useEffect(() => {
    const loadJames = async () => {
      try {
        const response = await fetch(`${ML_API}/api/strategy-profiles/james`);
        const data = await response.json();
        const ruleSet = data?.rule_set ?? null;
        if (!ruleSet) {
          setJamesConfig(null);
          return;
        }
        setJamesConfig({
          ...ruleSet,
          allowed_markets: (ruleSet.allowed_markets ?? []).filter((market: string) => market !== "quinella"),
        });
      } catch (err) {
        console.error("Failed to load James config", err);
      } finally {
        setJamesLoading(false);
      }
    };
    void loadJames();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    requireAuthAction(async () => {
      setError("");
      setSuccess("");
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/user/profile`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ username, email }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Update failed");
        }
        await refreshUser();
        setSuccess("Profile updated!");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });
  }

  async function handleResetBankroll() {
    requireAuthAction(async () => {
      if (!confirm("Are you sure you want to reset your bankroll baseline to your current bankroll amount? This doesn't delete prediction histories.")) return;
      setResettingBankroll(true);
      try {
        const res = await fetch(`${API_BASE}/user/bankroll/reset`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error("Failed to reset bankroll baseline");
        await refreshUser();
        setSuccess("Bankroll baseline reset!");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setResettingBankroll(false);
      }
    });
  }

  async function handleJamesSubmit(event: FormEvent) {
    event.preventDefault();
    requireAuthAction(async () => {
      if (!jamesConfig) return;
      setJamesSaving(true);
      setJamesMessage("");
      try {
        const response = await fetch(`${ML_API}/api/strategy-profiles/james`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(jamesConfig),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.detail || "James config update failed");
        }
        const data = await response.json();
        setJamesConfig(data.rule_set);
        setJamesMessage("James strategy saved. Changes apply on the next daily card generation.");
      } catch (err: any) {
        setJamesMessage(err.message);
      } finally {
        setJamesSaving(false);
      }
    });
  }

  function toggleMarket(market: string) {
    if (!jamesConfig) return;
    const exists = jamesConfig.allowed_markets.includes(market);
    setJamesConfig({
      ...jamesConfig,
      allowed_markets: exists
        ? jamesConfig.allowed_markets.filter((entry) => entry !== market)
        : [...jamesConfig.allowed_markets, market],
    });
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div className="card">
        <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem", fontWeight: 700 }}>
          <User size={20} /> Profile Settings
        </h3>

        {error && <div className="error-message">{error}</div>}
        {success && <div style={{ background: "var(--green-bg)", color: "var(--green)", padding: "0.65rem 1rem", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", marginBottom: "1rem" }}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Save size={16} /> {loading ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h4 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem" }}>Account Info</h4>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
          User ID: <code style={{ fontSize: "0.8rem", background: "var(--bg-glass)", padding: "0.15rem 0.4rem", borderRadius: 4 }}>{user?.id}</code>
        </p>

        <h4 style={{ fontSize: "0.95rem", fontWeight: 600, marginTop: "1.25rem", marginBottom: "0.75rem" }}>Reset Baseline</h4>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
          Recalculate your ROI from your current bankroll. Useful when extracting profits without dropping your stats. Does not delete paper bet history.
        </p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleResetBankroll} disabled={resettingBankroll}>
          <RefreshCw size={14} /> {resettingBankroll ? "Resetting…" : "Reset Bankroll Baseline"}
        </button>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <SlidersHorizontal size={18} /> James Strategy Profile
        </h3>
        {jamesLoading ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Loading James configuration...</p>
        ) : jamesConfig ? (
          <form onSubmit={handleJamesSubmit}>
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                className="form-input"
                value={jamesConfig.display_name}
                onChange={(event) => setJamesConfig({ ...jamesConfig, display_name: event.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Minimum Edge</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={jamesConfig.min_edge}
                onChange={(event) => setJamesConfig({ ...jamesConfig, min_edge: Number(event.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Minimum Confidence</label>
              <select
                className="form-input"
                value={jamesConfig.min_confidence}
                onChange={(event) => setJamesConfig({ ...jamesConfig, min_confidence: event.target.value as JamesRuleSet["min_confidence"] })}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Max Bets Per Day</label>
              <input
                className="form-input"
                type="number"
                value={jamesConfig.max_bets_per_day}
                onChange={(event) => setJamesConfig({ ...jamesConfig, max_bets_per_day: Number(event.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Max Stake Per Bet</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={jamesConfig.max_stake_per_bet}
                onChange={(event) => setJamesConfig({ ...jamesConfig, max_stake_per_bet: Number(event.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Kelly Fraction</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={jamesConfig.kelly_fraction}
                onChange={(event) => setJamesConfig({ ...jamesConfig, kelly_fraction: Number(event.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Allowed Markets</label>
              <div className="filter-bar" style={{ marginTop: "0.5rem" }}>
                {["win", "place", "head_to_head"].map((market) => (
                  <button
                    key={market}
                    type="button"
                    className={`filter-chip ${jamesConfig.allowed_markets.includes(market) ? "active" : ""}`}
                    onClick={() => toggleMarket(market)}
                  >
                    {market}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Allow Multis</label>
              <select
                className="form-input"
                value={jamesConfig.allow_multis ? "yes" : "no"}
                onChange={(event) => setJamesConfig({ ...jamesConfig, allow_multis: event.target.value === "yes" })}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Max Multi Legs</label>
              <input
                className="form-input"
                type="number"
                value={jamesConfig.max_multi_legs}
                onChange={(event) => setJamesConfig({ ...jamesConfig, max_multi_legs: Number(event.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sport Weights</label>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {(["racing", "afl", "nba"] as const).map((sport) => (
                  <input
                    key={sport}
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={jamesConfig.sport_weights[sport]}
                    onChange={(event) =>
                      setJamesConfig({
                        ...jamesConfig,
                        sport_weights: {
                          ...jamesConfig.sport_weights,
                          [sport]: Number(event.target.value),
                        },
                      })
                    }
                    aria-label={`${sport} weight`}
                  />
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                value={jamesConfig.notes}
                onChange={(event) => setJamesConfig({ ...jamesConfig, notes: event.target.value })}
                rows={4}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={jamesSaving}>
              <Save size={16} /> {jamesSaving ? "Saving..." : "Save James Config"}
            </button>
            {jamesMessage && (
              <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>{jamesMessage}</p>
            )}
          </form>
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>James configuration is unavailable.</p>
        )}
      </div>

      <div className="disclaimer" style={{ marginTop: "1rem" }}>
        <strong>18+</strong> | This app is for information and tracking purposes only. We do not facilitate betting or handle payments. Please gamble responsibly.
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="card"><div className="skeleton" style={{ height: 200 }} /></div>}>
      <SettingsContent />
    </Suspense>
  );
}
