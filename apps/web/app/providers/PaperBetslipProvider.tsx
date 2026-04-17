"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ML_API } from "../lib/mlApi";
import { useAuth } from "./AuthProvider";

export interface PaperBet {
  id: string;
  sport: string;
  event_id: string;
  event_name: string;
  bet_type: string;
  selection: string;
  odds?: number;
  stake: number;
  notes?: string;
}

interface PaperBetslipContextType {
  bets: PaperBet[];
  addBet: (bet: Omit<PaperBet, "id">) => void;
  removeBet: (id: string) => void;
  clearBetslip: () => void;
  placeBets: () => Promise<{ success: number; failed: number }>;
  isBetslipOpen: boolean;
  setIsBetslipOpen: (open: boolean) => void;
  updateBet: (id: string, updates: Partial<PaperBet>) => void;
}

const PaperBetslipContext = createContext<PaperBetslipContextType | undefined>(undefined);

export function PaperBetslipProvider({ children }: { children: React.ReactNode }) {
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [isBetslipOpen, setIsBetslipOpen] = useState(false);
  const { token } = useAuth();

  // Load from localStorage if available
  useEffect(() => {
    const saved = localStorage.getItem("paper_betslip");
    if (saved) {
      try {
        setBets(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load betslip from localStorage", e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("paper_betslip", JSON.stringify(bets));
  }, [bets]);

  const addBet = useCallback((newBet: Omit<PaperBet, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    setBets((prev) => [...prev, { ...newBet, id }]);
    setIsBetslipOpen(true);
  }, []);

  const removeBet = useCallback((id: string) => {
    setBets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const clearBetslip = useCallback(() => {
    setBets([]);
  }, []);

  const updateBet = useCallback((id: string, updates: Partial<PaperBet>) => {
    setBets((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  }, []);

  const placeBets = useCallback(async () => {
    if (bets.length === 0) return { success: 0, failed: 0 };

    try {
      // Mapping for Prediction Engine (ML_API)
      const payload = bets.map((bet) => ({
        sport: bet.sport,
        event_id: bet.event_id,
        event_name: bet.event_name,
        selection: bet.selection,
        stake: bet.stake,
        odds: bet.odds,
        bet_type: bet.bet_type,
        notes: bet.notes,
      }));

      const res = await fetch(`${ML_API}/api/paper-bets/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || "guest"}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const count = bets.length;
        setBets([]);
        return { success: count, failed: 0 };
      } else {
        const data = await res.json().catch(() => ({}));
        console.error("Batch placement failed", data);
        return { success: 0, failed: bets.length };
      }
    } catch (e) {
      console.error("Failed to place batch bets", e);
      return { success: 0, failed: bets.length };
    }
  }, [bets, token]);

  return (
    <PaperBetslipContext.Provider
      value={{
        bets,
        addBet,
        removeBet,
        clearBetslip,
        placeBets,
        isBetslipOpen,
        setIsBetslipOpen,
        updateBet,
      }}
    >
      {children}
    </PaperBetslipContext.Provider>
  );
}

export function usePaperBetslip() {
  const context = useContext(PaperBetslipContext);
  if (context === undefined) {
    throw new Error("usePaperBetslip must be used within a PaperBetslipProvider");
  }
  return context;
}
