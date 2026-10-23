"use client";

import React from "react";
import Link from "next/link";
import { Lock, LogIn, UserPlus, X, ShieldAlert } from "lucide-react";

interface GuestModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export default function GuestModal({
  open,
  onClose,
  title = "Guest Mode Restricted",
  message = "Guest mode allows browsing main sport and racing pages. Placing bets, analytics, strategies, and blackbook rules are available for registered accounts.",
}: GuestModalProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 100000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "var(--bg-secondary, #0f172a)",
          border: "1px solid var(--border, #1e293b)",
          borderRadius: "16px",
          padding: "1.75rem",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
          position: "relative",
          color: "var(--text-primary, #f8fafc)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "none",
            border: "none",
            color: "var(--text-muted, #94a3b8)",
            cursor: "pointer",
            padding: "0.25rem",
            borderRadius: "6px",
          }}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "1rem" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              backgroundColor: "rgba(6, 182, 212, 0.12)",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent, #06b6d4)",
              flexShrink: 0,
            }}
          >
            <Lock size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>{title}</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Account Required
            </span>
          </div>
        </div>

        <p style={{ fontSize: "0.9rem", color: "var(--text-secondary, #cbd5e1)", lineHeight: 1.5, marginBottom: "1.5rem" }}>
          {message}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          <Link
            href="/register"
            onClick={onClose}
            className="btn btn-primary btn-block"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem", fontWeight: 700 }}
          >
            <UserPlus size={18} /> Create Account
          </Link>
          <Link
            href="/login"
            onClick={onClose}
            className="btn btn-secondary btn-block"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem", fontWeight: 600 }}
          >
            <LogIn size={18} /> Sign In
          </Link>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted, #94a3b8)",
              fontSize: "0.82rem",
              cursor: "pointer",
              marginTop: "0.25rem",
              padding: "0.4rem",
            }}
          >
            Continue browsing as guest
          </button>
        </div>
      </div>
    </div>
  );
}
