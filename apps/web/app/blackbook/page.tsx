"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  CheckCircle2,
  PencilLine,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { ML_API } from "../lib/mlApi";
import { useAuth } from "../providers/AuthProvider";

type BlackbookConfig = {
  runner: string;
  sport: string;
  bet_type: string;
  stake: number;
  enabled: boolean;
  probability_threshold: number;
  notify_phone: string | null;
  notify_email: string | null;
  notify_pushover_key: string | null;
};

type DraftRule = {
  runner: string;
  sport: "racing" | "afl" | "nba";
  bet_type: string;
  stake: number;
  probability_threshold: number;
  notify_phone: string;
  notify_email: string;
  notify_pushover_key: string;
};

const DEFAULT_RULE: DraftRule = {
  runner: "",
  sport: "racing",
  bet_type: "win",
  stake: 20,
  probability_threshold: 50,
  notify_phone: "",
  notify_email: "",
  notify_pushover_key: "",
};

export default function BlackbookPage() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<BlackbookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showBuilder, setShowBuilder] = useState(false);
  const [draft, setDraft] = useState<DraftRule>(DEFAULT_RULE);

  useEffect(() => {
    if (!user) return;

    const fetchConfigs = async () => {
      try {
        const res = await fetch(`${ML_API}/blackbook`, {
          headers: { Authorization: `Bearer ${user.id}` },
        });

        if (res.ok) {
          const data = await res.json();
          setConfigs(data.configs || []);
        }
      } catch (err) {
        console.error("Failed to fetch blackbook:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetchConfigs();
  }, [user]);

  const sortedConfigs = useMemo(() => {
    return [...configs].sort((a, b) => a.runner.localeCompare(b.runner));
  }, [configs]);

  const removeConfig = async (runner: string) => {
    if (!user) return;

    setConfigs((current) => current.filter((item) => item.runner !== runner));

    try {
      await fetch(`${ML_API}/blackbook/${encodeURIComponent(runner)}/auto-bet`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.id}` },
      });
    } catch (err) {
      console.error("Failed to remove config", err);
    }
  };

  const saveRule = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !draft.runner.trim()) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `${ML_API}/blackbook/${encodeURIComponent(draft.runner.trim())}/auto-bet`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.id}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            sport: draft.sport,
            bet_type: draft.bet_type,
            stake: draft.stake,
            enabled: true,
            probability_threshold: draft.probability_threshold,
            notify_phone: draft.notify_phone || null,
            notify_email: draft.notify_email || null,
            notify_pushover_key: draft.notify_pushover_key || null,
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to save watch rule");
      }

      const saved = (await response.json()) as BlackbookConfig;
      setConfigs((current) => {
        const next = current.filter((item) => item.runner !== saved.runner);
        return [...next, saved];
      });
      setDraft(DEFAULT_RULE);
      setShowBuilder(false);
      setMessage("Watch rule saved. It now appears in your Blackbook list.");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Failed to save watch rule");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        Please log in to view your Blackbook.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <BookOpen size={48} />
          <p>Loading Blackbook...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      <div
        className="page-header"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <BookOpen size={28} style={{ color: "var(--accent)" }} />
          <div>
            <h1 style={{ fontSize: "1.75rem", margin: 0 }}>Blackbook</h1>
            <p style={{ margin: "0.35rem 0 0", color: "var(--text-muted)" }}>
              Save runners or teams you want to revisit, then keep the trigger
              simple: stake, probability threshold, and optional notifications.
            </p>
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => setShowBuilder((current) => !current)}>
          <Plus size={16} /> {showBuilder ? "Close Builder" : "Add Watch Rule"}
        </button>
      </div>

      <div
        className="card"
        style={{
          marginBottom: "1rem",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.8rem" }}>
          <PencilLine size={18} style={{ color: "var(--accent)", marginTop: "0.15rem" }} />
          <div>
            <h3 style={{ margin: "0 0 0.5rem" }}>Current watch-rule scope</h3>
            <p style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.5 }}>
              This page saves straightforward watch rules only. You can track a
              horse or team, set a paper-bet stake, choose a model probability
              threshold, and add notification channels. Opponent rules, odds
              thresholds, and plain-English automation are not wired up here yet.
            </p>
          </div>
        </div>
      </div>

      {showBuilder ? (
        <form className="card" onSubmit={saveRule} style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Add a watch rule</h3>
          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <div className="form-group">
              <label className="form-label">Runner or Team</label>
              <input
                className="form-input"
                value={draft.runner}
                onChange={(event) => setDraft({ ...draft, runner: event.target.value })}
                placeholder={draft.sport === "racing" ? "e.g. Swift Star" : "e.g. Melbourne Demons"}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sport</label>
              <select
                className="form-input"
                value={draft.sport}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    sport: event.target.value as DraftRule["sport"],
                    bet_type: event.target.value === "racing" ? "win" : "head_to_head",
                  })
                }
              >
                <option value="racing">Racing</option>
                <option value="afl">AFL</option>
                <option value="nba">NBA</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Bet Type</label>
              <select
                className="form-input"
                value={draft.bet_type}
                onChange={(event) => setDraft({ ...draft, bet_type: event.target.value })}
              >
                {draft.sport === "racing" ? (
                  <>
                    <option value="win">Win</option>
                    <option value="place">Place</option>
                  </>
                ) : (
                  <option value="head_to_head">Head to Head</option>
                )}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Paper Bet Stake</label>
              <input
                className="form-input"
                type="number"
                min={1}
                step={1}
                value={draft.stake}
                onChange={(event) => setDraft({ ...draft, stake: Number(event.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Trigger Threshold</label>
              <input
                className="form-input"
                type="number"
                min={1}
                max={99}
                step={1}
                value={draft.probability_threshold}
                onChange={(event) =>
                  setDraft({ ...draft, probability_threshold: Number(event.target.value) })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Alerts</label>
              <input
                className="form-input"
                type="email"
                value={draft.notify_email}
                onChange={(event) => setDraft({ ...draft, notify_email: event.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="form-group">
              <label className="form-label">SMS Alerts</label>
              <input
                className="form-input"
                type="tel"
                value={draft.notify_phone}
                onChange={(event) => setDraft({ ...draft, notify_phone: event.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Push Key</label>
              <input
                className="form-input"
                value={draft.notify_pushover_key}
                onChange={(event) =>
                  setDraft({ ...draft, notify_pushover_key: event.target.value })
                }
                placeholder="Optional"
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              <Plus size={16} /> {saving ? "Saving..." : "Save Watch Rule"}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                setDraft(DEFAULT_RULE);
                setShowBuilder(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Quick ways to add something worth tracking</h3>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setDraft({ ...DEFAULT_RULE, sport: "racing", bet_type: "win" });
              setShowBuilder(true);
            }}
          >
            <Plus size={16} /> Add Horse
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setDraft({ ...DEFAULT_RULE, sport: "afl", bet_type: "head_to_head" });
              setShowBuilder(true);
            }}
          >
            <Plus size={16} /> Add Team
          </button>
          <Link href="/racing" className="btn btn-secondary">
            Browse Today&apos;s Runners
          </Link>
          <Link href="/afl" className="btn btn-secondary">
            Browse AFL Games
          </Link>
          <Link href="/nba" className="btn btn-secondary">
            Browse NBA Games
          </Link>
        </div>
      </div>

      {message ? (
        <div
          className="card"
          style={{
            marginBottom: "1rem",
            background: "rgba(34, 197, 94, 0.08)",
            border: "1px solid rgba(34, 197, 94, 0.2)",
            color: "var(--text-primary)",
          }}
        >
          {message}
        </div>
      ) : null}

      {sortedConfigs.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            background: "var(--surface)",
            borderRadius: "12px",
            border: "1px dashed var(--border)",
          }}
        >
          <p style={{ color: "var(--muted)", fontSize: "1.1rem" }}>
            Your Blackbook is empty.
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            Add a horse or team above, or browse today&apos;s races and games to save
            something you want to revisit.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {sortedConfigs.map((cfg) => (
            <div
              key={cfg.runner}
              style={{
                background: "var(--surface)",
                borderRadius: "12px",
                padding: "1.5rem",
                border: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: "0 0 0.5rem 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  {cfg.runner}
                  <span className="badge badge-accent" style={{ textTransform: "capitalize" }}>
                    {cfg.sport}
                  </span>
                  <span className="badge badge-blue">{cfg.bet_type.replaceAll("_", " ")}</span>
                </h3>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", color: "var(--muted)", fontSize: "0.9rem" }}>
                  <span>
                    <strong>Paper stake:</strong> ${cfg.stake}
                  </span>
                  <span>
                    <strong>Trigger:</strong> model win chance at {cfg.probability_threshold}%
                  </span>
                  {cfg.enabled ? (
                    <span style={{ color: "var(--green)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <CheckCircle2 size={14} /> Active
                    </span>
                  ) : (
                    <span style={{ color: "var(--red)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <ShieldAlert size={14} /> Paused
                    </span>
                  )}
                </div>
                <p style={{ margin: "0.75rem 0 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Saved as a simple watch rule. This page does not create opponent
                  conditions or odds-threshold logic yet.
                </p>
                {(cfg.notify_email || cfg.notify_phone || cfg.notify_pushover_key) && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                      fontSize: "0.85rem",
                      color: "var(--muted)",
                    }}
                  >
                    <Bell size={14} />
                    Notifications:
                    {[
                      cfg.notify_phone ? "SMS" : null,
                      cfg.notify_email ? "Email" : null,
                      cfg.notify_pushover_key ? "Push" : null,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}
              </div>

              <div>
                <button
                  className="btn btn-outline"
                  style={{ color: "var(--red)", borderColor: "var(--red)" }}
                  onClick={() => removeConfig(cfg.runner)}
                  title="Remove from Blackbook"
                >
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
