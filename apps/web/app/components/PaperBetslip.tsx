"use client";
import React, { useState } from "react";
import { X, Trash2, Send, ShoppingCart, ChevronUp, ChevronDown, Loader2, CheckCircle2 } from "lucide-react";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";

export default function PaperBetslip() {
  const { 
    bets, 
    removeBet, 
    clearBetslip, 
    placeBets, 
    isBetslipOpen, 
    setIsBetslipOpen,
    updateBet 
  } = usePaperBetslip();

  const [placing, setPlacing] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  if (bets.length === 0 && !isBetslipOpen && !result) return null;

  const handlePlaceBets = async () => {
    setPlacing(true);
    const res = await placeBets();
    setResult(res);
    setPlacing(false);
    
    // Clear result after 3 seconds
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

  const totalStake = bets.reduce((sum, b) => sum + b.stake, 0);

  return (
    <div className={`betslip-container ${isBetslipOpen ? "open" : "collapsed"}`}>
      {/* Header / Toggle */}
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

      {isBetslipOpen && (
        <div className="betslip-content">
          {result ? (
            <div className="betslip-result">
              <CheckCircle2 size={48} className={result.failed === 0 ? "text-green" : "text-yellow"} />
              <h3>{result.failed === 0 ? "Bets Logged!" : "Partial Success"}</h3>
              <p>{result.success} bets recorded successfully.</p>
              {result.failed > 0 ? (
                <div className="betslip-error-box">
                  <p className="text-red">{result.failed} bets failed to log.</p>
                  <span className="small">Please verify your bet history.</span>
                </div>
              ) : null}
            </div>
          ) : bets.length === 0 ? (
            <div className="betslip-empty">
              <ShoppingCart size={32} />
              <p>Your betslip is empty</p>
              <p className="small">Add predictions to track multiple bets at once.</p>
            </div>
          ) : (
            <>
              <div className="betslip-list">
                {bets.map((bet) => (
                  <div key={bet.id} className="betslip-item">
                    <div className="betslip-item-header">
                      <div className="betslip-item-info">
                        <strong className="betslip-selection">{bet.selection}</strong>
                        <span className="betslip-event">{bet.event_name}</span>
                      </div>
                      <button className="betslip-remove" onClick={(e) => { e.stopPropagation(); removeBet(bet.id); }}>
                        <X size={14} />
                      </button>
                    </div>
                    <div className="betslip-item-details">
                      <div className="betslip-item-meta">
                        <span className="badge badge-muted">{bet.sport.toUpperCase()}</span>
                        <span className="badge badge-accent">${bet.odds?.toFixed(2) || "Fair"}</span>
                      </div>
                      <div className="betslip-item-stake">
                        <label>Stake</label>
                        <div className="stake-input-wrap">
                          <span>$</span>
                          <input 
                            type="number" 
                            min="1" 
                            value={bet.stake} 
                            onChange={(e) => updateBet(bet.id, { stake: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
                </div>
                <div className="betslip-actions">
                  <button 
                    className={`btn btn-sm ${confirmClear ? "btn-danger" : "btn-secondary"}`} 
                    onClick={handleClearBets} 
                    disabled={placing}
                  >
                    <Trash2 size={14} /> {confirmClear ? "Confirm" : "Clear"}
                  </button>
                  <button className="btn btn-primary btn-block" onClick={handlePlaceBets} disabled={placing}>
                    {placing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {placing ? "Logging..." : "Log Paper Bets"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <style jsx global>{`
        .betslip-container {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          width: 360px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
          z-index: 10000;
          overflow: hidden;
          transition: transform var(--transition-slow), opacity var(--transition);
          display: flex;
          flex-direction: column;
          max-height: calc(100vh - 100px);
        }

        .betslip-container.collapsed {
          width: auto;
          min-width: 180px;
          border-radius: 999px;
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
          min-height: 200px;
          background: var(--bg-primary);
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
          transition: border-color var(--transition-fast);
        }

        .betslip-item:hover {
          border-color: var(--accent-glow);
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
          transition: all var(--transition-fast);
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
          color: var(--text-dim);
          text-transform: uppercase;
        }

        .stake-input-wrap {
          display: flex;
          align-items: center;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 0 0.5rem;
          width: 70px;
        }

        .stake-input-wrap span {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .stake-input-wrap input {
          width: 100%;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 0.85rem;
          font-weight: 600;
          padding: 0.4rem 0.25rem;
          text-align: right;
        }

        .stake-input-wrap input:focus {
          outline: none;
        }

        .betslip-footer {
          padding: 1.25rem;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .betslip-summary {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .summary-row.total {
          font-size: 1rem;
          color: var(--text-primary);
          padding-top: 0.4rem;
          margin-top: 0.2rem;
          border-top: 1px dashed var(--border);
        }

        .betslip-actions {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 0.75rem;
        }

        .betslip-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1.5rem;
          text-align: center;
          color: var(--text-dim);
        }

        .betslip-empty p {
          margin-top: 0.75rem;
          font-weight: 600;
          font-size: 0.95rem;
        }

        .betslip-empty .small {
          font-size: 0.8rem;
          font-weight: 400;
          margin-top: 0.25rem;
        }

        .betslip-result {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
        }

        .betslip-result h3 {
          margin-top: 1rem;
          font-size: 1.25rem;
        }

        .betslip-result p {
          color: var(--text-muted);
          margin-top: 0.5rem;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .text-green { color: var(--green); }
        .text-red { color: var(--red); }
        .text-yellow { color: var(--yellow); }

        .betslip-error-box {
          margin-top: 1rem;
          padding: 0.75rem;
          background: var(--red-bg);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: var(--radius-sm);
        }

        .betslip-error-box .small {
          display: block;
          margin-top: 0.25rem;
          font-size: 0.8rem;
          color: var(--text-dim);
        }

        .btn-danger {
          background: var(--red);
          color: white;
        }
        .btn-danger:hover {
          background: #dc2626;
        }

        @media (max-width: 640px) {
          .betslip-container {
            bottom: max(1.5rem, env(safe-area-inset-bottom));
            right: 1rem;
            width: calc(100% - 2rem);
            max-height: 65vh;
            border-radius: var(--radius-lg);
          }
          .betslip-container.collapsed {
            width: auto;
            right: 1rem;
            bottom: max(1.5rem, env(safe-area-inset-bottom));
          }
        }
      `}</style>
    </div>
  );
}
