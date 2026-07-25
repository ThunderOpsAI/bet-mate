"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import {
  buildPaperBetKey,
  getOddsShiftPercent,
  hasEventStarted,
} from "../lib/betslip/betKey";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";
import { useAuth } from "../providers/AuthProvider";
import GuestModal from "./GuestModal";

type BetIssue = {
  tone: "warning" | "danger" | "info";
  message: string;
  blocking: boolean;
  requiresReview: boolean;
};

export default function PaperBetslip() {
  const { user } = useAuth();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const {
    bets,
    clearBetslip,
    isBetslipOpen,
    placeBets,
    removeBet,
    selectionSnapshots,
    setIsBetslipOpen,
    updateBet,
    defaultStake,
    setDefaultStake,
    addToast,
  } = usePaperBetslip();

  const [placing, setPlacing] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(
    null,
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const [acknowledgeOddsChanges, setAcknowledgeOddsChanges] = useState(false);

  const warnings = useMemo(() => {
    const counts = bets.reduce<Record<string, number>>((acc, bet) => {
      const key = buildPaperBetKey({
        sport: bet.sport,
        eventId: bet.event_id,
        selection: bet.selection,
        betType: bet.bet_type,
      });

      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return bets.map((bet) => {
      const key = buildPaperBetKey({
        sport: bet.sport,
        eventId: bet.event_id,
        selection: bet.selection,
        betType: bet.bet_type,
      });
      const snapshot = selectionSnapshots[key];
      const issues: BetIssue[] = [];

      if ((counts[key] ?? 0) > 1) {
        issues.push({
          tone: "warning",
          message: "Duplicate selection in slip. Review your stake before logging twice.",
          blocking: false,
          requiresReview: false,
        });
      }

      if (
        hasEventStarted({
          eventStartTime: snapshot?.event_start_time ?? bet.event_start_time,
          eventDate: snapshot?.event_date ?? bet.event_date,
          isClosed: snapshot?.is_closed ?? bet.is_closed,
        })
      ) {
        issues.push({
          tone: "danger",
          message: "Event already started. Remove this pick before logging the slip.",
          blocking: true,
          requiresReview: false,
        });
      }

      if (snapshot?.is_unavailable || bet.is_unavailable) {
        issues.push({
          tone: "danger",
          message:
            snapshot?.unavailable_reason ??
            bet.unavailable_reason ??
            "Selection is unavailable in the current frontend snapshot.",
          blocking: true,
          requiresReview: false,
        });
      }

      if (!bet.odds || bet.odds <= 1) {
        issues.push({
          tone: "danger",
          message: "Missing usable odds. This selection cannot be logged from the slip yet.",
          blocking: true,
          requiresReview: false,
        });
      }

      const latestOdds = snapshot?.current_odds;
      const oddsShift = snapshot?.can_compare_odds
        ? getOddsShiftPercent(bet.odds, latestOdds)
        : null;

      if (oddsShift !== null && Math.abs(oddsShift) > 10) {
        issues.push({
          tone: "warning",
          message: `Current odds moved ${oddsShift > 0 ? "up" : "down"} ${Math.abs(
            oddsShift,
          ).toFixed(0)}% since you added this pick.`,
          blocking: false,
          requiresReview: true,
        });
      }

      if (snapshot && !snapshot.can_compare_odds && bet.odds_source !== "market") {
        issues.push({
          tone: "info",
          message:
            "Logged at model fair odds only. Live stale-odds checks are not available on this selection yet.",
          blocking: false,
          requiresReview: false,
        });
      }

      return { bet, issues };
    });
  }, [bets, selectionSnapshots]);

  useEffect(() => {
    setAcknowledgeOddsChanges(false);
  }, [bets]);

  if (bets.length === 0 && !isBetslipOpen && !result) return null;

  const totalStake = bets.reduce((sum, b) => sum + b.stake, 0);
  const blockingIssues = warnings.flatMap((entry) =>
    entry.issues.filter((issue) => issue.blocking),
  );
  const reviewIssues = warnings.flatMap((entry) =>
    entry.issues.filter((issue) => issue.requiresReview),
  );

  const canSubmit =
    blockingIssues.length === 0 &&
    (reviewIssues.length === 0 || acknowledgeOddsChanges);

  const handlePlaceBets = async () => {
    if (!user || user.id === "guest") {
      setShowGuestModal(true);
      return;
    }
    if (!canSubmit) {
      return;
    }

    setPlacing(true);
    const res = await placeBets();
    setResult(res);
    setPlacing(false);

    setTimeout(() => {
      setResult(null);
      if (res.failed === 0) {
        setIsBetslipOpen(false);
      }
    }, 3000);
  };

  const handleClearBets = () => {
    if (confirmClear) {
      clearBetslip();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  return (
    <div className={`betslip-container ${isBetslipOpen ? "open" : "collapsed"}`}>
      <div className="betslip-header" onClick={() => setIsBetslipOpen(!isBetslipOpen)}>
        <div className="betslip-title">
          <div className="betslip-icon-wrap">
            <ShoppingCart size={18} />
            {bets.length > 0 && <span className="betslip-badge-pulse" />}
          </div>
          <span>Paper Betslip</span>
          <span className="betslip-count">{bets.length}</span>
        </div>
        <div className="betslip-toggle">
          {isBetslipOpen ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        </div>
      </div>

      <div className="betslip-content">
        {result ? (
          <div className="betslip-result">
            <CheckCircle2 size={48} className={result.failed === 0 ? "text-green" : "text-yellow"} />
            <h3>{result.failed === 0 ? "Bets Logged!" : "Partial Success"}</h3>
            <p>{result.success} bets recorded successfully.</p>
          </div>
        ) : bets.length === 0 ? (
          <div className="betslip-empty">
            <ShoppingCart size={32} />
            <p>Your betslip is empty</p>
            <p className="small">Add predictions to track multiple bets at once.</p>
          </div>
        ) : (
          <>
            <div className="betslip-status-stack">
              {blockingIssues.length > 0 ? (
                <div className="betslip-banner danger">
                  <AlertTriangle size={16} />
                  <span>
                    {blockingIssues.length} selection
                    {blockingIssues.length === 1 ? "" : "s"} need fixing before
                    you can log this slip.
                  </span>
                </div>
              ) : null}

              {reviewIssues.length > 0 ? (
                <label className="betslip-banner warning" htmlFor="ack-odds-changes">
                  <input
                    id="ack-odds-changes"
                    type="checkbox"
                    checked={acknowledgeOddsChanges}
                    onChange={(event) => setAcknowledgeOddsChanges(event.target.checked)}
                  />
                  <span>
                    {reviewIssues.length} selection
                    {reviewIssues.length === 1 ? "" : "s"} moved more than 10%.
                    Review the current racing prices before you log anyway.
                  </span>
                </label>
              ) : null}

              <div className="betslip-banner info">
                <AlertTriangle size={16} />
                <span>
                  Live stale-odds checks only work where this tab has a fresh frontend
                  price snapshot. Racing can compare live Betfair prices; AFL and NBA
                  stay model-led for now.
                </span>
              </div>
            </div>

            <div className="betslip-list">
              {warnings.map(({ bet, issues }) => {
                const key = buildPaperBetKey({
                  sport: bet.sport,
                  eventId: bet.event_id,
                  selection: bet.selection,
                  betType: bet.bet_type,
                });
                const snapshot = selectionSnapshots[key];
                const latestOdds = snapshot?.current_odds;

                return (
                  <div key={bet.id} className="betslip-item">
                    <div className="betslip-item-header">
                      <div className="betslip-item-info">
                        <strong className="betslip-selection">{bet.selection}</strong>
                        <span className="betslip-event">{bet.event_name}</span>
                      </div>
                      <button
                        className="betslip-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBet(bet.id);
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="betslip-item-details">
                      <div className="betslip-item-meta">
                        <span className="badge badge-muted">{bet.sport.toUpperCase()}</span>
                        <span className="badge badge-accent">
                          ${bet.odds?.toFixed(2) || "0.00"}
                        </span>
                        {latestOdds && latestOdds > 1 ? (
                          <span className="badge badge-blue">
                            Now ${latestOdds.toFixed(2)}
                          </span>
                        ) : null}
                      </div>
                      <div className="betslip-item-stake">
                        <label>Stake</label>
                        <div className="stake-input-wrap">
                          <span>$</span>
                          <input
                            type="number"
                            min="1"
                            value={bet.stake}
                            onChange={(e) =>
                              updateBet(bet.id, { stake: Number(e.target.value) })
                            }
                          />
                        </div>
                      </div>
                    </div>
                    {issues.length > 0 ? (
                      <div className="betslip-issues">
                        {issues.map((issue, index) => (
                          <div
                            key={`${bet.id}-${index}`}
                            className={`betslip-issue ${issue.tone}`}
                          >
                            <AlertTriangle size={13} />
                            <span>{issue.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="betslip-footer">
              <div className="betslip-summary">
                <div className="summary-row">
                  <span>Total Bets</span>
                  <span>{bets.length}</span>
                </div>
                <div className="summary-row total">
                  <span>Total Stake</span>
                  <strong>${totalStake.toFixed(2)}</strong>
                </div>
                <div className="summary-row default-stake-row">
                  <span style={{ fontSize: "0.8rem" }}>Default Stake</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <div className="footer-stake-input-wrap">
                      <span>$</span>
                      <input
                        type="number"
                        min="1"
                        value={defaultStake}
                        onChange={(e) => setDefaultStake(Number(e.target.value))}
                        className="footer-stake-input"
                        title="Default stake applied to new picks"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        bets.forEach((b) => updateBet(b.id, { stake: defaultStake }));
                        addToast(`Applied stake of $${defaultStake} to all bets`, "success");
                      }}
                      className="btn btn-secondary btn-xs apply-all-btn"
                      title="Apply default stake to all current picks"
                    >
                      Apply All
                    </button>
                  </div>
                </div>
              </div>
              <div className="betslip-actions">
                <button
                  className={`btn btn-sm ${confirmClear ? "btn-danger" : "btn-secondary"}`}
                  onClick={handleClearBets}
                  disabled={placing}
                >
                  <Trash2 size={14} /> {confirmClear ? "Confirm" : "Clear"}
                </button>
                <button
                  className="btn btn-primary btn-block"
                  onClick={handlePlaceBets}
                  disabled={placing || !canSubmit}
                  title={
                    blockingIssues.length > 0
                      ? "Fix blocked selections first."
                      : reviewIssues.length > 0 && !acknowledgeOddsChanges
                        ? "Acknowledge the odds changes before proceeding."
                        : "Log the current paper betslip."
                  }
                >
                  {placing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {placing
                    ? "Logging..."
                    : blockingIssues.length > 0
                      ? "Fix Slip Warnings"
                      : reviewIssues.length > 0 && !acknowledgeOddsChanges
                        ? "Review Odds Changes"
                        : "Log Paper Bets"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        .betslip-container {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          width: 380px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
          z-index: 10000;
          overflow: hidden;
          transition: 
            width 0.45s cubic-bezier(0.16, 1, 0.3, 1),
            max-height 0.45s cubic-bezier(0.16, 1, 0.3, 1),
            border-radius 0.45s cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 0.4s ease,
            transform 0.4s ease,
            opacity 0.3s ease;
          display: flex;
          flex-direction: column;
          max-height: 700px;
        }

        .betslip-container.collapsed {
          width: 220px;
          max-height: 48px;
          border-radius: 24px;
        }

        .betslip-header {
          padding: 0.85rem 1.25rem;
          background: var(--bg-glass);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          user-select: none;
        }

        .collapsed .betslip-header {
          border-bottom: none;
        }

        .betslip-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--text-primary);
        }

        .betslip-icon-wrap {
          position: relative;
          color: var(--accent);
        }

        .betslip-badge-pulse {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          background: var(--green);
          border-radius: 50%;
          border: 2px solid var(--bg-secondary);
          animation: pulse-green 2s infinite;
        }

        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .betslip-count {
          background: var(--accent);
          color: white;
          font-size: 0.75rem;
          padding: 1px 6px;
          border-radius: 999px;
          margin-left: 0.25rem;
        }

        .betslip-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 220px;
          background: var(--bg-primary);
          transition: opacity 0.3s ease, max-height 0.45s cubic-bezier(0.16, 1, 0.3, 1);
          opacity: 1;
          max-height: 650px;
          overflow-y: hidden;
        }

        .collapsed .betslip-content {
          opacity: 0;
          max-height: 0;
          min-height: 0;
          pointer-events: none;
        }

        .betslip-status-stack {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          padding: 1rem 1rem 0;
        }

        .betslip-banner {
          align-items: flex-start;
          border-radius: 10px;
          display: flex;
          gap: 0.6rem;
          padding: 0.75rem 0.85rem;
          font-size: 0.78rem;
          line-height: 1.4;
        }

        .betslip-banner input {
          margin-top: 0.2rem;
        }

        .betslip-banner.danger {
          background: rgba(239, 68, 68, 0.12);
          color: #fecaca;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .betslip-banner.warning {
          background: rgba(245, 158, 11, 0.12);
          color: #fde68a;
          border: 1px solid rgba(245, 158, 11, 0.3);
          cursor: pointer;
        }

        .betslip-banner.info {
          background: rgba(96, 165, 250, 0.12);
          color: #bfdbfe;
          border: 1px solid rgba(96, 165, 250, 0.3);
        }

        .betslip-list {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-height: 400px;
        }

        .betslip-item {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.85rem;
        }

        .betslip-item-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
          gap: 0.5rem;
        }

        .betslip-selection {
          display: block;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .betslip-event {
          display: block;
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-top: 0.1rem;
        }

        .betslip-remove {
          background: transparent;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }

        .betslip-remove:hover {
          color: var(--red);
          background: var(--red-bg);
        }

        .betslip-item-details {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 1rem;
        }

        .betslip-item-meta {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
        }

        .betslip-item-stake {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
        }

        .betslip-item-stake label {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .stake-input-wrap {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.35rem 0.5rem;
        }

        .stake-input-wrap span {
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .stake-input-wrap input {
          width: 68px;
          border: none;
          background: transparent;
          color: var(--text-primary);
          outline: none;
        }

        .betslip-issues {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          margin-top: 0.7rem;
        }

        .betslip-issue {
          align-items: flex-start;
          border-radius: 8px;
          display: flex;
          gap: 0.45rem;
          padding: 0.5rem 0.6rem;
          font-size: 0.74rem;
          line-height: 1.35;
        }

        .betslip-issue.warning {
          background: rgba(245, 158, 11, 0.12);
          color: #fde68a;
        }

        .betslip-issue.danger {
          background: rgba(239, 68, 68, 0.12);
          color: #fecaca;
        }

        .betslip-issue.info {
          background: rgba(96, 165, 250, 0.1);
          color: #bfdbfe;
        }

        .betslip-footer {
          border-top: 1px solid var(--border);
          padding: 1rem;
          background: var(--bg-secondary);
        }

        .betslip-summary {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 0.85rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        .summary-row.total {
          color: var(--text-primary);
          font-size: 0.92rem;
        }

        .default-stake-row {
          padding-top: 0.5rem;
          margin-top: 0.5rem;
          border-top: 1px dashed var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .footer-stake-input-wrap {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 0.15rem 0.35rem;
        }

        .footer-stake-input-wrap span {
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        .footer-stake-input {
          width: 50px;
          border: none;
          background: transparent;
          color: var(--text-primary);
          outline: none;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .apply-all-btn {
          font-size: 0.7rem;
          padding: 0.25rem 0.45rem;
          border-radius: 6px;
          line-height: 1;
        }

        .betslip-actions {
          display: flex;
          gap: 0.75rem;
        }

        .betslip-empty,
        .betslip-result {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 2rem 1.5rem;
          text-align: center;
          color: var(--text-muted);
        }

        .text-green {
          color: var(--green);
        }

        .text-yellow {
          color: #fbbf24;
        }

        @media (max-width: 768px) {
          .betslip-container {
            left: 1rem;
            right: 1rem;
            bottom: 1rem;
            width: auto;
            max-height: calc(100vh - 80px);
          }
        }
      `}</style>
      <GuestModal open={showGuestModal} onClose={() => setShowGuestModal(false)} />
    </div>
  );
}
