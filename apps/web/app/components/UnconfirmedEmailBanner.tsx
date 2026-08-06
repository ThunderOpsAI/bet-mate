"use client";

import { useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { AlertTriangle, MailCheck, Loader2, CheckCircle2, X } from "lucide-react";

export default function UnconfirmedEmailBanner() {
  const { user, resendConfirmationEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.id === "guest" || user.emailConfirmed !== false || dismissed) {
    return null;
  }

  async function handleResend() {
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");
    try {
      await resendConfirmationEmail();
      setSuccessMessage("Confirmation email sent! Check your inbox.");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to resend confirmation email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="region"
      aria-label="Email verification notice"
      style={{
        backgroundColor: "rgba(245, 158, 11, 0.12)",
        borderBottom: "1px solid rgba(245, 158, 11, 0.3)",
        color: "#fde68a",
        padding: "0.65rem 1.25rem",
        fontSize: "0.85rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flex: 1 }}>
        <AlertTriangle size={18} style={{ color: "#f59e0b", flexShrink: 0 }} />
        <span>
          <strong>Email Verification Required:</strong> Please confirm your email address (<strong>{user.email}</strong>) to access all features.
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
        {successMessage ? (
          <span style={{ color: "#34d399", display: "inline-flex", alignItems: "center", gap: "0.35rem", fontWeight: 600 }}>
            <CheckCircle2 size={16} /> {successMessage}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={loading}
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.2)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              color: "#fbbf24",
              borderRadius: "0.375rem",
              padding: "0.35rem 0.75rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              transition: "all 0.15s ease",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Sending...
              </>
            ) : (
              <>
                <MailCheck size={14} /> Resend Verification
              </>
            )}
          </button>
        )}

        {errorMessage && (
          <span style={{ color: "#f87171", fontSize: "0.78rem" }}>{errorMessage}</span>
        )}

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss banner"
          style={{
            background: "none",
            border: "none",
            color: "#fde68a",
            cursor: "pointer",
            opacity: 0.7,
            padding: "0.2rem",
            display: "inline-flex",
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
