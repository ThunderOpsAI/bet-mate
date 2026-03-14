"use client";
import { useState, type FormEvent } from "react";
import { useAuth } from "../providers/AuthProvider";
import { Save, User } from "lucide-react";

export default function SettingsPage() {
  const { user, token, refreshUser } = useAuth();
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/user/profile`, {
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
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          User ID: <code style={{ fontSize: "0.8rem", background: "var(--bg-glass)", padding: "0.15rem 0.4rem", borderRadius: 4 }}>{user?.id}</code>
        </p>
      </div>

      <div className="disclaimer" style={{ marginTop: "1rem" }}>
        <strong>18+</strong> | This app is for information and tracking purposes only. We do not facilitate betting or handle payments. Please gamble responsibly.
      </div>
    </div>
  );
}
