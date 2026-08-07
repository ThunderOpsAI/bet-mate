"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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
  addBet: (
    bet: Omit<PaperBet, "id">,
    options?: { openBetslip?: boolean },
  ) => { status: "added" | "duplicate" | "limit_reached"; id?: string };
  removeBet: (id: string) => void;
  clearBetslip: () => void;
  placeBets: () => Promise<{ success: number; failed: number }>;
  isBetslipOpen: boolean;
  setIsBetslipOpen: (open: boolean) => void;
  updateBet: (id: string, updates: Partial<PaperBet>) => void;
  registerSelectionSnapshot: (snapshot: PaperBetSelectionSnapshot) => void;
  selectionSnapshots: Record<string, PaperBetSelectionSnapshot>;
  toasts: Array<{ id: string; message: string; type: "warning" | "success" | "error" | "info" }>;
  addToast: (message: string, type?: "warning" | "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
  defaultStake: number;
  setDefaultStake: (stake: number) => void;
}

const PaperBetslipContext = createContext<PaperBetslipContextType | undefined>(undefined);

import { API_BASE } from "../lib/api";
import { ANALYTICS_EVENTS, trackEvent } from "../lib/analytics";

export function PaperBetslipProvider({ children }: { children: React.ReactNode }) {
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [isBetslipOpen, setIsBetslipOpen] = useState(false);
  const [selectionSnapshots, setSelectionSnapshots] = useState<
    Record<string, PaperBetSelectionSnapshot>
  >({});
  const [hasHydrated, setHasHydrated] = useState(false);
  const betsRef = useRef<PaperBet[]>([]);
  const { token, updateBankroll, refreshUser } = useAuth();

  const [toasts, setToasts] = useState<
    Array<{ id: string; message: string; type: "warning" | "success" | "error" | "info" }>
  >([]);

  const [defaultStake, setDefaultStakeState] = useState<number>(10);
  const defaultStakeRef = useRef<number>(10);

  const addToast = useCallback((message: string, type: "warning" | "success" | "error" | "info" = "info") => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setDefaultStake = useCallback((val: number) => {
    if (val <= 0 || isNaN(val)) return;
    setDefaultStakeState(val);
    defaultStakeRef.current = val;
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("paper_betslip_default_stake", String(val));
    }
  }, []);

  useEffect(() => {
    const persistedBets = loadPersistedBetslip();
    betsRef.current = persistedBets;
    setBets(persistedBets);
    setIsBetslipOpen(loadPersistedBetslipOpen());

    const persistedStake = window.localStorage.getItem("paper_betslip_default_stake");
    if (persistedStake) {
      const val = Number(persistedStake);
      if (!isNaN(val) && val > 0) {
        setDefaultStakeState(val);
        defaultStakeRef.current = val;
      }
    }

    setHasHydrated(true);

    return subscribeToBetslipStorage((nextBets, nextOpen) => {
      betsRef.current = nextBets;
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

  const addBet = useCallback(
    (
      newBet: Omit<PaperBet, "id">,
      options?: { openBetslip?: boolean },
    ) => {
      const key = buildPaperBetKey({
        sport: newBet.sport,
        eventId: newBet.event_id,
        selection: newBet.selection,
        betType: newBet.bet_type,
      });

      let shouldOpenBetslip = options?.openBetslip ?? true;
      const sportLower = newBet.sport.trim().toLowerCase();
      if (sportLower === "afl" || sportLower === "nba") {
        shouldOpenBetslip = false;
      } else if (sportLower === "racing") {
        shouldOpenBetslip = true;
      }

      const existingBet = betsRef.current.find((bet) => {
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
        if (shouldOpenBetslip) {
          setIsBetslipOpen(true);
        }
        return { status: "duplicate" as const, id: existingBet.id };
      }

      if (betsRef.current.length >= 50) {
        addToast("Betslip limit reached. Maximum capacity is 50 bets.", "warning");
        return { status: "limit_reached" as const };
      }

      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2, 11);

      const nextBets = [
        ...betsRef.current,
        { ...newBet, stake: defaultStakeRef.current, id, added_at: new Date().toISOString() },
      ];
      betsRef.current = nextBets;
      setBets(nextBets);

      if (shouldOpenBetslip) {
        setIsBetslipOpen(true);
      }

      return { status: "added" as const, id };
    },
    [],
  );

  const removeBet = useCallback((id: string) => {
    const nextBets = betsRef.current.filter((bet) => bet.id !== id);
    betsRef.current = nextBets;
    setBets(nextBets);
  }, []);

  const clearBetslip = useCallback(() => {
    betsRef.current = [];
    setBets([]);
    clearPersistedBetslip();
  }, []);

  const updateBet = useCallback((id: string, updates: Partial<PaperBet>) => {
    const nextBets = betsRef.current.map((bet) =>
      bet.id === id ? { ...bet, ...updates } : bet,
    );
    betsRef.current = nextBets;
    setBets(nextBets);
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
      const mlPayload = bets.map((bet) => ({
        sport: bet.sport,
        event_id: bet.event_id,
        event_name: bet.event_name,
        selection: bet.selection,
        stake: bet.stake,
        odds: bet.odds,
        bet_type: bet.bet_type,
        notes: bet.notes,
      }));

      const apiPayload = {
        bets: bets.map((b) => {
          let eventType = "race";
          const s = (b.sport || "").toLowerCase();
          if (s === "afl") eventType = "afl_game";
          else if (s === "nba") eventType = "nba_game";
          else if (s === "nrl") eventType = "nrl_game";
          else if (s === "soccer") eventType = "soccer_game";
          else if (s === "golf") eventType = "golf_event";
          else if (s === "mma") eventType = "mma_fight";

          return {
            eventType,
            eventId: b.event_id,
            eventName: b.event_name,
            betType: b.bet_type || "win",
            selection: b.selection,
            odds: Number(b.odds) || 1.0,
            stake: Number(b.stake) || 0,
            wasAIRecommended: true,
            notes: b.notes || "",
          };
        }),
      };

      const mlPromise = fetch(`${ML_API}/api/paper-bets/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || "guest"}`,
        },
        body: JSON.stringify(mlPayload),
      });

      const expressPromise =
        token && token !== "guest"
          ? fetch(`${API_BASE}/bets/batch`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(apiPayload),
            })
          : Promise.resolve(null);

      const [mlResult, expressResult] = await Promise.allSettled([mlPromise, expressPromise]);

      let isMlSuccess = false;
      let mlData: any = null;
      if (mlResult.status === "fulfilled" && mlResult.value && mlResult.value.ok) {
        isMlSuccess = true;
        mlData = await mlResult.value.json().catch(() => ({}));
      }

      let isExpressSuccess = false;
      let expressData: any = null;
      if (expressResult.status === "fulfilled" && expressResult.value) {
        if (expressResult.value.ok) {
          isExpressSuccess = true;
          expressData = await expressResult.value.json().catch(() => ({}));
          if (refreshUser) void refreshUser();
        } else if (expressResult.value.status === 401) {
          console.warn("Express API returned 401 Unauthorized during bet placement. Falling back to local paper engine.");
        }
      }

      const isOverallSuccess = isMlSuccess || isExpressSuccess;

      if (isOverallSuccess) {
        const count = bets.length;
        const totalStakePlaced = bets.reduce((sum, b) => sum + (b.stake || 0), 0);

        trackEvent(ANALYTICS_EVENTS.PAPER_BET_PLACED, {
          totalBets: count,
          successCount: count,
          failedCount: 0,
          totalStake: totalStakePlaced,
          sports: Array.from(new Set(bets.map((b) => b.sport))),
        });

        if (updateBankroll) {
          updateBankroll(-totalStakePlaced);
        }

        // Clear betslip completely on successful paper placement
        betsRef.current = [];
        setBets([]);
        clearPersistedBetslip();

        return { success: count, failed: 0 };
      } else {
        console.error("Batch bet placement failed on both services", { mlResult, expressResult });
        return { success: 0, failed: bets.length };
      }
    } catch (e) {
      console.error("Failed to place batch bets", e);
      return { success: 0, failed: bets.length };
    }
  }, [bets, token, updateBankroll, refreshUser]);

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
        toasts,
        addToast,
        removeToast,
        defaultStake,
        setDefaultStake,
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
