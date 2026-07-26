"use client";

import React, { useState } from "react";
import { User, DollarSign, X, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";

interface SocialProfileModalProps {
  open: boolean;
  onClose: () => void;
  provider?: "Google";
  email: string;
  returnUrl?: string;
}

export default function SocialProfileModal({
  open,
  onClose,
  provider = "Google",
  email,
  returnUrl = "/",
}: SocialProfileModalProps) {
  const { register } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState(
    email ? email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") : ""
  );
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.trim() || username.trim().length < 3) {
      setError("Please enter a username with at least 3 characters.");
      return;
    }
    if (!acceptedTerms) {
      setError("You must accept the Terms & Conditions to create your account.");
      return;
    }

    setSubmitting(true);
    try {
      // Register with social provider email & chosen username, locked starting bankroll $10,000
      const generatedPassword = `social_${provider.toLowerCase()}_${Date.now()}`;
      await register(email, username.trim(), generatedPassword, 10000);
      onClose();
      router.push(returnUrl);
    } catch (err: any) {
      setError(err.message || "Failed to complete account setup. Please try another username.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(3, 7, 18, 0.85)",
        backdropFilter: "blur(12px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: "480px",
          width: "100%",
          backgroundColor: "#0b0e17",
          border: "1px solid rgba(6, 182, 212, 0.3)",
          boxShadow: "0 0 40px rgba(6, 182, 212, 0.15)",
          borderRadius: "1.25rem",
          padding: "2rem",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1.25rem",
            right: "1.25rem",
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "0.25rem",
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "rgba(6, 182, 212, 0.12)",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              color: "var(--accent)",
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 0.4rem" }}>
            Complete Your BetMate Account
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
            Successfully authenticated via <strong style={{ color: "var(--accent)" }}>{provider}</strong> ({email}). Choose your username below to finalize setup.
          </p>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
              marginBottom: "1.25rem",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: "1.25rem" }}>
            <label className="form-label" htmlFor="socialUsername">
              Choose Username
            </label>
            <div className="input-with-icon">
              <span className="input-icon-left">
                <User size={18} />
              </span>
              <input
                id="socialUsername"
                type="text"
                className="form-input has-left-icon"
                placeholder="e.g. betmate_pro"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                autoFocus
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: "1.25rem" }}>
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
                  (Standard Starting Bankroll)
                </span>
              </span>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
              <span>Send me strategy updates, model alerts, and product news (optional)</span>
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting || !acceptedTerms}
            style={{ padding: "0.85rem", fontSize: "0.95rem" }}
          >
            {submitting ? (
              <span>Finalizing Account...</span>
            ) : (
              <>
                <CheckCircle2 size={18} /> Complete Account &amp; Sign In
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
