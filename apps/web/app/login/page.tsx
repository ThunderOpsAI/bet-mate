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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/";
  const confirmEmailParam = searchParams.get("confirmEmail");

  const { user, login, resendConfirmationEmail } = useAuth();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    // If user is already authenticated (not guest), redirect
    if (user && user.id !== "guest") {
      router.replace(returnUrl);
    }
  }, [user, router, returnUrl]);

  // Handle email confirmation parameter from email links
  useEffect(() => {
    if (!confirmEmailParam) return;
    async function confirmUserEmail() {
      try {
        const res = await fetch("/api/auth/confirm-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: confirmEmailParam }),
        });
        if (res.ok) {
          setSuccess(`Email ${confirmEmailParam} confirmed successfully! You may now sign in.`);
          setEmailOrUsername(confirmEmailParam ?? "");
        } else {
          setError("Failed to confirm email address. Link may be invalid or expired.");
        }
      } catch (err) {
        console.error("Email confirmation error:", err);
      }
    }
    void confirmUserEmail();
  }, [confirmEmailParam]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setUnconfirmedEmail(null);

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
      setSuccess("Welcome back! Redirecting to home...");
      setTimeout(() => {
        router.push(returnUrl);
      }, 500);
    } catch (err: any) {
      if (err.requireConfirmation) {
        setUnconfirmedEmail(err.email || emailOrUsername.trim());
        setError(err.message || "Please confirm your email address before logging in.");
      } else {
        setError(err.message || "Invalid email/username or password. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendConfirmation() {
    const targetEmail = unconfirmedEmail || emailOrUsername.trim();
    if (!targetEmail) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      if (res.ok) {
        setSuccess(`Confirmation email re-sent to ${targetEmail}. Please check your inbox.`);
      } else {
        setError("Failed to resend confirmation email. Please try again.");
      }
    } catch (err) {
      setError("Error dispatching email.");
    } finally {
      setResending(false);
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
          <div className="error-message flex flex-col gap-2" role="alert">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
            {unconfirmedEmail && (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resending}
                className="mt-1 text-xs font-bold text-amber-400 hover:underline text-left"
              >
                {resending ? "Sending Email..." : `Resend Confirmation Email to ${unconfirmedEmail}`}
              </button>
            )}
          </div>
        )}

        {success && (
          <div className="success-message" role="status">
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{success}</span>
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
                I confirm I am 18 years or older and agree to the <Link href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>Terms and Conditions</Link> and <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>Privacy Policy</Link> <span style={{ color: "var(--red)" }}>*</span>
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

        <div className="demo-account-box" style={{ marginTop: "1.5rem" }}>
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
