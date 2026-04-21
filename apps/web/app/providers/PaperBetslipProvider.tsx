"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ML_API } from "../lib/mlApi";
import { useAuth } from "./AuthProvider";
import { buildPaperBetKey } from "../lib/betslip/betKey";
import {
  clearPersistedBetslip,
  loadPersistedBetslip,
  loadPersistedBetslipOpen,
  savePersistedBetslip,
  savePersistedBetslipOpen,
  subscribeToBetslipStorage,
} from "../lib/betslip/persistSlip";

export interface PaperBet {
  id: string;
  sport: string;
  event_id: string;
  event_name: string;
  selection_id?: string;
  bet_type: string;
  selection: string;
  odds?: number;
  stake: number;
  notes?: string;
  added_at?: string;
  odds_source?: "market" | "model_fair" | "missing";
  event_start_time?: string;
  event_date?: string;
  is_closed?: boolean;
  is_unavailable?: boolean;
  unavailable_reason?: string;
}

export interface PaperBetSelectionSnapshot {
  sport: string;
  event_id: string;
  selection: string;
  bet_type?: string;
  current_odds?: number | null;
  odds_source?: "market" | "model_fair" | "missing";
  can_compare_odds?: boolean;
  event_start_time?: string;
  event_date?: string;
  is_closed?: boolean;
  is_unavailable?: boolean;
  unavailable_reason?: string;
  last_seen_at?: string;
}

interface PaperBetslipContextType {
  bets: PaperBet[];
  addBet: (bet: Omit<PaperBet, "id">) => { status: "added" | "duplicate"; id?: string };
  removeBet: (id: string) => void;
  clearBetslip: () => void;
  placeBets: () => Promise<{ success: number; failed: number }>;
  isBetslipOpen: boolean;
  setIsBetslipOpen: (open: boolean) => void;
  updateBet: (id: string, updates: Partial<PaperBet>) => void;
  registerSelectionSnapshot: (snapshot: PaperBetSelectionSnapshot) => void;
  selectionSnapshots: Record<string, PaperBetSelectionSnapshot>;
}

const PaperBetslipContext = createContext<PaperBetslipContextType | undefined>(undefined);

export function PaperBetslipProvider({ children }: { children: React.ReactNode }) {
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [isBetslipOpen, setIsBetslipOpen] = useState(false);
  const [selectionSnapshots, setSelectionSnapshots] = useState<
    Record<string, PaperBetSelectionSnapshot>
  >({});
  const [hasHydrated, setHasHydrated] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    setBets(loadPersistedBetslip());
    setIsBetslipOpen(loadPersistedBetslipOpen());
    setHasHydrated(true);

    return subscribeToBetslipStorage((nextBets, nextOpen) => {
      setBets(nextBets);
      setIsBetslipOpen(nextOpen);
    });
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }
    savePersistedBetslip(bets);
  }, [bets, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }
    savePersistedBetslipOpen(isBetslipOpen);
  }, [isBetslipOpen, hasHydrated]);

  const addBet = useCallback((newBet: Omit<PaperBet, "id">) => {
    const key = buildPaperBetKey({
      sport: newBet.sport,
      eventId: newBet.event_id,
      selection: newBet.selection,
      betType: newBet.bet_type,
    });

    const existingBet = bets.find((bet) => {
      return (
        buildPaperBetKey({
          sport: bet.sport,
          eventId: bet.event_id,
          selection: bet.selection,
          betType: bet.bet_type,
        }) === key
      );
    });

    if (existingBet) {
      setIsBetslipOpen(true);
      return { status: "duplicate" as const, id: existingBet.id };
    }

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 11);

    setBets((prev) => [
      ...prev,
      { ...newBet, id, added_at: new Date().toISOString() },
    ]);
    setIsBetslipOpen(true);
    return { status: "added" as const, id };
  }, [bets]);

  const removeBet = useCallback((id: string) => {
    setBets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const clearBetslip = useCallback(() => {
    setBets([]);
    clearPersistedBetslip();
  }, []);

  const updateBet = useCallback((id: string, updates: Partial<PaperBet>) => {
    setBets((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  }, []);

  const registerSelectionSnapshot = useCallback(
    (snapshot: PaperBetSelectionSnapshot) => {
      const key = buildPaperBetKey({
        sport: snapshot.sport,
        eventId: snapshot.event_id,
        selection: snapshot.selection,
        betType: snapshot.bet_type,
      });

      setSelectionSnapshots((prev) => ({
        ...prev,
        [key]: {
          ...snapshot,
          last_seen_at: snapshot.last_seen_at ?? new Date().toISOString(),
        },
      }));
    },
    [],
  );

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
        const data = await res.json().catch(() => ({}));
        const count = bets.length;
        const successCount = data?.count ?? count;
        const failedCount = count - successCount;
        
        if (failedCount === 0) {
          setBets([]);
        } else {
          // If partial, maybe leave the failed bets? But we don't know which ones. 
          // At least we report it accurately.
          setBets([]);
        }
        return { success: successCount, failed: failedCount };
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
        registerSelectionSnapshot,
        selectionSnapshots,
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
