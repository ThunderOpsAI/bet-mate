"use client";

import type { ConfidenceSignal, UrgencySignal } from "../lib/predictionSignals";

export function ConfidenceBadge({ signal }: { signal: ConfidenceSignal }) {
  return (
    <span className={`signal-badge confidence ${signal.tone}`} title={signal.reason}>
      {signal.label}
    </span>
  );
}

export function UrgencyBadge({ signal }: { signal: UrgencySignal }) {
  return <span className={`signal-badge urgency ${signal.tone}`}>{signal.label}</span>;
}
