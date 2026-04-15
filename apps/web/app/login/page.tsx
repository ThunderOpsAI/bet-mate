"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../providers/AuthProvider";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/";

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(emailOrUsername, password);
      router.push(returnUrl);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>BetMate</h1>
          <p>Track smarter. Bet informed.</p>
        </div>

        {searchParams.get("returnUrl") && !error && (
          <div className="info-message" style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--bg-secondary)", borderRadius: 6, fontSize: "0.9rem" }}>
            Please log in to continue your action.
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email or Username</label>
            <input
              id="login-email"
              className="form-input"
              type="text"
              placeholder="you@example.com"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="auth-footer">
          Don&apos;t have an account? <Link href="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}
