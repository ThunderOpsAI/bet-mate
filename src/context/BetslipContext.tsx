import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { PaperBetItem, SportCode } from "../types";
import { useAuth } from "./AuthContext";

export interface ToastItem {
  id: string;
  message: string;
  type: "success" | "warning" | "error" | "info";
}

interface BetslipContextType {
  bets: PaperBetItem[];
  activeBets: PaperBetItem[];
  settledBets: PaperBetItem[];
  isBetslipOpen: boolean;
  activeTab: "slip" | "active" | "settled";
  slipMode: "singles" | "multi";
  defaultStake: number;
  multiStake: number;
  toasts: ToastItem[];
  isPostMortemOpen: boolean;
  postMortemBet: PaperBetItem | null;
  isQuickBetOpen: boolean;
  quickBetItem: Omit<PaperBetItem, "id" | "added_at" | "status"> | null;
  isShareCardOpen: boolean;
  shareCardBet: PaperBetItem | null;
  setIsBetslipOpen: (open: boolean) => void;
  setActiveTab: (tab: "slip" | "active" | "settled") => void;
  setSlipMode: (mode: "singles" | "multi") => void;
  setDefaultStake: (stake: number) => void;
  setMultiStake: (stake: number) => void;
  addBet: (bet: Omit<PaperBetItem, "id" | "added_at" | "status">, openDrawer?: boolean) => void;
  removeBet: (id: string) => void;
  updateBetStake: (id: string, stake: number) => void;
  clearBetslip: () => void;
  placeBets: () => Promise<boolean>;
  simulateSettleNextBet: () => void;
  simulateSettleAllBets: () => void;
  openPostMortem: (bet: PaperBetItem) => void;
  closePostMortem: () => void;
  openQuickBet: (bet: Omit<PaperBetItem, "id" | "added_at" | "status">) => void;
  closeQuickBet: () => void;
  placeQuickBet: (stake: number, notes?: string) => Promise<boolean>;
  openShareCard: (bet?: PaperBetItem) => void;
  closeShareCard: () => void;
  addToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
  removeToast: (id: string) => void;
  calculateKellyStake: (probabilityPct: number, odds: number, bankrollFraction?: number) => number;
}

const BetslipContext = createContext<BetslipContextType | undefined>(undefined);

export const BetslipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, updateBankroll } = useAuth();

  const [bets, setBets] = useState<PaperBetItem[]>(() => {
    try {
      const stored = localStorage.getItem("betmate_paper_betslip");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeBets, setActiveBets] = useState<PaperBetItem[]>(() => {
    try {
      const stored = localStorage.getItem("betmate_active_bets");
      if (stored) return JSON.parse(stored);
    } catch {}
    // Seed initial active bet for instant engagement
    return [
      {
        id: "active-init-1",
        sport: "racing",
        event_id: "rand-r4",
        event_name: "Randwick R4 • 1200m",
        selection: "Think About It",
        bet_type: "win",
        odds: 2.80,
        stake: 25,
        fair_odds: 2.30,
        edge_pct: 21.7,
        added_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        status: "active",
      }
    ];
  });

  const [settledBets, setSettledBets] = useState<PaperBetItem[]>(() => {
    try {
      const stored = localStorage.getItem("betmate_settled_bets");
      if (stored) return JSON.parse(stored);
    } catch {}

    const dayMs = 24 * 3600 * 1000;
    const now = Date.now();

    // Seed realistic 30-day settled history across multiple bet types
    return [
      {
        id: "settled-1",
        sport: "racing",
        event_id: "flem-prev-1",
        event_name: "Flemington R7 • 1600m",
        selection: "Gold Trip",
        bet_type: "win",
        odds: 3.60,
        stake: 20,
        fair_odds: 2.90,
        edge_pct: 24.1,
        added_at: new Date(now - 1 * dayMs).toISOString(),
        status: "won",
        payout: 72.00,
        settled_at: new Date(now - 1 * dayMs + 3600000).toISOString(),
        settlement_notes: "Strong drive from 400m; model top pace rating validated."
      },
      {
        id: "settled-2",
        sport: "nba",
        event_id: "multi-prev-1",
        event_name: "NBA 2-Leg SGM • Nuggets vs Lakers",
        selection: "Jokic 25+ Pts & Murray 6+ Ast",
        bet_type: "multi",
        odds: 4.20,
        stake: 15,
        fair_odds: 3.40,
        edge_pct: 23.5,
        added_at: new Date(now - 2 * dayMs).toISOString(),
        status: "won",
        payout: 63.00,
        settled_at: new Date(now - 2 * dayMs + 7200000).toISOString(),
        settlement_notes: "Both legs cashed with 4 minutes remaining in the 4th."
      },
      {
        id: "settled-3",
        sport: "nba",
        event_id: "nba-prev-2",
        event_name: "NBA • Celtics vs Knicks",
        selection: "Jayson Tatum Over 28.5 Pts",
        bet_type: "prop",
        odds: 2.15,
        stake: 30,
        fair_odds: 1.85,
        edge_pct: 16.2,
        added_at: new Date(now - 4 * dayMs).toISOString(),
        status: "won",
        payout: 64.50,
        settled_at: new Date(now - 4 * dayMs + 3600000).toISOString(),
        settlement_notes: "Finished with 32 points on efficient 11-19 shooting."
      },
      {
        id: "settled-4",
        sport: "afl",
        event_id: "afl-prev-1",
        event_name: "AFL • Carlton vs Sydney",
        selection: "Carlton Moneyline",
        bet_type: "h2h",
        odds: 1.95,
        stake: 25,
        fair_odds: 1.80,
        edge_pct: 8.3,
        added_at: new Date(now - 5 * dayMs).toISOString(),
        status: "lost",
        payout: 0,
        settled_at: new Date(now - 5 * dayMs + 5400000).toISOString(),
        settlement_notes: "Conceded 4 consecutive late goals in 4th quarter."
      },
      {
        id: "settled-5",
        sport: "racing",
        event_id: "rand-r6",
        event_name: "Randwick R6 • 1200m",
        selection: "In Secret",
        bet_type: "each-way",
        odds: 2.70,
        stake: 20,
        fair_odds: 2.25,
        edge_pct: 20.0,
        added_at: new Date(now - 8 * dayMs).toISOString(),
        status: "won",
        payout: 54.00,
        settled_at: new Date(now - 8 * dayMs + 1800000).toISOString(),
        settlement_notes: "Flew home on the outside fence to salute comfortably."
      },
      {
        id: "settled-6",
        sport: "racing",
        event_id: "caul-r3",
        event_name: "Caulfield R3 • 1400m",
        selection: "Mr Brightside",
        bet_type: "win",
        odds: 4.50,
        stake: 15,
        fair_odds: 4.10,
        edge_pct: 9.7,
        added_at: new Date(now - 11 * dayMs).toISOString(),
        status: "lost",
        payout: 0,
        settled_at: new Date(now - 11 * dayMs + 2400000).toISOString(),
        settlement_notes: "Boxed in on rails until 100m mark, ran out of track."
      },
      {
        id: "settled-7",
        sport: "racing",
        event_id: "multi-prev-2",
        event_name: "Cross-Meeting 3-Leg Multi",
        selection: "Flemington R2 + Randwick R3 + Doomben R4",
        bet_type: "multi",
        odds: 7.80,
        stake: 10,
        fair_odds: 6.20,
        edge_pct: 25.8,
        added_at: new Date(now - 14 * dayMs).toISOString(),
        status: "lost",
        payout: 0,
        settled_at: new Date(now - 14 * dayMs + 7200000).toISOString(),
        settlement_notes: "Leg 1 & 2 won; Leg 3 missed place by a nose."
      },
      {
        id: "settled-8",
        sport: "nrl",
        event_id: "nrl-prev-1",
        event_name: "NRL • Penrith vs Brisbane",
        selection: "Penrith Panthers Head to Head",
        bet_type: "h2h",
        odds: 1.90,
        stake: 35,
        fair_odds: 1.65,
        edge_pct: 15.1,
        added_at: new Date(now - 16 * dayMs).toISOString(),
        status: "won",
        payout: 66.50,
        settled_at: new Date(now - 16 * dayMs + 4800000).toISOString(),
        settlement_notes: "Clinical defensive masterclass in the second half."
      },
      {
        id: "settled-9",
        sport: "racing",
        event_id: "doom-r5",
        event_name: "Doomben R5 • 1350m",
        selection: "Antino",
        bet_type: "win",
        odds: 3.30,
        stake: 25,
        fair_odds: 2.70,
        edge_pct: 22.2,
        added_at: new Date(now - 19 * dayMs).toISOString(),
        status: "won",
        payout: 82.50,
        settled_at: new Date(now - 19 * dayMs + 1800000).toISOString(),
        settlement_notes: "Huge turn of foot around the bend, eased down late."
      },
      {
        id: "settled-10",
        sport: "racing",
        event_id: "rose-r2",
        event_name: "Rosehill R2 • 1500m",
        selection: "Espiona",
        bet_type: "each-way",
        odds: 2.40,
        stake: 20,
        fair_odds: 2.05,
        edge_pct: 17.1,
        added_at: new Date(now - 22 * dayMs).toISOString(),
        status: "won",
        payout: 48.00,
        settled_at: new Date(now - 22 * dayMs + 2100000).toISOString(),
        settlement_notes: "Solid 2nd placing paying full each-way dividends."
      },
      {
        id: "settled-11",
        sport: "soccer",
        event_id: "epl-prev-1",
        event_name: "EPL • Man City vs Arsenal",
        selection: "Man City to Win",
        bet_type: "h2h",
        odds: 1.90,
        stake: 30,
        fair_odds: 1.70,
        edge_pct: 11.8,
        added_at: new Date(now - 24 * dayMs).toISOString(),
        status: "won",
        payout: 57.00,
        settled_at: new Date(now - 24 * dayMs + 7200000).toISOString(),
        settlement_notes: "Late Haaland winner off corner delivery."
      },
      {
        id: "settled-12",
        sport: "racing",
        event_id: "multi-prev-3",
        event_name: "Saturday Double Multi",
        selection: "Imperatriz Win + Think About It Win",
        bet_type: "multi",
        odds: 5.90,
        stake: 15,
        fair_odds: 4.80,
        edge_pct: 22.9,
        added_at: new Date(now - 26 * dayMs).toISOString(),
        status: "won",
        payout: 88.50,
        settled_at: new Date(now - 26 * dayMs + 3600000).toISOString(),
        settlement_notes: "Both G1 favorites executed cleanly."
      },
      {
        id: "settled-13",
        sport: "nba",
        event_id: "nba-prev-3",
        event_name: "NBA • Warriors vs Lakers",
        selection: "Steph Curry Over 4.5 Threes",
        bet_type: "prop",
        odds: 2.20,
        stake: 20,
        fair_odds: 1.95,
        edge_pct: 12.8,
        added_at: new Date(now - 28 * dayMs).toISOString(),
        status: "lost",
        payout: 0,
        settled_at: new Date(now - 28 * dayMs + 5400000).toISOString(),
        settlement_notes: "Finished 4-11 from deep, missed last second attempt."
      },
      {
        id: "settled-14",
        sport: "racing",
        event_id: "morp-r4",
        event_name: "Morphettville R4 • 1100m",
        selection: "Asfoora",
        bet_type: "win",
        odds: 3.00,
        stake: 20,
        fair_odds: 2.45,
        edge_pct: 22.4,
        added_at: new Date(now - 29 * dayMs).toISOString(),
        status: "won",
        payout: 60.00,
        settled_at: new Date(now - 29 * dayMs + 1800000).toISOString(),
        settlement_notes: "Blistering early speed led wire to wire."
      }
    ];
  });

  const [isBetslipOpen, setIsBetslipOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"slip" | "active" | "settled">("slip");
  const [slipMode, setSlipMode] = useState<"singles" | "multi">("singles");
  const [defaultStake, setDefaultStake] = useState(10);
  const [multiStake, setMultiStake] = useState(10);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isPostMortemOpen, setIsPostMortemOpen] = useState(false);
  const [postMortemBet, setPostMortemBet] = useState<PaperBetItem | null>(null);
  const [isQuickBetOpen, setIsQuickBetOpen] = useState(false);
  const [quickBetItem, setQuickBetItem] = useState<Omit<PaperBetItem, "id" | "added_at" | "status"> | null>(null);
  const [isShareCardOpen, setIsShareCardOpen] = useState(false);
  const [shareCardBet, setShareCardBet] = useState<PaperBetItem | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("betmate_paper_betslip", JSON.stringify(bets));
    } catch {}
  }, [bets]);

  useEffect(() => {
    try {
      localStorage.setItem("betmate_active_bets", JSON.stringify(activeBets));
    } catch {}
  }, [activeBets]);

  useEffect(() => {
    try {
      localStorage.setItem("betmate_settled_bets", JSON.stringify(settledBets));
    } catch {}
  }, [settledBets]);

  const addToast = useCallback((message: string, type: ToastItem["type"] = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addBet = useCallback(
    (newBet: Omit<PaperBetItem, "id" | "added_at" | "status">, openDrawer: boolean = false) => {
      setBets((prev) => {
        const existing = prev.find(
          (b) => b.event_id === newBet.event_id && b.selection === newBet.selection
        );
        if (existing) {
          addToast(`"${newBet.selection}" is already in your betslip!`, "warning");
          return prev;
        }

        const item: PaperBetItem = {
          ...newBet,
          id: `slip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          added_at: new Date().toISOString(),
          status: "active",
        };

        addToast(`Added "${newBet.selection}" ($${newBet.odds.toFixed(2)}) to slip`, "success");
        return [...prev, item];
      });

      if (openDrawer) {
        setIsBetslipOpen(true);
        setActiveTab("slip");
      }
    },
    [addToast]
  );

  const removeBet = useCallback((id: string) => {
    setBets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const updateBetStake = useCallback((id: string, stake: number) => {
    setBets((prev) =>
      prev.map((b) => (b.id === id ? { ...b, stake: Math.max(1, stake) } : b))
    );
  }, []);

  const clearBetslip = useCallback(() => {
    setBets([]);
  }, []);

  const calculateKellyStake = useCallback(
    (probabilityPct: number, odds: number, bankrollFraction: number = 0.25): number => {
      const p = probabilityPct > 1 ? probabilityPct / 100 : probabilityPct;
      const b = odds - 1;
      if (b <= 0 || p <= 0) return defaultStake;
      const q = 1 - p;
      const f = (p * b - q) / b;
      if (f <= 0) return defaultStake; // No positive edge
      // Fractional Kelly applied to user bankroll (e.g. 25% Kelly)
      const rawStake = user.currentBankroll * f * bankrollFraction;
      return Math.max(5, Math.min(250, Math.round(rawStake)));
    },
    [user.currentBankroll, defaultStake]
  );

  const placeBets = useCallback(async (): Promise<boolean> => {
    if (bets.length === 0) return false;

    if (slipMode === "singles") {
      const totalStake = bets.reduce((sum, b) => sum + (b.stake || defaultStake), 0);
      if (user.currentBankroll < totalStake) {
        addToast(`Insufficient virtual bankroll ($${user.currentBankroll.toFixed(2)} available, need $${totalStake.toFixed(2)})`, "error");
        return false;
      }

      updateBankroll(-totalStake);

      const placedItems: PaperBetItem[] = bets.map((b) => ({
        ...b,
        status: "active",
        added_at: new Date().toISOString(),
      }));

      setActiveBets((prev) => [...placedItems, ...prev]);
      setBets([]);
      addToast(`Placed ${placedItems.length} single paper bets totaling $${totalStake.toFixed(2)}!`, "success");
      setActiveTab("active");
      return true;
    } else {
      // Multi Mode
      const combinedOdds = bets.reduce((acc, b) => acc * (b.odds || 1.80), 1);
      const stake = multiStake || defaultStake;
      if (user.currentBankroll < stake) {
        addToast(`Insufficient virtual bankroll ($${user.currentBankroll.toFixed(2)} available, need $${stake.toFixed(2)})`, "error");
        return false;
      }

      updateBankroll(-stake);

      const multiItem: PaperBetItem = {
        id: `multi_${Date.now()}`,
        sport: bets[0]?.sport || "racing",
        event_id: "multi",
        event_name: `${bets.length}-Leg Multi (${bets.map((b) => b.selection).join(" + ")})`,
        selection: `${bets.length} Selections Multi`,
        bet_type: "multi",
        odds: Number(combinedOdds.toFixed(2)),
        stake,
        fair_odds: Number((combinedOdds * 0.85).toFixed(2)),
        edge_pct: 12.5,
        added_at: new Date().toISOString(),
        status: "active",
      };

      setActiveBets((prev) => [multiItem, ...prev]);
      setBets([]);
      addToast(`Placed ${bets.length}-Leg Multi at $${combinedOdds.toFixed(2)} with $${stake} stake!`, "success");
      setActiveTab("active");
      return true;
    }
  }, [bets, slipMode, defaultStake, multiStake, user.currentBankroll, updateBankroll, addToast]);

  const simulateSettleNextBet = useCallback(() => {
    if (activeBets.length === 0) {
      addToast("No active bets to simulate resolution.", "warning");
      return;
    }

    const betToSettle = activeBets[0];
    const isWin = Math.random() < Math.min(0.75, 1 / (betToSettle.odds || 2.0) + 0.1);
    const payout = isWin ? Math.round(betToSettle.stake * betToSettle.odds * 100) / 100 : 0;
    const profit = payout - betToSettle.stake;

    if (isWin) {
      updateBankroll(payout);
      addToast(`🎉 WON: "${betToSettle.selection}" paid out $${payout.toFixed(2)} (+$${profit.toFixed(2)})!`, "success");
    } else {
      addToast(`❌ LOST: "${betToSettle.selection}" settled as loss (-$${betToSettle.stake.toFixed(2)}).`, "info");
    }

    const settledItem: PaperBetItem = {
      ...betToSettle,
      status: isWin ? "won" : "lost",
      payout,
      settled_at: new Date().toISOString(),
      settlement_notes: isWin
        ? "Runner dominated tempo and scored decisive victory according to model expectations."
        : "Failed to find clear racing room; late surge came up short.",
    };

    setActiveBets((prev) => prev.slice(1));
    setSettledBets((prev) => [settledItem, ...prev]);
  }, [activeBets, updateBankroll, addToast]);

  const simulateSettleAllBets = useCallback(() => {
    if (activeBets.length === 0) {
      addToast("No active bets to simulate.", "warning");
      return;
    }

    let totalPayout = 0;
    let wonCount = 0;

    const resolved = activeBets.map((bet) => {
      const isWin = Math.random() < Math.min(0.75, 1 / (bet.odds || 2.0) + 0.08);
      const payout = isWin ? Math.round(bet.stake * bet.odds * 100) / 100 : 0;
      if (isWin) {
        totalPayout += payout;
        wonCount++;
      }
      return {
        ...bet,
        status: isWin ? ("won" as const) : ("lost" as const),
        payout,
        settled_at: new Date().toISOString(),
        settlement_notes: isWin
          ? "Target outcome achieved. Model probability correctly identified value."
          : "Unfavorable game script or interference held selection back.",
      };
    });

    if (totalPayout > 0) {
      updateBankroll(totalPayout);
    }

    addToast(`Resolved ${activeBets.length} bets: ${wonCount} Won, ${activeBets.length - wonCount} Lost. Total return: $${totalPayout.toFixed(2)}`, "success");
    setActiveBets([]);
    setSettledBets((prev) => [...resolved, ...prev]);
  }, [activeBets, updateBankroll, addToast]);

  const openPostMortem = useCallback((bet: PaperBetItem) => {
    setPostMortemBet(bet);
    setIsPostMortemOpen(true);
  }, []);

  const closePostMortem = useCallback(() => {
    setIsPostMortemOpen(false);
    setPostMortemBet(null);
  }, []);

  const openQuickBet = useCallback((bet: Omit<PaperBetItem, "id" | "added_at" | "status">) => {
    setQuickBetItem(bet);
    setIsQuickBetOpen(true);
  }, []);

  const closeQuickBet = useCallback(() => {
    setIsQuickBetOpen(false);
    setQuickBetItem(null);
  }, []);

  const placeQuickBet = useCallback(
    async (stake: number, notes?: string): Promise<boolean> => {
      if (!quickBetItem) return false;
      if (user.currentBankroll < stake) {
        addToast(
          `Insufficient virtual bankroll ($${user.currentBankroll.toFixed(2)} available, need $${stake.toFixed(2)})`,
          "error"
        );
        return false;
      }

      updateBankroll(-stake);
      const computedProb = quickBetItem.fair_odds
        ? Math.round((1 / quickBetItem.fair_odds) * 100)
        : Math.min(95, Math.max(10, Math.round((1 / quickBetItem.odds) * 100 + (quickBetItem.edge_pct || 15))));

      const placedItem: PaperBetItem = {
        ...quickBetItem,
        id: `quick_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        stake,
        notes: notes?.trim() || undefined,
        probability: computedProb,
        status: "active",
        added_at: new Date().toISOString(),
      };

      setActiveBets((prev) => [placedItem, ...prev]);
      setActiveTab("active");
      addToast(
        `⚡ Quick Bet confirmed & synced to My Bets: "${placedItem.selection}" ($${stake.toFixed(2)} @ $${placedItem.odds.toFixed(2)})!`,
        "success"
      );
      setIsQuickBetOpen(false);
      setQuickBetItem(null);
      return true;
    },
    [quickBetItem, user.currentBankroll, updateBankroll, addToast]
  );

  const openShareCard = useCallback((bet?: PaperBetItem) => {
    if (bet) {
      setShareCardBet(bet);
    } else {
      const winners = settledBets.filter((b) => b.status === "won");
      const topWinner =
        winners.sort(
          (a, b) => (b.payout || 0) - b.stake - ((a.payout || 0) - a.stake)
        )[0] || settledBets[0] || null;
      setShareCardBet(topWinner);
    }
    setIsShareCardOpen(true);
  }, [settledBets]);

  const closeShareCard = useCallback(() => {
    setIsShareCardOpen(false);
    setShareCardBet(null);
  }, []);

  return (
    <BetslipContext.Provider
      value={{
        bets,
        activeBets,
        settledBets,
        isBetslipOpen,
        activeTab,
        slipMode,
        defaultStake,
        multiStake,
        toasts,
        isPostMortemOpen,
        postMortemBet,
        isQuickBetOpen,
        quickBetItem,
        isShareCardOpen,
        shareCardBet,
        setIsBetslipOpen,
        setActiveTab,
        setSlipMode,
        setDefaultStake,
        setMultiStake,
        addBet,
        removeBet,
        updateBetStake,
        clearBetslip,
        placeBets,
        simulateSettleNextBet,
        simulateSettleAllBets,
        openPostMortem,
        closePostMortem,
        openQuickBet,
        closeQuickBet,
        placeQuickBet,
        openShareCard,
        closeShareCard,
        addToast,
        removeToast,
        calculateKellyStake,
      }}
    >
      {children}
    </BetslipContext.Provider>
  );
};

export const useBetslip = () => {
  const context = useContext(BetslipContext);
  if (!context) {
    throw new Error("useBetslip must be used within a BetslipProvider");
  }
  return context;
};
