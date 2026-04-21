"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ListPlus, ShoppingCart } from "lucide-react";
import { buildPaperBetKey } from "../lib/betslip/betKey";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";

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
}

export default function PaperBetAction({ bet }: PaperBetActionProps) {
  const [feedback, setFeedback] = useState<"added" | "duplicate" | null>(null);
  const {
    addBet,
    bets,
    registerSelectionSnapshot,
    setIsBetslipOpen,
  } = usePaperBetslip();

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

  const existingSelectionCount = bets.filter((entry) => {
    return (
      buildPaperBetKey({
        sport: entry.sport,
        eventId: entry.event_id,
        selection: entry.selection,
        betType: entry.bet_type,
      }) === selectionKey
    );
  }).length;

  const totalSlipCount = bets.length;

  const handleQuickAdd = () => {
    const result = addBet({
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
    });

    setFeedback(result.status);
    setIsBetslipOpen(true);
  };

  const buttonLabel =
    existingSelectionCount > 0
      ? `In Slip (${existingSelectionCount})`
      : "Quick Paper Bet";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <button
        className="btn btn-sm btn-secondary"
        onClick={handleQuickAdd}
        style={{ gap: "0.35rem", whiteSpace: "nowrap" }}
        title={
          existingSelectionCount > 0
            ? "This selection is already in your paper betslip. Open the slip to review it."
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
        <button
          type="button"
          onClick={() => setIsBetslipOpen(true)}
          style={{
            alignItems: "center",
            background: "transparent",
            border: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
            display: "inline-flex",
            fontSize: "0.72rem",
            gap: "0.3rem",
            padding: 0,
          }}
        >
          <ShoppingCart size={12} />
          Already added. Review it in the slip.
        </button>
      ) : null}
    </div>
  );
}
