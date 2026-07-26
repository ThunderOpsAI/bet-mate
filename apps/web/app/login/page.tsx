"use client";
import { Suspense, useState, useEffect, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../providers/AuthProvider";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import SocialProfileModal from "../components/SocialProfileModal";
import { triggerGoogleOAuth } from "../lib/socialAuth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/";

  const { user, login } = useAuth();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [socialInfo, setSocialInfo] = useState("");

  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [socialEmail, setSocialEmail] = useState("");

  async function handleGoogleLogin() {
    setError("");
    setSocialInfo("Signing in with Google...");
    try {
      const result = await triggerGoogleOAuth();
      setSocialEmail(result.email);
      setSocialModalOpen(true);
      setSocialInfo("");
    } catch (err: any) {
      setSocialInfo("");
      setError(err.message || "Google authentication failed.");
    }
  }

  useEffect(() => {
    // If user is already authenticated (not guest), redirect
    if (user && user.id !== "guest") {
      router.replace(returnUrl);
    }
  }, [user, router, returnUrl]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSocialInfo("");

    if (!emailOrUsername.trim()) {
      setError("Please enter your email or username.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    if (!acceptedTerms) {
      setError("You must accept the Terms & Conditions to sign in.");
      return;
    }

    setSubmitting(true);
    try {
      await login(emailOrUsername.trim(), password);
      setSuccess("Welcome back! Redirecting to dashboard...");
      setTimeout(() => {
        router.push(returnUrl);
      }, 500);
    } catch (err: any) {
      setError(err.message || "Invalid email/username or password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDemoFill() {
    setEmailOrUsername("demo@betmate.local");
    setPassword("betmate123");
    setError("");
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <Image
            src="/brand/betmate-logo.png"
            alt="BetMate"
            width={188}
            height={60}
            className="auth-brand-logo"
            priority
          />
          <p>AI-Powered Betting Insights & Portfolio Management</p>
        </div>

        <div className="auth-tabs" role="tablist">
          <Link href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`} className="auth-tab active" role="tab" aria-selected="true">
            Sign In
          </Link>
          <Link href={`/register?returnUrl=${encodeURIComponent(returnUrl)}`} className="auth-tab" role="tab" aria-selected="false">
            Create Account
          </Link>
        </div>

        {error && (
          <div className="error-message" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="success-message" role="status">
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {socialInfo && (
          <div style={{ background: "rgba(99, 102, 241, 0.12)", color: "#a5b4fc", padding: "0.65rem 1rem", borderRadius: "var(--radius-sm)", fontSize: "0.82rem", marginBottom: "1rem" }}>
            {socialInfo}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="emailOrUsername">
              Email or Username
            </label>
            <div className="input-with-icon">
              <span className="input-icon-left">
                <User size={18} />
              </span>
              <input
                id="emailOrUsername"
                type="text"
                className="form-input has-left-icon"
                placeholder="e.g. alex@example.com or alex99"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                autoComplete="username"
                disabled={submitting}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label className="form-label" htmlFor="password" style={{ margin: 0 }}>
                Password
              </label>
            </div>
            <div className="input-with-icon">
              <span className="input-icon-left">
                <Lock size={18} />
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="form-input has-left-icon has-right-icon"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={submitting}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: "1rem" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", cursor: "pointer", fontSize: "0.85rem", color: "var(--text-primary)" }}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                disabled={submitting}
                style={{ marginTop: "0.2rem", accentColor: "var(--accent)" }}
                required
              />
              <span>
                I accept the <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "var(--accent)", textDecoration: "underline" }}>Terms &amp; Conditions</a> and <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "var(--accent)", textDecoration: "underline" }}>Privacy Policy</a> <span style={{ color: "var(--red)" }}>*</span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting || !acceptedTerms}
            style={{ marginTop: "1.25rem" }}
          >
            {submitting ? (
              <span>Signing in...</span>
            ) : (
              <>
                <LogIn size={18} /> Sign In
              </>
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>or sign in with</span>
        </div>

        <div className="social-auth-grid" style={{ gridTemplateColumns: "1fr" }}>
          <button type="button" className="btn-social" onClick={handleGoogleLogin} style={{ width: "100%", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z" />
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
              <path fill="#FBBC05" d="M5.3 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.3C.6 9.3 0 11.6 0 14s.6 4.7 1.6 6.7l3.7-2.9z" />
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16C3.5 19.8 7.4 23 12 23z" />
            </svg>
            Sign in with Google
          </button>
        </div>

        <div className="demo-account-box">
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent-hover)", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <Sparkles size={14} /> Quick Demo Account
            </span>
            <p>Fill demo credentials to evaluate immediately</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDemoFill}
          >
            Auto Fill
          </button>
        </div>

        <div className="auth-footer">
          <p>
            Don't want to sign in now?{" "}
            <Link href={returnUrl} style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
              Continue as Guest <ArrowRight size={14} />
            </Link>
          </p>
        </div>
      </div>

      <SocialProfileModal
        open={socialModalOpen}
        onClose={() => setSocialModalOpen(false)}
        provider="Google"
        email={socialEmail}
        returnUrl={returnUrl}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-container">
          <div className="auth-card">
            <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading BetMate Login...</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
