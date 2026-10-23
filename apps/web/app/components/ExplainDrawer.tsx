"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Brain, ChevronRight, CircleAlert, Scale, ShieldAlert, X } from "lucide-react";
import type { BobExplanation } from "../lib/bob/explainer";

type ExplainDrawerProps = {
  open: boolean;
  explanation: BobExplanation | null;
  onClose: () => void;
};

export default function ExplainDrawer({
  open,
  explanation,
  onClose,
}: ExplainDrawerProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !explanation) {
    return null;
  }

  return (
    <div className="explain-drawer-root" aria-modal="true" role="dialog">
      <button
        type="button"
        className="explain-drawer-backdrop"
        aria-label="Close explanation"
        onClick={onClose}
      />
      <aside className="explain-drawer-panel">
        <div className="explain-drawer-header">
          <div className="explain-bob-avatar" aria-hidden="true">
            <Image
              src="/brand/betmate-bob-original.png"
              alt=""
              fill
              sizes="96px"
              className="explain-bob-avatar-image"
            />
          </div>
          <div className="explain-drawer-title-wrap">
            <span className="explain-bob-kicker">
              <Brain size={14} /> BetMate Bob
            </span>
            <h3>Why {explanation.selectionName}?</h3>
            <p>{explanation.headline}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close explanation"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="explain-metrics-grid">
          <MetricCard
            label="Model win chance"
            value={explanation.probabilityLabel}
            tone={explanation.confidenceTone}
          />
          <MetricCard
            label="Model fair odds"
            value={explanation.fairOddsLabel}
            tone="measured"
          />
          {explanation.marketOddsLabel ? (
            <MetricCard
              label="Market odds"
              value={explanation.marketOddsLabel}
              tone="measured"
            />
          ) : null}
          <MetricCard
            label="Confidence read"
            value={explanation.confidenceLabel}
            tone={explanation.confidenceTone}
          />
        </div>

        <section className="explain-section">
          <h4>
            <ChevronRight size={16} /> Bob&apos;s read
          </h4>
          <p>{explanation.summary}</p>
          <p className="muted-copy">{explanation.confidenceReason}</p>
        </section>

        <section className="explain-section">
          <h4>
            <Scale size={16} /> What is driving it
          </h4>
          <div className="explain-signal-list">
            {explanation.topSignals.length > 0 ? (
              explanation.topSignals.map((signal) => (
                <div key={`${signal.feature}-${signal.direction}`} className="explain-signal-card">
                  <div className="explain-signal-label-row">
                    <span>{signal.label}</span>
                    <span className="signal-pill positive">
                      +{(Math.abs(signal.value) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p>{signal.summary}</p>
                </div>
              ))
            ) : (
              <div className="explain-signal-card">
                <p>No clean feature-impact breakdown came through for this pick, so Bob is leaning on the broader model context only.</p>
              </div>
            )}
          </div>
        </section>

        {explanation.cautionSignals.length > 0 ? (
          <section className="explain-section">
            <h4>
              <ShieldAlert size={16} /> What keeps Bob honest
            </h4>
            <div className="explain-signal-list">
              {explanation.cautionSignals.map((signal) => (
                <div key={`${signal.feature}-${signal.direction}`} className="explain-signal-card caution">
                  <div className="explain-signal-label-row">
                    <span>{signal.label}</span>
                    <span className="signal-pill negative">
                      -{(Math.abs(signal.value) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p>{signal.summary}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="explain-section">
          <h4>
            <CircleAlert size={16} /> Context checks
          </h4>
          <div className="explain-note-list">
            <div className="explain-note-card">{explanation.dataQualityLabel}</div>
            <div className="explain-note-card">{explanation.marketView}</div>
            {explanation.notes.map((note) => (
              <div key={note} className="explain-note-card">
                {note}
              </div>
            ))}
            {explanation.modelMeta.map((meta) => (
              <div key={meta} className="explain-note-card subtle">
                {meta}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "strong" | "measured" | "cautious";
}) {
  return (
    <div className={`explain-metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
