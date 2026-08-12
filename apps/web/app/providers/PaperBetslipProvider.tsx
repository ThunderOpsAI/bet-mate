"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
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
  bet_family?: "single" | "exotic" | "quaddie" | "sgm" | "srm";
  exotic_bet_type?:
    | "QUINELLA"
    | "EXACTA"
    | "TRIFECTA"
    | "FIRST4"
    | "QUADDIE"
    | "EARLY_QUADDIE"
    | "TREBLE"
    | "RUNNING_DOUBLE";
  leg_number?: number;
  position?: number;
  runner_name?: string;
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

export interface ActiveBetItem {
  id: string;
  selection: string;
  event_name: string;
  sport: string;
  bet_type: string;
  odds: number;
  stake: number;
  status: "active" | "won" | "lost" | "settled" | "pending";
  payout?: number;
  placed_at?: string;
}

interface PaperBetslipContextType {
  bets: PaperBet[];
  activeBets: ActiveBetItem[];
  activeTab: "slip" | "active" | "settled";
  setActiveTab: (tab: "slip" | "active" | "settled") => void;
  openBetslipTab: (tab: "slip" | "active" | "settled") => void;
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
  toasts: Array<{
    id: string;
    message: string;
    type: "warning" | "success" | "error" | "info";
  }>;
  addToast: (
    message: string,
    type?: "warning" | "success" | "error" | "info",
  ) => void;
  removeToast: (id: string) => void;
  defaultStake: number;
  setDefaultStake: (stake: number) => void;
}

const PaperBetslipContext = createContext<PaperBetslipContextType | undefined>(
  undefined,
);

import { API_BASE } from "../lib/api";
import { ANALYTICS_EVENTS, trackEvent } from "../lib/analytics";

export function PaperBetslipProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [activeBets, setActiveBets] = useState<ActiveBetItem[]>([]);
  const [isBetslipOpen, setIsBetslipOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"slip" | "active" | "settled">("slip");

  const openBetslipTab = useCallback((tab: "slip" | "active" | "settled") => {
    setActiveTab(tab);
    setIsBetslipOpen(true);
    savePersistedBetslipOpen(true);
  }, []);
  const [selectionSnapshots, setSelectionSnapshots] = useState<
    Record<string, PaperBetSelectionSnapshot>
  >({});
  const [hasHydrated, setHasHydrated] = useState(false);
  const betsRef = useRef<PaperBet[]>([]);
  const { token, updateBankroll, refreshUser } = useAuth();

  const [toasts, setToasts] = useState<
    Array<{
      id: string;
      message: string;
      type: "warning" | "success" | "error" | "info";
    }>
  >([]);

  const [defaultStake, setDefaultStakeState] = useState<number>(10);
  const defaultStakeRef = useRef<number>(10);

  const addToast = useCallback(
    (
      message: string,
      type: "warning" | "success" | "error" | "info" = "info",
    ) => {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

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

    try {
      const rawActive = window.localStorage.getItem("paper_active_bets_list");
      if (rawActive) {
        setActiveBets(JSON.parse(rawActive));
      }
    } catch {}

    const persistedStake = window.localStorage.getItem(
      "paper_betslip_default_stake",
    );
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
    (newBet: Omit<PaperBet, "id">, options?: { openBetslip?: boolean }) => {
      const key = buildPaperBetKey({
        sport: newBet.sport,
        eventId: newBet.event_id,
        selection: newBet.selection,
        betType: newBet.bet_type,
      });

      const shouldOpenBetslip = options?.openBetslip ?? false;

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
        addToast(
          "Betslip limit reached. Maximum capacity is 50 bets.",
          "warning",
        );
        return { status: "limit_reached" as const };
      }

      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2, 11);

      const nextBets = [
        ...betsRef.current,
        {
          ...newBet,
          stake: defaultStakeRef.current,
          id,
          added_at: new Date().toISOString(),
        },
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
      const mlPayload = bets
        .filter((bet) => !bet.bet_family || bet.bet_family === "single")
        .map((bet) => ({
          sport: bet.sport,
          event_id: bet.event_id,
          event_name: bet.event_name,
          selection: bet.selection,
          stake: bet.stake,
          odds: bet.odds,
          bet_type: bet.bet_type,
          notes: bet.notes,
        }));

      const toEventType = (sport: string) => {
        const s = (sport || "").toLowerCase();
        if (s === "afl") return "afl_game";
        if (s === "nba") return "nba_game";
        if (s === "nrl") return "nrl_game";
        if (s === "soccer") return "soccer_game";
        if (s === "golf") return "golf_event";
        if (s === "mma") return "mma_fight";
        return "race";
      };

      const singleBets = bets.filter(
        (b) =>
          !b.bet_family || b.bet_family === "single" || b.bet_family === "srm",
      );
      const exoticBets = bets.filter(
        (b) => b.bet_family === "exotic" || b.bet_family === "quaddie",
      );
      const sgmBets = bets.filter((b) => b.bet_family === "sgm");

      const apiPayload = {
        bets: singleBets.map((b) => ({
          eventType: toEventType(b.sport),
          eventId: b.event_id,
          eventName: b.event_name,
          betType: b.bet_type || "win",
          selection: b.selection,
          odds: Number(b.odds) || 1.0,
          stake: Number(b.stake) || 0,
          wasAIRecommended: true,
          notes: b.notes || "",
        })),
      };

      const mlPromise =
        mlPayload.length > 0
          ? fetch(`${ML_API}/api/paper-bets/batch`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token || "guest"}`,
              },
              body: JSON.stringify(mlPayload),
            })
          : Promise.resolve(null);

      const expressRequests: Promise<Response>[] = [];
      if (token && token !== "guest") {
        if (apiPayload.bets.length > 0) {
          expressRequests.push(
            fetch(`${API_BASE}/bets/batch`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(apiPayload),
            }),
          );
        }

        if (exoticBets.length > 0) {
          const first = exoticBets[0];
          expressRequests.push(
            fetch(`${API_BASE}/bets/exotics`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                betType: first.exotic_bet_type ?? "QUINELLA",
                eventName: first.event_name,
                raceId: first.event_id,
                stake: exoticBets.reduce(
                  (sum, bet) => sum + (Number(bet.stake) || 0),
                  0,
                ),
                legs: exoticBets.map((bet) => ({
                  raceId: bet.event_id,
                  legNumber: bet.leg_number ?? 1,
                  position: bet.position,
                  runnerId: bet.selection_id ?? bet.selection,
                  runnerName: bet.runner_name ?? bet.selection,
                  selectionMode: "BOXED",
                })),
              }),
            }),
          );
        }

        if (sgmBets.length > 1) {
          const first = sgmBets[0];
          expressRequests.push(
            fetch(`${API_BASE}/bets/sgm`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                multiType: "SGM",
                eventType: toEventType(first.sport),
                eventId: first.event_id,
                eventName: first.event_name,
                stake: sgmBets.reduce(
                  (sum, bet) => sum + (Number(bet.stake) || 0),
                  0,
                ),
                legs: sgmBets.map((bet) => ({
                  marketType: bet.bet_type,
                  selectionId: bet.selection_id,
                  selectionLabel: bet.selection,
                  odds: Number(bet.odds),
                })),
              }),
            }),
          );
        }
      }

      const expressPromise =
        expressRequests.length > 0
          ? Promise.all(expressRequests)
          : Promise.resolve(null);

      const [mlResult, expressResult] = await Promise.allSettled([
        mlPromise,
        expressPromise,
      ]);

      let isMlSuccess = false;
      let mlData: any = null;
      if (
        mlResult.status === "fulfilled" &&
        mlResult.value &&
        mlResult.value.ok
      ) {
        isMlSuccess = true;
        mlData = await mlResult.value.json().catch(() => ({}));
      }

      let isExpressSuccess = false;
      let expressData: any = null;
      if (expressResult.status === "fulfilled" && expressResult.value) {
        const responses = Array.isArray(expressResult.value)
          ? expressResult.value
          : [expressResult.value];
        isExpressSuccess =
          responses.length > 0 && responses.every((response) => response.ok);
        if (isExpressSuccess) {
          expressData = await Promise.all(
            responses.map((response) => response.json().catch(() => ({}))),
          );
          if (refreshUser) void refreshUser();
        } else if (responses.some((response) => response.status === 401)) {
          console.warn(
            "Express API returned 401 Unauthorized during bet placement. Falling back to local paper engine.",
          );
        }
      }

      const isOverallSuccess = isMlSuccess || isExpressSuccess;

      if (isOverallSuccess) {
        const count = bets.length;
        const totalStakePlaced = bets.reduce(
          (sum, b) => sum + (b.stake || 0),
          0,
        );

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

        // Move placed bets into active (unsettled) bets list
        const newlyPlaced: ActiveBetItem[] = bets.map((b) => ({
          id: b.id || `active-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          selection: b.selection,
          event_name: b.event_name,
          sport: b.sport,
          bet_type: b.bet_type,
          odds: b.odds || 1.85,
          stake: b.stake || 10,
          status: "active",
          payout: (b.stake || 10) * (b.odds || 1.85),
          placed_at: new Date().toISOString(),
        }));

        setActiveBets((prev) => {
          const next = [...newlyPlaced, ...prev];
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem("paper_active_bets_list", JSON.stringify(next));
          }
          return next;
        });

        // Clear betslip completely on successful paper placement
        betsRef.current = [];
        setBets([]);
        clearPersistedBetslip();

        return { success: count, failed: 0 };
      } else {
        console.error("Batch bet placement failed on both services", {
          mlResult,
          expressResult,
        });
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
        activeBets,
        activeTab,
        setActiveTab,
        openBetslipTab,
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
    throw new Error(
      "usePaperBetslip must be used within a PaperBetslipProvider",
    );
  }
  return context;
}
