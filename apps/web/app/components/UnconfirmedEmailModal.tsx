"use client";

import { useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { ShieldAlert, MailCheck, Loader2, CheckCircle2, X } from "lucide-react";

interface UnconfirmedEmailModalProps {
  open: boolean;
  onClose: () => void;
  actionName?: string;
}

export default function UnconfirmedEmailModal({
  open,
  onClose,
  actionName = "perform this action",
}: UnconfirmedEmailModalProps) {
  const { user, resendConfirmationEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  if (!open) return null;

  async function handleResend() {
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");
    try {
      await resendConfirmationEmail();
      setSuccessMessage("Verification email sent! Please check your inbox.");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to resend confirmation email.");
    } finally {
      setLoading(false);
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="unconfirmed-modal-title"
    >
      <div
        className="card"
        style={{
          maxWidth: "460px",
          width: "100%",
          backgroundColor: "#0b0e17",
          border: "1px solid rgba(245, 158, 11, 0.35)",
          boxShadow: "0 0 40px rgba(245, 158, 11, 0.15)",
          borderRadius: "1.25rem",
          padding: "2rem",
          position: "relative",
          color: "var(--text-primary)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close modal"
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
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              color: "#f59e0b",
            }}
          >
            <ShieldAlert size={28} />
          </div>

          <h2
            id="unconfirmed-modal-title"
            style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 0.5rem" }}
          >
            Email Verification Required
          </h2>
          <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
            To <strong>{actionName}</strong>, you must verify your email address (
            <span style={{ color: "#fde68a", fontWeight: 600 }}>{user?.email || "your account"}</span>).
            Unconfirmed accounts are restricted from write actions.
          </p>
        </div>

        {errorMessage && (
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
            {errorMessage}
          </div>
        )}

        {successMessage ? (
          <div
            style={{
              backgroundColor: "rgba(52, 211, 153, 0.12)",
              border: "1px solid rgba(52, 211, 153, 0.3)",
              color: "#6ee7b7",
              padding: "0.85rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.88rem",
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              marginBottom: "1.25rem",
            }}
          >
            <CheckCircle2 size={18} /> {successMessage}
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-block"
            onClick={handleResend}
            disabled={loading}
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.2)",
              border: "1px solid rgba(245, 158, 11, 0.5)",
              color: "#fbbf24",
              fontWeight: 700,
              padding: "0.85rem",
              fontSize: "0.95rem",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Sending Verification Email...
              </>
            ) : (
              <>
                <MailCheck size={18} /> Resend Verification Email
              </>
            )}
          </button>
        )}

        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={onClose}
          style={{ padding: "0.75rem" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
