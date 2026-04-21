"use client";

import type { MouseEventHandler } from "react";
import {
  AlertTriangle,
  Info,
  RotateCw,
  ShieldAlert,
} from "lucide-react";

export type ErrorStateTone = "info" | "warning" | "danger";

type ErrorStateProps = {
  title: string;
  message: string;
  tone?: ErrorStateTone;
  actionLabel?: string;
  onAction?: MouseEventHandler<HTMLButtonElement>;
  compact?: boolean;
};

export default function ErrorState({
  title,
  message,
  tone = "info",
  actionLabel,
  onAction,
  compact = false,
}: ErrorStateProps) {
  const Icon = getToneIcon(tone);

  return (
    <div className={`status-card tone-${tone} ${compact ? "compact" : ""}`}>
      <div className="status-card-icon">
        <Icon size={18} />
      </div>
      <div className="status-card-copy">
        <h4>{title}</h4>
        <p>{message}</p>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          className="btn btn-sm btn-secondary status-card-action"
          onClick={onAction}
        >
          <RotateCw size={14} />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function getToneIcon(tone: ErrorStateTone) {
  switch (tone) {
    case "danger":
      return ShieldAlert;
    case "warning":
      return AlertTriangle;
    default:
      return Info;
  }
}
