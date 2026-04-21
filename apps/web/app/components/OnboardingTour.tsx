"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";

const STORAGE_KEY = "betmate_onboarding_completed";

const STEPS = [
  {
    title: "Start with the predictions",
    body: "Browse Racing, AFL, or NBA to see the model's fair odds and its strongest current leans.",
  },
  {
    title: "Open Bob's explanation",
    body: 'Tap "Why this pick?" whenever you want the reasoning, caution flags, and confidence context in plain English.',
  },
  {
    title: "Add it to your paper betslip",
    body: "Use the log selection action to keep a paper-only version of the bets you want to track.",
  },
  {
    title: "Track your bankroll and results",
    body: "Your slip survives refreshes and tab changes, so you can come back without losing your workflow.",
  },
  {
    title: "Review analytics later",
    body: "Once you have a paper-bet history, the bankroll and analytics pages help you learn what is actually working.",
  },
];

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export default function OnboardingTour() {
  const pathname = usePathname();
  const { bets } = usePaperBetslip();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const shouldHideOnRoute = useMemo(
    () => pathname === "/login" || pathname === "/register",
    [pathname],
  );

  useEffect(() => {
    if (!canUseStorage() || shouldHideOnRoute) {
      setReady(true);
      return;
    }

    const hasCompleted = window.localStorage.getItem(STORAGE_KEY) === "true";
    setOpen(!hasCompleted && bets.length === 0);
    setReady(true);
  }, [bets.length, shouldHideOnRoute]);

  if (!ready || !open || shouldHideOnRoute) {
    return null;
  }

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const finishTour = () => {
    if (canUseStorage()) {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
    setOpen(false);
  };

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-card">
        <div className="tour-progress">
          <span>Quick BetMate tour</span>
          <span>
            {stepIndex + 1}/{STEPS.length}
          </span>
        </div>
        <h3 id="tour-title">{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-dots" aria-hidden="true">
          {STEPS.map((_, index) => (
            <span
              key={index}
              className={`tour-dot ${index === stepIndex ? "active" : ""}`}
            />
          ))}
        </div>
        <div className="tour-actions">
          <button className="btn btn-secondary btn-sm" onClick={finishTour}>
            Skip
          </button>
          {stepIndex === 1 ? (
            <Link href="/how-it-works" className="btn btn-secondary btn-sm">
              How it works
            </Link>
          ) : null}
          {isLastStep ? (
            <button className="btn btn-primary btn-sm" onClick={finishTour}>
              Finish
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setStepIndex((current) => current + 1)}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
