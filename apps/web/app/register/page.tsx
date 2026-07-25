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

import SocialProfileModal from "../components/SocialProfileModal";

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

  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [socialProvider, setSocialProvider] = useState<"Google" | "Apple">("Google");
  const [socialEmail, setSocialEmail] = useState("");

  function handleSocialLogin(provider: "Google" | "Apple") {
    setSocialProvider(provider);
    const mockEmail = provider === "Google" ? "user@gmail.com" : "user@icloud.com";
    setSocialEmail(mockEmail);
    setSocialModalOpen(true);
  }

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
            <label className="form-label">Starting Bankroll</label>
            <div
              className="form-input"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontWeight: 700,
                color: "var(--accent)",
                backgroundColor: "rgba(6, 182, 212, 0.08)",
                border: "1px solid rgba(6, 182, 212, 0.25)",
                cursor: "not-allowed",
                padding: "0.75rem 0.85rem",
              }}
            >
              <DollarSign size={18} />
              <span>
                $10,000{" "}
                <span style={{ fontWeight: 400, fontSize: "0.82rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                  (Locked Starting Bankroll)
                </span>
              </span>
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

        <div className="auth-divider">
          <span>or sign up with</span>
        </div>

        <div className="social-auth-grid">
          <button type="button" className="btn-social" onClick={() => handleSocialLogin("Google")}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z" />
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
              <path fill="#FBBC05" d="M5.3 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.3C.6 9.3 0 11.6 0 14s.6 4.7 1.6 6.7l3.7-2.9z" />
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16C3.5 19.8 7.4 23 12 23z" />
            </svg>
            Google
          </button>

          <button type="button" className="btn-social" onClick={() => handleSocialLogin("Apple")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.09c.67-.82 1.13-1.96.99-3.09-1 .04-2.22.67-2.93 1.5-.64.74-1.2 1.92-1.05 3.05 1.12.09 2.27-.56 2.99-1.46z"/>
            </svg>
            Apple
          </button>
        </div>

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

      <SocialProfileModal
        open={socialModalOpen}
        onClose={() => setSocialModalOpen(false)}
        provider={socialProvider}
        email={socialEmail}
        returnUrl={returnUrl}
      />
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
