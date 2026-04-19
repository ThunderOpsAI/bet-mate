"use client";
import React, { useState } from "react";
import { Send, ListPlus, Edit3 } from "lucide-react";
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

const SPORT_BET_TYPES: Record<string, { label: string; value: string }[]> = {
  racing: [
    { label: "Win", value: "win" },
    { label: "Place", value: "place" },
    { label: "Each Way", value: "each way" },
    { label: "Quinella", value: "quinella" },
    { label: "Exacta", value: "exacta" },
    { label: "Trifecta", value: "trifecta" },
    { label: "First 4", value: "first 4" },
  ],
  afl: [
    { label: "Head to Head", value: "head_to_head" },
    { label: "Disposals", value: "disposals" },
    { label: "Goals", value: "goals" },
    { label: "Handicap", value: "handicap" },
    { label: "Total Points O/U", value: "over/under" },
    { label: "Margin", value: "margin" },
  ],
  nba: [
    { label: "Head to Head", value: "head_to_head" },
    { label: "Points", value: "points" },
    { label: "Assists", value: "assists" },
    { label: "Rebounds", value: "rebounds" },
    { label: "Handicap", value: "handicap" },
    { label: "Total Points O/U", value: "over/under" },
  ],
};

const DEFAULT_TYPES = [
  { label: "Head to Head / Win", value: "win" },
  { label: "Player Prop", value: "prop" },
  { label: "Handicap", value: "handicap" },
  { label: "Totals / O/U", value: "over_under" },
];

export default function PaperBetAction({ bet }: PaperBetActionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [betType, setBetType] = useState(bet.bet_type);
  const [selection, setSelection] = useState(bet.selection);
  const [stake, setStake] = useState(bet.stake.toString());
  
  const { addBet } = usePaperBetslip();

  const handleOpen = () => {
    // initialize defaults
    setBetType(bet.bet_type);
    setSelection(bet.selection);
    setStake(bet.stake.toString());
    setIsOpen(true);
  };

  const handleSave = () => {
    addBet({
      sport: bet.sport,
      event_id: bet.event_id,
      event_name: bet.event_name,
      selection: selection,
      odds: bet.odds,
      bet_type: betType,
      stake: parseFloat(stake) || 10,
      notes: `Model pick for ${bet.event_name}`
    });
    setIsOpen(false);
  };

  const typesToUse = SPORT_BET_TYPES[bet.sport.toLowerCase()] || DEFAULT_TYPES;

  const paperBetParams = new URLSearchParams({
    sport: bet.sport,
    event_id: bet.event_id,
    event_name: bet.event_name,
    selection: selection,
    odds: String(bet.odds),
    bet_type: betType,
    stake: stake,
    notes: `Model pick for ${bet.event_name}`,
  });

  return (
    <>
      <button 
        className="btn btn-sm btn-secondary"
        onClick={handleOpen}
        style={{ gap: "0.25rem", whiteSpace: "nowrap" }}
      >
        <Edit3 size={14} /> Log Selection
      </button>

      {isOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsOpen(false)} 
          style={{ 
            zIndex: 1000, 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.6)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backdropFilter: 'blur(3px)'
          }}
        >
          <div 
            className="modal" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              background: 'var(--bg-secondary)', 
              padding: '1.75rem', 
              borderRadius: '12px', 
              width: '100%',
              maxWidth: '380px',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
            }}
          >
            <h3 style={{ marginBottom: "1.25rem", fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>Configure Selection</h3>
            
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label" style={{ display: "block", marginBottom: "0.4rem", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 500 }}>
                Bet Type
              </label>
              <select 
                className="form-input" 
                value={betType} 
                onChange={(e) => setBetType(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "8px" }}
              >
                {typesToUse.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label" style={{ display: "block", marginBottom: "0.4rem", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 500 }}>
                Selection / Line
              </label>
              <input 
                className="form-input" 
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
                placeholder="e.g. O30.5 Disposals"
                style={{ width: "100%", padding: "0.6rem", background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "8px" }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "4px", display: "block" }}>
                Add specifics (like handicap lines or combo names) so they appear correctly in your betslip.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label className="form-label" style={{ display: "block", marginBottom: "0.4rem", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 500 }}>
                Stake ($)
              </label>
              <input 
                type="number"
                className="form-input" 
                value={stake}
                min={1}
                onChange={(e) => setStake(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "8px" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <button className="btn btn-primary" onClick={handleSave} style={{ width: "100%", justifyContent: "center" }}>
                <ListPlus size={16} /> Add to Paper Betslip
              </button>
              
              <Link 
                href={`/bets/new?${paperBetParams.toString()}`}
                className="btn btn-secondary"
                onClick={() => setIsOpen(false)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", textDecoration: "none" }}
              >
                <Send size={16} /> Log Single Separately
              </Link>
            </div>
            
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", margin: "1rem auto 0", display: "block", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
