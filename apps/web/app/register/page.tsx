"use client";
import { Suspense, useState, useEffect, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../providers/AuthProvider";
import {
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  ArrowRight,
} from "lucide-react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/";

  const { user, register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [startingBankroll, setStartingBankroll] = useState(10000);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (user && user.id !== "guest") {
      router.replace(returnUrl);
    }
  }, [user, router, returnUrl]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!username.trim() || username.trim().length < 3) {
      setError("Username must be at least 3 characters long.");
      return;
    }
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (startingBankroll <= 0) {
      setError("Starting bankroll must be a positive number.");
      return;
    }
    if (!acceptedTerms) {
      setError("You must accept the Terms & Conditions to create an account.");
      return;
    }

    setSubmitting(true);
    try {
      await register(email.trim(), username.trim(), password, startingBankroll);
      setSuccess("Account created successfully! Redirecting to dashboard...");
      setTimeout(() => {
        router.push(returnUrl);
      }, 500);
    } catch (err: any) {
      setError(err.message || "Registration failed. Email or username may already be in use.");
    } finally {
      setSubmitting(false);
    }
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
          <p>Create your BetMate account & set up your portfolio</p>
        </div>

        <div className="auth-tabs" role="tablist">
          <Link href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`} className="auth-tab" role="tab" aria-selected="false">
            Sign In
          </Link>
          <Link href={`/register?returnUrl=${encodeURIComponent(returnUrl)}`} className="auth-tab active" role="tab" aria-selected="true">
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

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <div className="input-with-icon">
              <span className="input-icon-left">
                <Mail size={18} />
              </span>
              <input
                id="email"
                type="email"
                className="form-input has-left-icon"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={submitting}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Username
            </label>
            <div className="input-with-icon">
              <span className="input-icon-left">
                <User size={18} />
              </span>
              <input
                id="username"
                type="text"
                className="form-input has-left-icon"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={submitting}
                required
                minLength={3}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <div className="input-with-icon">
              <span className="input-icon-left">
                <Lock size={18} />
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="form-input has-left-icon has-right-icon"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={submitting}
                required
                minLength={8}
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

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <div className="input-with-icon">
              <span className="input-icon-left">
                <Lock size={18} />
              </span>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                className="form-input has-left-icon"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={submitting}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="startingBankroll">
              Starting Bankroll ($)
            </label>
            <div className="input-with-icon" style={{ marginBottom: "0.5rem" }}>
              <span className="input-icon-left">
                <DollarSign size={18} />
              </span>
              <input
                id="startingBankroll"
                type="number"
                min="10"
                className="form-input has-left-icon"
                value={startingBankroll}
                onChange={(e) => setStartingBankroll(Number(e.target.value))}
                disabled={submitting}
              />
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {[1000, 2500, 5000, 10000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`badge ${startingBankroll === preset ? "badge-accent" : "badge-muted"}`}
                  style={{ cursor: "pointer", border: "1px solid var(--border)", padding: "0.35rem 0.65rem", fontSize: "0.82rem" }}
                  onClick={() => setStartingBankroll(preset)}
                >
                  ${preset.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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

            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", cursor: "pointer", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              <input
                type="checkbox"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                disabled={submitting}
                style={{ marginTop: "0.2rem", accentColor: "var(--accent)" }}
              />
              <span>
                Send me strategy updates, model alerts, and product news (optional)
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
              <span>Creating Account...</span>
            ) : (
              <>
                <UserPlus size={18} /> Create Account
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{" "}
            <Link href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}>
              Sign in here
            </Link>
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            <Link href={returnUrl} style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>
              Continue as Guest <ArrowRight size={12} />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-container">
          <div className="auth-card">
            <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading BetMate Register...</p>
          </div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
