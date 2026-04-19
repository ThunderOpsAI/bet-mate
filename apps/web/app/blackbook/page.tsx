"use client";
import { useEffect, useState } from "react";
import { BookOpen, Trash2, Bell, ShieldAlert, CheckCircle2 } from "lucide-react";
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

export default function BlackbookPage() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<BlackbookConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchConfigs = async () => {
      try {
        const res = await fetch(`${ML_API}/blackbook`, {
          headers: {
            Authorization: `Bearer ${user.id}`,
          },
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
    fetchConfigs();
  }, [user]);

  const removeConfig = async (runner: string) => {
    if (!user) return;
    setConfigs(c => c.filter(item => item.runner !== runner));
    try {
      await fetch(`${ML_API}/blackbook/${encodeURIComponent(runner)}/auto-bet`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${user.id}`,
        },
      });
    } catch (err) {
      console.error("Failed to remove config", err);
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
    <div style={{ padding: "0" }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <BookOpen size={28} style={{ color: "var(--accent)" }} />
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Blackbook</h1>
      </div>
      
      {configs.length === 0 ? (
        <div style={{ padding: "3rem", textAlign: "center", background: "var(--surface)", borderRadius: "12px", border: "1px dashed var(--border)" }}>
          <p style={{ color: "var(--muted)", fontSize: "1.1rem" }}>Your blackbook is empty.</p>
          <p style={{ marginTop: "0.5rem" }}>Watch runners or teams from the Racing or Sports pages to set up auto-bets and notifications.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {configs.map((cfg) => (
            <div key={cfg.runner} style={{ 
              background: "var(--surface)", 
              borderRadius: "12px", 
              padding: "1.5rem",
              border: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem"
            }}>
              <div>
                <h3 style={{ margin: "0 0 0.5rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {cfg.runner}
                  <span className="badge badge-accent" style={{ textTransform: "capitalize" }}>{cfg.sport}</span>
                  <span className="badge badge-blue">To {cfg.bet_type.toUpperCase()}</span>
                </h3>
                <div style={{ display: "flex", gap: "1.5rem", color: "var(--muted)", fontSize: "0.9rem" }}>
                  <span>
                     <strong>Stake:</strong> ${cfg.stake}
                  </span>
                  <span>
                     <strong>Trigger:</strong> {cfg.probability_threshold}% probability
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
                
                {(cfg.notify_email || cfg.notify_phone || cfg.notify_pushover_key) && (
                  <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.85rem", color: "var(--muted)" }}>
                    <Bell size={14} /> Notifications: 
                    {[
                      cfg.notify_phone ? "SMS" : null,
                      cfg.notify_email ? "Email" : null,
                      cfg.notify_pushover_key ? "Push" : null
                    ].filter(Boolean).join(", ")}
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
