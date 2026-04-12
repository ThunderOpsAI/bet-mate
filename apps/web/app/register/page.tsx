"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../providers/AuthProvider";

export default function RegisterPage() {
  const { user, hasCompletedCompliance, authError, register, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [bankroll, setBankroll] = useState("1000");
  const [ageConfirm, setAgeConfirm] = useState(false);
  const [termsConfirm, setTermsConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    router.replace(hasCompletedCompliance ? "/" : "/compliance");
  }, [hasCompletedCompliance, router, user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ageConfirm || !termsConfirm) {
      setError("You must confirm you are 18+ and accept the Terms of Service.");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const result = await register(email, username, password, Number(bankroll) || 1000);
      if (result.requiresEmailConfirmation) {
        setSuccess("Check your email to confirm your BetMate account, then sign in.");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    if (!ageConfirm || !termsConfirm) {
      setError("Confirm you are 18+ and accept the Terms before continuing with Google.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle(true);
    } catch (err: any) {
      setError(err.message || "Google sign up failed");
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>BetMate</h1>
          <p>Create your account</p>
        </div>

        {(error || authError) && <div className="error-message">{error || authError}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email</label>
            <input id="reg-email" className="form-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-username">Username</label>
            <input id="reg-username" className="form-input" type="text" placeholder="Pick a username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <input id="reg-password" className="form-input" type="password" placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-bankroll">Starting Bankroll ($AUD)</label>
            <input id="reg-bankroll" className="form-input" type="number" min="50" max="999999" step="50" value={bankroll} onChange={(e) => setBankroll(e.target.value)} required />
            <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: "0.3rem" }}>
              This does NOT connect to a bookmaker — it&apos;s for tracking only.
            </p>
          </div>
          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input id="reg-age" type="checkbox" checked={ageConfirm} onChange={(e) => setAgeConfirm(e.target.checked)} />
            <label htmlFor="reg-age" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", cursor: "pointer" }}>I confirm I am 18 years or older</label>
          </div>
          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input id="reg-terms" type="checkbox" checked={termsConfirm} onChange={(e) => setTermsConfirm(e.target.checked)} />
            <label htmlFor="reg-terms" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", cursor: "pointer" }}>
              I accept the <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>
            </label>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <button type="button" className="btn btn-secondary btn-block" onClick={handleGoogleSignUp} disabled={loading}>
          Continue with Google
        </button>

        <div className="auth-footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
