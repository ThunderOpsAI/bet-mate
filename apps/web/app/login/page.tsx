"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../providers/AuthProvider";

export default function LoginPage() {
  const { user, hasCompletedCompliance, authError, login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleCompliance, setGoogleCompliance] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirectTo(params.get("redirectTo") || "/");
    if (params.get("compliance") === "declined") {
      setError("Account confirmation is required to use BetMate.");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    router.replace(hasCompletedCompliance ? redirectTo : "/compliance");
  }, [hasCompletedCompliance, redirectTo, router, user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push(redirectTo);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle(googleCompliance);
    } catch (err: any) {
      setError(err.message || "Google sign in failed");
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>BetMate</h1>
          <p>Track smarter. Decide with data.</p>
        </div>

        {(error || authError) && <div className="error-message">{error || authError}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

        <div className="auth-divider"><span>or</span></div>

        <label className="checkbox-row auth-checkbox">
          <input
            type="checkbox"
            checked={googleCompliance}
            onChange={(event) => setGoogleCompliance(event.target.checked)}
          />
          <span>
            For new Google accounts, I confirm I am 18+ and accept the <Link href="/terms">Terms</Link>.
          </span>
        </label>

        <button type="button" className="btn btn-secondary btn-block" onClick={handleGoogleSignIn} disabled={loading}>
          Continue with Google
        </button>

        <div className="auth-footer">
          Don&apos;t have an account? <Link href="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}
