"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Wallet, Users, ChevronDown, Check, ShieldAlert, PlusCircle } from "lucide-react";

export interface SyndicateOption {
  id: string;
  name: string;
  code: string;
  paperBalance: number;
  maxStakeLimit: number;
}

export interface GroupWalletToggleProps {
  walletMode: "personal" | string;
  syndicates: SyndicateOption[];
  onSelectWallet: (mode: "personal" | string, selectedSyndicate?: SyndicateOption) => void;
  personalBalance?: number;
}

export default function GroupWalletToggle({
  walletMode,
  syndicates = [],
  onSelectWallet,
  personalBalance = 10000,
}: GroupWalletToggleProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isPersonal = walletMode === "personal";
  const selectedSyndicate = syndicates.find((s) => s.id === walletMode);

  return (
    <div className="group-wallet-toggle-container">
      <div className="toggle-header-label">
        <span className="label-title">Betting Mode & Wallet</span>
        <span className="badge-virtual">100% Paper Currency</span>
      </div>

      <div className="toggle-pills">
        <button
          type="button"
          className={`pill-btn ${isPersonal ? "active" : ""}`}
          onClick={() => {
            setDropdownOpen(false);
            onSelectWallet("personal");
          }}
        >
          <Wallet size={14} />
          <span>Personal Bankroll</span>
          <span className="pill-balance">${personalBalance.toLocaleString()}</span>
        </button>

        <div className="syndicate-pill-wrapper">
          <button
            type="button"
            className={`pill-btn ${!isPersonal ? "active" : ""}`}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <Users size={14} />
            <span>
              {!isPersonal && selectedSyndicate ? selectedSyndicate.name : "Syndicate Wallet"}
            </span>
            {!isPersonal && selectedSyndicate ? (
              <span className="pill-balance green">${selectedSyndicate.paperBalance.toFixed(2)}</span>
            ) : (
              <span className="pill-count">({syndicates.length})</span>
            )}
            <ChevronDown size={14} className={`arrow ${dropdownOpen ? "open" : ""}`} />
          </button>

          {dropdownOpen && (
            <div className="syndicate-dropdown">
              {syndicates.length === 0 ? (
                <div className="empty-syndicates-prompt">
                  <ShieldAlert size={18} className="text-muted" />
                  <p>You have not joined any paper syndicates yet.</p>
                  <Link
                    href="/mates"
                    className="btn-link-mates"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <PlusCircle size={13} />
                    Create or Join in Bet With Mates
                  </Link>
                </div>
              ) : (
                <div className="syndicate-list">
                  {syndicates.map((syn) => {
                    const isSelected = walletMode === syn.id;
                    return (
                      <button
                        key={syn.id}
                        type="button"
                        className={`syndicate-option-item ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          onSelectWallet(syn.id, syn);
                          setDropdownOpen(false);
                        }}
                      >
                        <div className="syn-info">
                          <div className="syn-name-row">
                            <span className="syn-name">{syn.name}</span>
                            <span className="syn-code">#{syn.code}</span>
                          </div>
                          <div className="syn-meta">
                            <span className="syn-bal">Paper Bal: ${syn.paperBalance.toFixed(2)}</span>
                            <span className="syn-limit">• Max Stake: ${syn.maxStakeLimit.toFixed(2)}</span>
                          </div>
                        </div>
                        {isSelected && <Check size={16} className="check-icon" />}
                      </button>
                    );
                  })}
                  <div className="dropdown-footer">
                    <Link
                      href="/mates"
                      className="manage-mates-link"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Manage Syndicates in Bet With Mates →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!isPersonal && selectedSyndicate && (
        <div className="syndicate-active-banner">
          <ShieldAlert size={14} className="banner-icon" />
          <span>
            Placing bet with <strong>{selectedSyndicate.name}</strong> group wallet. Max stake cap:{" "}
            <strong>${selectedSyndicate.maxStakeLimit.toFixed(2)}</strong>.
          </span>
        </div>
      )}

      <style jsx>{`
        .group-wallet-toggle-container {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid var(--border, rgba(51, 65, 85, 0.5));
          border-radius: 12px;
          padding: 0.75rem;
          margin-bottom: 0.85rem;
        }

        .toggle-header-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .label-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted, #94a3b8);
        }

        .badge-virtual {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
          font-size: 0.65rem;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 999px;
        }

        .toggle-pills {
          display: flex;
          gap: 0.5rem;
          position: relative;
        }

        .pill-btn {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid var(--border, rgba(51, 65, 85, 0.6));
          border-radius: 8px;
          padding: 0.45rem 0.65rem;
          color: var(--text-muted, #cbd5e1);
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          justify-content: center;
        }

        .pill-btn:hover {
          background: rgba(51, 65, 85, 0.6);
          color: #fff;
        }

        .pill-btn.active {
          background: rgba(99, 102, 241, 0.2);
          border-color: rgba(99, 102, 241, 0.6);
          color: #a5b4fc;
        }

        .pill-balance {
          font-size: 0.72rem;
          background: rgba(0, 0, 0, 0.3);
          padding: 1px 5px;
          border-radius: 4px;

        }

        .pill-balance.green {
          color: #34d399;
        }

        .pill-count {
          font-size: 0.72rem;
          opacity: 0.7;
        }

        .syndicate-pill-wrapper {
          flex: 1;
          position: relative;
        }

        .arrow {
          transition: transform 0.2s ease;
        }

        .arrow.open {
          transform: rotate(180deg);
        }

        .syndicate-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 10px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          z-index: 50;
          overflow: hidden;
          min-width: 260px;
        }

        .empty-syndicates-prompt {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.5rem;
          font-size: 0.78rem;
          color: #94a3b8;
        }

        .btn-link-mates {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          margin-top: 0.25rem;
          color: #818cf8;
          font-size: 0.75rem;
          font-weight: 600;
          text-decoration: none;
        }

        .btn-link-mates:hover {
          text-decoration: underline;
        }

        .syndicate-list {
          display: flex;
          flex-direction: column;
        }

        .syndicate-option-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.65rem 0.85rem;
          background: transparent;
          border: none;
          border-bottom: 1px solid rgba(51, 65, 85, 0.4);
          color: #e2e8f0;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: background 0.15s ease;
        }

        .syndicate-option-item:hover {
          background: rgba(30, 41, 59, 0.8);
        }

        .syndicate-option-item.selected {
          background: rgba(99, 102, 241, 0.15);
        }

        .syn-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .syn-name-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .syn-name {
          font-weight: 700;
          font-size: 0.82rem;
        }

        .syn-code {
          font-size: 0.7rem;
          color: #94a3b8;
          font-family: monospace;
        }

        .syn-meta {
          font-size: 0.72rem;
          color: #64748b;
          display: flex;
          gap: 0.4rem;
        }

        .syn-bal {
          color: #34d399;
          font-weight: 600;
        }

        .check-icon {
          color: #818cf8;
        }

        .dropdown-footer {
          padding: 0.5rem 0.85rem;
          background: rgba(15, 23, 42, 0.9);
          border-top: 1px solid rgba(51, 65, 85, 0.4);
        }

        .manage-mates-link {
          font-size: 0.72rem;
          color: #a5b4fc;
          font-weight: 600;
          text-decoration: none;
          display: block;
          text-align: center;
        }

        .manage-mates-link:hover {
          text-decoration: underline;
        }

        .syndicate-active-banner {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-top: 0.5rem;
          padding: 0.4rem 0.6rem;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 6px;
          font-size: 0.72rem;
          color: #c7d2fe;
        }

        .banner-icon {
          color: #818cf8;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
