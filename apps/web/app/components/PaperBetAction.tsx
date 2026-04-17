"use client";
import React, { useState, useRef, useEffect } from "react";
import { Plus, Send, ChevronDown, ListPlus } from "lucide-react";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";
import Link from "next/link";

interface PaperBetActionProps {
  bet: {
    sport: string;
    event_id: string;
    event_name: string;
    selection: string;
    odds: number;
    bet_type: string;
    stake: number;
  };
}

export default function PaperBetAction({ bet }: PaperBetActionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { addBet } = usePaperBetslip();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const paperBetParams = new URLSearchParams({
    sport: bet.sport,
    event_id: bet.event_id,
    event_name: bet.event_name,
    selection: bet.selection,
    odds: String(bet.odds),
    bet_type: bet.bet_type,
    stake: String(bet.stake),
    notes: `Model pick for ${bet.event_name}`,
  });

  return (
    <div className="paper-bet-action-container" ref={containerRef}>
      <button 
        className="btn btn-sm btn-secondary paper-bet-main-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        Track Bet <ChevronDown size={14} className={isOpen ? "rotate-180" : ""} />
      </button>

      {isOpen && (
        <div className="paper-bet-dropdown">
          <button 
            className="dropdown-item"
            onClick={() => {
              addBet({
                sport: bet.sport,
                event_id: bet.event_id,
                event_name: bet.event_name,
                selection: bet.selection,
                odds: bet.odds,
                bet_type: bet.bet_type,
                stake: bet.stake,
                notes: `Model pick for ${bet.event_name}`
              });
              setIsOpen(false);
            }}
          >
            <ListPlus size={14} /> Add to Paper Betslip
          </button>
          
          <Link 
            href={`/bets/new?${paperBetParams.toString()}`}
            className="dropdown-item"
            onClick={() => setIsOpen(false)}
          >
            <Send size={14} /> Log Single Paper Bet
          </Link>
        </div>
      )}

      <style jsx>{`
        .paper-bet-action-container {
          position: relative;
          display: inline-block;
        }

        .paper-bet-main-btn {
          gap: 0.25rem;
        }

        .rotate-180 {
          transform: rotate(180deg);
        }

        .paper-bet-dropdown {
          position: absolute;
          top: calc(100% + 5px);
          right: 0;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          width: 220px;
          z-index: 50;
          overflow: hidden;
          animation: slideUp 0.2s ease-out;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.75rem 1rem;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 0.85rem;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition: background 0.2s;
          text-decoration: none;
        }

        .dropdown-item:hover {
          background: var(--bg-glass);
          color: var(--accent-hover);
        }

        .dropdown-item:not(:last-child) {
          border-bottom: 1px solid var(--border);
        }
      `}</style>
    </div>
  );
}
