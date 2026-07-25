"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ListPlus, ShoppingCart, X } from "lucide-react";
import { buildPaperBetKey } from "../lib/betslip/betKey";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";
import { useAuth } from "../providers/AuthProvider";
import GuestModal from "./GuestModal";

interface PaperBetActionProps {
  bet: {
    sport: string;
    event_id: string;
    event_name: string;
    selection: string;
    selection_id?: string;
    odds?: number;
    bet_type: string;
    stake: number;
    notes?: string;
    odds_source?: "market" | "model_fair" | "missing";
    event_start_time?: string;
    event_date?: string;
    is_closed?: boolean;
    is_unavailable?: boolean;
    unavailable_reason?: string;
    can_compare_odds?: boolean;
    current_odds?: number | null;
  };
  variant?: "default" | "phase1";
  label?: string;
  loggedLabel?: string;
  cancelLabel?: string;
  openBetslipOnAdd?: boolean;
  fullWidth?: boolean;
}

export default function PaperBetAction({
  bet,
  variant = "default",
  label,
  loggedLabel,
  cancelLabel = "Cancel",
  openBetslipOnAdd = true,
  fullWidth = false,
}: PaperBetActionProps) {
  const { user } = useAuth();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [feedback, setFeedback] = useState<
    "added" | "duplicate" | "removed" | "limit_reached" | null
  >(null);
  const { addBet, bets, registerSelectionSnapshot, removeBet } = usePaperBetslip();

  useEffect(() => {
    registerSelectionSnapshot({
      sport: bet.sport,
      event_id: bet.event_id,
      selection: bet.selection,
      bet_type: bet.bet_type,
      current_odds: bet.current_odds ?? bet.odds ?? null,
      odds_source: bet.odds_source,
      can_compare_odds: bet.can_compare_odds,
      event_start_time: bet.event_start_time,
      event_date: bet.event_date,
      is_closed: bet.is_closed,
      is_unavailable: bet.is_unavailable,
      unavailable_reason: bet.unavailable_reason,
    });
  }, [
    bet.bet_type,
    bet.can_compare_odds,
    bet.current_odds,
    bet.event_date,
    bet.event_id,
    bet.event_start_time,
    bet.is_closed,
    bet.is_unavailable,
    bet.odds,
    bet.odds_source,
    bet.selection,
    bet.sport,
    bet.unavailable_reason,
    registerSelectionSnapshot,
  ]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timer = window.setTimeout(() => setFeedback(null), 1800);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const selectionKey = useMemo(
    () =>
      buildPaperBetKey({
        sport: bet.sport,
        eventId: bet.event_id,
        selection: bet.selection,
        betType: bet.bet_type,
      }),
    [bet.bet_type, bet.event_id, bet.selection, bet.sport],
  );

  const matchingSelections = bets.filter((entry) => {
    return (
      buildPaperBetKey({
        sport: entry.sport,
        eventId: entry.event_id,
        selection: entry.selection,
        betType: entry.bet_type,
      }) === selectionKey
    );
  });

  const existingSelectionCount = matchingSelections.length;
  const totalSlipCount = bets.length;

  const stopCardToggle = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleQuickAdd = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!user || user.id === "guest") {
      setShowGuestModal(true);
      return;
    }
    if (totalSlipCount >= 50 && existingSelectionCount === 0) {
      return;
    }

    const result = addBet(
      {
        sport: bet.sport,
        event_id: bet.event_id,
        event_name: bet.event_name,
        selection_id: bet.selection_id,
        selection: bet.selection,
        odds: bet.odds,
        bet_type: bet.bet_type,
        stake: bet.stake,
        notes: bet.notes ?? `Model pick for ${bet.event_name}`,
        odds_source: bet.odds_source,
        event_start_time: bet.event_start_time,
        event_date: bet.event_date,
        is_closed: bet.is_closed,
        is_unavailable: bet.is_unavailable,
        unavailable_reason: bet.unavailable_reason,
      },
      {
        openBetslip: openBetslipOnAdd,
      },
    );

    setFeedback(result.status);
  };

  const handleCancel = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    matchingSelections.forEach((selection) => removeBet(selection.id));
    setFeedback("removed");
  };

  if (variant === "phase1") {
    const phase1PrimaryLabel =
      existingSelectionCount > 0
        ? loggedLabel ?? "Selection Logged"
        : label ?? "Log Selection";

    return (
      <div
        className={`paper-bet-action phase1 ${fullWidth ? "full-width" : ""}`}
        onClick={stopCardToggle}
        onMouseDown={stopCardToggle}
      >
        <button
          type="button"
          className={`paper-bet-action-primary ${
            existingSelectionCount > 0 ? "is-logged" : ""
          }`}
          onClick={handleQuickAdd}
          disabled={existingSelectionCount > 0 || (totalSlipCount >= 50 && existingSelectionCount === 0)}
          title={
            existingSelectionCount > 0
              ? "This selection is already in your paper betslip."
              : totalSlipCount >= 50
                ? "Betslip capacity reached (50 bets max)."
                : "Add this selection to your persistent paper betslip."
          }
        >
          {existingSelectionCount > 0 ? (
            <CheckCircle2 size={15} />
          ) : (
            <ListPlus size={15} />
          )}
          <span>{phase1PrimaryLabel}</span>
          {existingSelectionCount > 0 ? (
            <span className="paper-bet-action-count">{existingSelectionCount}</span>
          ) : null}
        </button>

        {existingSelectionCount > 0 ? (
          <button
            type="button"
            className="paper-bet-action-cancel"
            onClick={handleCancel}
            title="Remove this selection from the paper betslip."
          >
            <X size={14} />
            <span>{cancelLabel}</span>
          </button>
        ) : null}

        <style jsx>{`
          .paper-bet-action {
            align-items: stretch;
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
            min-width: 0;
          }

          .paper-bet-action.full-width {
            width: 100%;
          }

          .paper-bet-action-primary,
          .paper-bet-action-cancel {
            align-items: center;
            border-radius: 12px;
            border: 1px solid transparent;
            cursor: pointer;
            display: inline-flex;
            font-family: inherit;
            font-size: 0.8rem;
            font-weight: 800;
            gap: 0.4rem;
            justify-content: center;
            min-height: 42px;
            padding: 0.65rem 0.9rem;
            transition:
              background var(--transition-fast),
              border-color var(--transition-fast),
              box-shadow var(--transition-fast),
              color var(--transition-fast),
              transform var(--transition-fast);
            width: 100%;
          }

          .paper-bet-action-primary {
            background: linear-gradient(
              135deg,
              rgba(34, 197, 94, 0.9),
              rgba(16, 185, 129, 0.82)
            );
            border-color: rgba(110, 231, 183, 0.4);
            box-shadow: 0 10px 24px rgba(16, 185, 129, 0.18);
            color: #f8fffb;
          }

          .paper-bet-action-primary:hover:not(:disabled) {
            background: linear-gradient(
              135deg,
              rgba(52, 211, 153, 0.96),
              rgba(16, 185, 129, 0.9)
            );
            box-shadow: 0 12px 28px rgba(16, 185, 129, 0.22);
            transform: translateY(-1px);
          }

          .paper-bet-action-primary.is-logged {
            background: linear-gradient(
              135deg,
              rgba(37, 99, 235, 0.22),
              rgba(59, 130, 246, 0.18)
            );
            border-color: rgba(96, 165, 250, 0.4);
            box-shadow: none;
            color: #dbeafe;
            cursor: default;
          }

          .paper-bet-action-primary:disabled {
            opacity: 1;
          }

          .paper-bet-action-primary:disabled:not(.is-logged) {
            background: linear-gradient(
              135deg,
              rgba(100, 116, 139, 0.35),
              rgba(71, 85, 105, 0.25)
            );
            border-color: rgba(148, 163, 184, 0.15);
            color: var(--text-muted);
            cursor: not-allowed;
            box-shadow: none;
          }

          .paper-bet-action-cancel {
            background: rgba(15, 23, 42, 0.9);
            border-color: rgba(248, 113, 113, 0.42);
            color: #fecaca;
          }

          .paper-bet-action-cancel:hover {
            background: rgba(127, 29, 29, 0.28);
            border-color: rgba(252, 165, 165, 0.55);
            color: #fee2e2;
            transform: translateY(-1px);
          }

          .paper-bet-action-count {
            align-items: center;
            background: rgba(255, 255, 255, 0.14);
            border-radius: 999px;
            display: inline-flex;
            font-size: 0.72rem;
            justify-content: center;
            min-width: 1.3rem;
            padding: 0.1rem 0.35rem;
          }
        `}</style>
      </div>
    );
  }

  const buttonLabel =
    existingSelectionCount > 0
      ? `In Slip (${existingSelectionCount})`
      : "Quick Paper Bet";

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}
      onClick={stopCardToggle}
      onMouseDown={stopCardToggle}
    >
      <button
        className="btn btn-sm btn-secondary"
        onClick={handleQuickAdd}
        disabled={existingSelectionCount > 0 || (totalSlipCount >= 50 && existingSelectionCount === 0)}
        style={{ gap: "0.35rem", whiteSpace: "nowrap" }}
        title={
          existingSelectionCount > 0
            ? "This selection is already in your paper betslip. Open the slip to review it."
            : totalSlipCount >= 50
              ? "Betslip capacity reached (50 bets max)."
              : "Add this selection to your persistent paper betslip."
        }
      >
        {feedback === "added" ? <CheckCircle2 size={14} /> : <ListPlus size={14} />}
        {buttonLabel}
        <span
          style={{
            alignItems: "center",
            background: "rgba(255,255,255,0.16)",
            borderRadius: "999px",
            display: "inline-flex",
            fontSize: "0.7rem",
            fontWeight: 700,
            justifyContent: "center",
            minWidth: "1.2rem",
            padding: "0.05rem 0.35rem",
          }}
        >
          {totalSlipCount}
        </span>
      </button>

      {feedback === "duplicate" ? (
        <span
          style={{
            alignItems: "center",
            color: "var(--text-dim)",
            display: "inline-flex",
            fontSize: "0.72rem",
            gap: "0.3rem",
            padding: 0,
          }}
        >
          <ShoppingCart size={12} />
          Already added. Review it in the slip.
        </span>
      ) : null}
      <GuestModal open={showGuestModal} onClose={() => setShowGuestModal(false)} />
    </div>
  );
}
