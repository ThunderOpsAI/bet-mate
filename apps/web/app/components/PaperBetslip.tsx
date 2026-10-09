"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Receipt,
  Ticket,
  Trash2,
  X,
  Sparkles,
  Zap,
  Activity,
  Clock,
  Check,
  DollarSign,
  History,
  FileText,
  RotateCw,
  Share2,
  Brain,
  Edit2,
  Layers,
  Sliders,
  Shield,
  HelpCircle,
  Copy,
  ArrowLeftRight,
  Grid3X3,
} from "lucide-react";
import {
  buildPaperBetKey,
  getOddsShiftPercent,
  hasEventStarted,
} from "../lib/betslip/betKey";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";
import { useAuth } from "../providers/AuthProvider";
import { API_BASE, safeResponseJson } from "../lib/api";
import GuestModal from "./GuestModal";
import MultiLiveMaths, { MultiEvaluationResult } from "./betslip/MultiLiveMaths";
import CorrelationWarningBanner from "./betslip/CorrelationWarningBanner";
import WeakestLegBanner from "./betslip/WeakestLegBanner";
import WhyThisLegDrawer from "./betslip/WhyThisLegDrawer";
import SlipModeToggle, { SlipMode } from "./betslip/SlipModeToggle";
import KellyStakeControl from "./betslip/KellyStakeControl";
import ShareSlipModal from "./betslip/ShareSlipModal";
import BestPriceBadge from "./betslip/BestPriceBadge";

export type ActiveBetItem = {
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
};

type BetIssue = {
  tone: "warning" | "danger" | "info";
  message: string;
  blocking: boolean;
  requiresReview: boolean;
};

function AwaitingExoticPool() {
  return (
    <div className="betslip-empty">
      <Receipt size={28} className="text-amber-400 mx-auto mb-2" />
      <p>Awaiting exotic pool data</p>
      <p className="small">
        Select live runners to calculate combinations; no synthetic dividends
        are shown.
      </p>
    </div>
  );
}

function PaperBetslipContent() {
  const { user } = useAuth();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const {
    bets,
    activeBets: contextActiveBets,
    activeTab: contextMainTab,
    setActiveTab: setContextMainTab,
    clearBetslip,
    isBetslipOpen,
    placeBets,
    removeBet,
    addBet,
    selectionSnapshots,
    setIsBetslipOpen,
    updateBet,
    defaultStake,
    setDefaultStake,
    settleAllCompletedBets,
    clearResultedBets,
    addToast,
    slipName,
    setSlipName,
    slipMode,
    setSlipMode,
    swapLeg,
    saveCurrentSlip,
    cloneSlip,
  } = usePaperBetslip();

  const [placing, setPlacing] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [acknowledgeOddsChanges, setAcknowledgeOddsChanges] = useState(false);
  const [myBetsSubTab, setMyBetsSubTab] = useState<"active" | "settled">("active");
  const [activeBets, setActiveBets] = useState<ActiveBetItem[]>([]);
  const [loadingActiveBets, setLoadingActiveBets] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [expandedInsights, setExpandedInsights] = useState<Record<string, boolean>>({});
  const [multiEvaluation, setMultiEvaluation] = useState<MultiEvaluationResult | null>(null);
  const [isEditingSlipName, setIsEditingSlipName] = useState(false);
  const [roundRobinUnitStake, setRoundRobinUnitStake] = useState<number>(defaultStake || 5);

  const toggleInsight = (id: string) => {
    setExpandedInsights((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const combinedActiveBets = useMemo(() => {
    const map = new Map<string, ActiveBetItem>();
    (contextActiveBets || []).forEach((b) => map.set(b.id, b));
    (activeBets || []).forEach((b) => map.set(b.id, b));
    return Array.from(map.values()).sort((a, b) => {
      const tA = a.placed_at ? new Date(a.placed_at).getTime() : 0;
      const tB = b.placed_at ? new Date(b.placed_at).getTime() : 0;
      return tB - tA;
    });
  }, [contextActiveBets, activeBets]);

  const unsettledBets = useMemo(() => {
    return combinedActiveBets.filter((b) => {
      const s = (b.status || "").toLowerCase();
      return s === "active" || s === "pending";
    });
  }, [combinedActiveBets]);

  const settledBets = useMemo(() => {
    return combinedActiveBets.filter((b) => {
      const s = (b.status || "").toLowerCase();
      return s === "won" || s === "lost" || s === "settled";
    });
  }, [combinedActiveBets]);
  const [multiStake, setMultiStake] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<
    "singles" | "multi" | "round_robin" | "exotics" | "quaddie" | "sgm"
  >("singles");

  useEffect(() => {
    if (isBetslipOpen && user && user.id !== "guest") {
      const token = typeof window !== "undefined" ? localStorage.getItem("betmate_token") : null;
      setLoadingActiveBets(true);
      fetch(`${API_BASE}/bets`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await safeResponseJson(res);
            const allBets: ActiveBetItem[] = data?.bets || [];
            setActiveBets(allBets.filter((b) => b.status === "active" || b.status === "pending"));
          }
        })
        .catch(() => {})
        .finally(() => setLoadingActiveBets(false));
    }
  }, [isBetslipOpen, user]);

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
          message:
            "Duplicate selection in slip. Review your stake before logging twice.",
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
          message:
            "Event already started. Remove this pick before logging the slip.",
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

      if (
        bet.bet_family !== "exotic" &&
        bet.bet_family !== "quaddie" &&
        (!bet.odds || bet.odds <= 1)
      ) {
        issues.push({
          tone: "danger",
          message:
            "Missing usable odds. This selection cannot be logged from the slip yet.",
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

      if (
        snapshot &&
        !snapshot.can_compare_odds &&
        bet.odds_source !== "market"
      ) {
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

  const singlesBets = useMemo(() => {
    return bets.filter(
      (b) => !b.bet_family || b.bet_family === "single" || b.bet_family === "srm"
    );
  }, [bets]);

  const combinedMultiOdds = useMemo(() => {
    if (singlesBets.length < 2) return 0;
    return singlesBets.reduce((acc, b) => {
      const o = b.odds && b.odds > 1 ? b.odds : 1.0;
      return acc * o;
    }, 1.0);
  }, [singlesBets]);

  const estMultiCollect = useMemo(() => {
    return (multiStake || 0) * combinedMultiOdds;
  }, [multiStake, combinedMultiOdds]);

  const weakestLegIndex = useMemo(() => {
    if (singlesBets.length < 2) return -1;
    if (
      multiEvaluation &&
      typeof (multiEvaluation as any).weakest_leg_index === "number" &&
      (multiEvaluation as any).weakest_leg_index >= 0
    ) {
      return (multiEvaluation as any).weakest_leg_index;
    }
    let worstIdx = 0;
    let minEdge = 9999;
    singlesBets.forEach((b, idx) => {
      const p = b.model_prob
        ? b.model_prob > 1
          ? b.model_prob / 100
          : b.model_prob
        : 1 / (b.odds || 1.9);
      const edge = (p * (b.odds || 1.9) - 1) * 100;
      if (edge < minEdge) {
        minEdge = edge;
        worstIdx = idx;
      }
    });
    return worstIdx;
  }, [singlesBets, multiEvaluation]);

  const roundRobinData = useMemo(() => {
    const legsCount = singlesBets.length;
    if (legsCount < 3) return null;

    const doubles = (legsCount * (legsCount - 1)) / 2;
    const trebles = (legsCount * (legsCount - 1) * (legsCount - 2)) / 6;
    const totalCombinations = doubles + trebles;
    const totalCost = (roundRobinUnitStake || 0) * totalCombinations;

    let estReturn = 0;
    for (let i = 0; i < legsCount; i++) {
      const legA = singlesBets[i];
      const oA = legA?.odds && legA.odds > 1 ? legA.odds : 1.0;
      for (let j = i + 1; j < legsCount; j++) {
        const legB = singlesBets[j];
        const oB = legB?.odds && legB.odds > 1 ? legB.odds : 1.0;
        estReturn += (roundRobinUnitStake || 0) * oA * oB;
      }
    }
    for (let i = 0; i < legsCount; i++) {
      const legA = singlesBets[i];
      const oA = legA?.odds && legA.odds > 1 ? legA.odds : 1.0;
      for (let j = i + 1; j < legsCount; j++) {
        const legB = singlesBets[j];
        const oB = legB?.odds && legB.odds > 1 ? legB.odds : 1.0;
        for (let k = j + 1; k < legsCount; k++) {
          const legC = singlesBets[k];
          const oC = legC?.odds && legC.odds > 1 ? legC.odds : 1.0;
          estReturn += (roundRobinUnitStake || 0) * oA * oB * oC;
        }
      }
    }

    return {
      doubles,
      trebles,
      totalCombinations,
      totalCost,
      estReturn: Math.round(estReturn * 100) / 100,
    };
  }, [singlesBets, roundRobinUnitStake]);

  const tabBets = bets.filter((bet) => {
    if (
      activeTab === "singles" ||
      activeTab === "multi" ||
      activeTab === "round_robin"
    )
      return (
        !bet.bet_family ||
        bet.bet_family === "single" ||
        bet.bet_family === "srm"
      );
    if (activeTab === "exotics") return bet.bet_family === "exotic";
    if (activeTab === "quaddie") return bet.bet_family === "quaddie";
    return bet.bet_family === "sgm";
  });

  const exoticCombinationCount = (items: typeof bets) => {
    const runnerCount = new Set(
      items.map((bet) => bet.selection_id ?? bet.selection),
    ).size;
    const type = items[0]?.exotic_bet_type;
    if (type === "QUINELLA")
      return runnerCount >= 2 ? (runnerCount * (runnerCount - 1)) / 2 : 0;
    if (type === "EXACTA")
      return runnerCount >= 2 ? runnerCount * (runnerCount - 1) : 0;
    if (type === "TRIFECTA")
      return runnerCount >= 3
        ? runnerCount * (runnerCount - 1) * (runnerCount - 2)
        : 0;
    if (type === "FIRST4")
      return runnerCount >= 4
        ? runnerCount *
            (runnerCount - 1) *
            (runnerCount - 2) *
            (runnerCount - 3)
        : 0;
    return 0;
  };

  const totalStake = bets.reduce((sum, b) => {
    const isEachWay = b.bet_type === "each_way";
    return sum + (isEachWay ? (b.stake || 0) * 2 : b.stake || 0);
  }, 0);
  const hasEachWayBet = bets.some((b) => b.bet_type === "each_way");
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
    }, 500);
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

  if (!isBetslipOpen) return null;

  return (
    <>
      <div
        className="betslip-overlay-backdrop fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[100] transition-opacity animate-in fade-in duration-200 flex justify-end items-end sm:items-stretch"
        onClick={() => setIsBetslipOpen(false)}
      >
        <div
          className="betslip-container fixed sm:top-0 sm:right-0 bottom-0 left-0 sm:left-auto w-full sm:w-[450px] max-h-[92vh] sm:max-h-full h-[92vh] sm:h-full z-[101] shadow-2xl flex flex-col overflow-hidden bg-slate-950 border-t sm:border-t-0 sm:border-l border-slate-700/80 rounded-t-2xl sm:rounded-t-none transition-transform animate-in slide-in-from-bottom sm:slide-in-from-right duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Drag Indicator Bar (Item 39) */}
          <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto my-2 sm:hidden shrink-0 cursor-grab" />

          {/* Sportsbet Style Header Bar */}
          <div className="betslip-header-bar flex items-center justify-between px-3.5 py-2.5 bg-slate-900 border-b border-slate-800 text-slate-100 shadow-md shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setIsBetslipOpen(false)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Close Bet Slip"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-1.5 min-w-0">
                <Ticket size={16} className="text-emerald-400 shrink-0" />
                {isEditingSlipName ? (
                  <input
                    type="text"
                    value={slipName}
                    onChange={(e) => setSlipName(e.target.value)}
                    onBlur={() => setIsEditingSlipName(false)}
                    onKeyDown={(e) => e.key === "Enter" && setIsEditingSlipName(false)}
                    autoFocus
                    className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-bold text-slate-100 max-w-[140px]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingSlipName(true)}
                    className="font-extrabold text-sm tracking-tight text-slate-100 truncate flex items-center gap-1 hover:text-emerald-400 transition-colors cursor-pointer text-left"
                    title="Click to rename multi"
                  >
                    <span className="truncate">{slipName || "Bet Slip"}</span>
                    <Edit2 size={10} className="text-slate-500 opacity-60" />
                  </button>
                )}
              </div>
            </div>

            {/* Header Right Actions: Share Slip Button (Item 49) + Balance */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                title="Save & Share Slip"
              >
                <Share2 size={12} />
                <span className="hidden xs:inline">Share</span>
              </button>

              {/* Main Tabs */}
              <div className="flex items-center gap-0.5 p-0.5 bg-slate-950/80 rounded-xl border border-slate-700/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setContextMainTab("slip")}
                  className={`px-2 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                    contextMainTab === "slip"
                      ? "bg-slate-800 text-amber-400 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>Slip</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-900">
                    {bets.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setContextMainTab("active")}
                  className={`px-2 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                    contextMainTab === "active" || contextMainTab === "settled"
                      ? "bg-slate-800 text-sky-400 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>My Bets</span>
                  {combinedActiveBets.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-sky-500/20 text-sky-300">
                      {combinedActiveBets.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Balance */}
              <div className="flex flex-col items-end px-2 py-0.5 rounded-lg bg-slate-950 text-slate-100 shrink-0 border border-slate-800">
                <span className="text-[8px] uppercase font-black tracking-wider text-slate-400">Balance</span>
                <span className="text-xs font-black font-mono text-emerald-400">
                  ${user?.currentBankroll !== undefined ? user.currentBankroll.toLocaleString() : "10,000"}
                </span>
              </div>
            </div>
          </div>

        {/* MY BETS SECTION (Active & Settled Sub-Tabs) */}
        {contextMainTab === "active" || contextMainTab === "settled" ? (
          <div className="betslip-content flex-1 flex flex-col min-h-[300px] overflow-hidden bg-slate-950/90">
            {/* Sub-Tab Bar: Pending vs Resulted */}
            <div className="flex items-center gap-2 p-2 bg-slate-900/80 border-b border-slate-800/80">
              <button
                type="button"
                onClick={() => setMyBetsSubTab("active")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all text-center ${
                  myBetsSubTab === "active"
                    ? "bg-slate-800 text-slate-100 border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Pending ({unsettledBets.length})
              </button>
              <button
                type="button"
                onClick={() => setMyBetsSubTab("settled")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all text-center ${
                  myBetsSubTab === "settled"
                    ? "bg-slate-800 text-slate-100 border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Resulted ({settledBets.length})
              </button>
            </div>

            {/* Settle / Management Toolbar */}
            {myBetsSubTab === "active" && unsettledBets.length > 0 && (
              <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">
                  {unsettledBets.length} active paper bet{unsettledBets.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    settleAllCompletedBets();
                    addToast("Settled past paper bets!", "success");
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                >
                  <Sparkles size={13} className="text-emerald-400" />
                  <span>Settle All Completed</span>
                </button>
              </div>
            )}

            {myBetsSubTab === "settled" && settledBets.length > 0 && (
              <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">
                  {settledBets.length} resulted bet{settledBets.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearResultedBets();
                    addToast("Resulted bets cleared", "info");
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  <Trash2 size={13} className="text-slate-400" />
                  <span>Clear History</span>
                </button>
              </div>
            )}

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {myBetsSubTab === "active" ? (
                unsettledBets.length === 0 ? (
                  <div className="py-10 text-center px-4">
                    <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Receipt size={28} />
                    </div>
                    <p className="font-extrabold text-slate-200 text-sm">No Pending Bets</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Logged paper bets awaiting event results will appear here with live tracking.
                    </p>
                  </div>
                ) : (
                  unsettledBets.map((bet) => (
                    <div
                      key={bet.id}
                      className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                            {bet.sport} • {bet.bet_type}
                          </span>
                          <h4 className="text-xs font-black text-slate-100 mt-1">
                            {bet.selection} <span className="text-slate-400 font-normal">@ ${Number(bet.odds).toFixed(2)}</span>
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">{bet.event_name}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Pending
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <span className="text-slate-400">Stake: <strong className="text-slate-200">${bet.stake}</strong></span>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px]">Potential Winnings</span>
                          <strong className="text-emerald-400 font-extrabold text-sm">
                            ${((bet.payout ?? (bet.stake * bet.odds))).toFixed(2)}
                          </strong>
                        </div>
                      </div>

                      {/* Sportsbet Cash Out Simulation Button */}
                      <button
                        type="button"
                        onClick={() => {
                          addToast(`Simulated Cash Out triggered for ${bet.selection}!`, "success");
                        }}
                        className="w-full py-2 px-3 rounded-lg bg-slate-950 hover:bg-slate-850 border border-slate-700/80 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                      >
                        <RotateCw size={14} className="text-amber-400" />
                        <span>Cash Out @ ${((bet.stake * (bet.odds * 0.95))).toFixed(2)}</span>
                      </button>
                    </div>
                  ))
                )
              ) : (
                settledBets.length === 0 ? (
                  <div className="py-10 text-center px-4">
                    <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <History size={28} />
                    </div>
                    <p className="font-extrabold text-slate-200 text-sm">No Resulted Bets</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Settled paper bets will appear here with final profit and loss statistics.
                    </p>
                  </div>
                ) : (
                  settledBets.map((bet) => (
                    <div
                      key={bet.id}
                      className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[10px] font-black px-1.5 py-0.2 rounded uppercase ${bet.status === "won" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-slate-800 text-slate-400"}`}>
                            {bet.status}
                          </span>
                          <span className="text-[11px] text-slate-400">{bet.sport}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-100">{bet.selection}</h4>
                        <p className="text-[11px] text-slate-400">{bet.event_name}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-200">${bet.stake} @ ${bet.odds.toFixed(2)}</div>
                        <div className={`text-xs font-black mt-1 ${bet.status === "won" ? "text-emerald-400" : "text-slate-400"}`}>
                          {bet.status === "won" ? `+$${(bet.stake * bet.odds).toFixed(2)}` : "$0.00"}
                        </div>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        ) : (
          <div className="betslip-content flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto">
        {result ? (
          <div className="betslip-result">
            <CheckCircle2
              size={48}
              className={result.failed === 0 ? "text-green" : "text-yellow"}
            />
            <h3>{result.failed === 0 ? "Bets Logged!" : "Partial Success"}</h3>
            <p>{result.success} bets recorded successfully.</p>
          </div>
        ) : bets.length === 0 ? (
          <div className="betslip-empty py-8 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mx-auto mb-3 text-amber-400 shadow-inner">
              <Receipt size={32} />
            </div>
            <p className="font-extrabold text-slate-100 text-base">Your Bet Slip is Empty</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
              Select predictions across racing or sports matches to track picks in your paper slip.
            </p>
          </div>
        ) : (
          <>
            <div className="betslip-status-stack">
              {blockingIssues.length > 0 ? (
                <div className="betslip-banner danger flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>
                      {blockingIssues.length} selection
                      {blockingIssues.length === 1 ? "" : "s"} expired or invalid.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const expiredIds = bets
                        .filter(
                          (b) =>
                            hasEventStarted({
                              eventStartTime: b.event_start_time,
                              eventDate: b.event_date,
                              isClosed: b.is_closed,
                            }) || b.is_unavailable,
                        )
                        .map((b) => b.id);
                      if (expiredIds.length > 0) {
                        expiredIds.forEach((id) => removeBet(id));
                        addToast(`Cleared ${expiredIds.length} expired pick(s)`, "info");
                      } else {
                        clearBetslip();
                        addToast("Cleared invalid selections", "info");
                      }
                    }}
                    className="px-2 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 text-[11px] font-bold rounded shrink-0 transition-colors cursor-pointer"
                  >
                    Clear Expired
                  </button>
                </div>
              ) : null}

              {reviewIssues.length > 0 ? (
                <label
                  className="betslip-banner warning"
                  htmlFor="ack-odds-changes"
                >
                  <input
                    id="ack-odds-changes"
                    type="checkbox"
                    checked={acknowledgeOddsChanges}
                    onChange={(event) =>
                      setAcknowledgeOddsChanges(event.target.checked)
                    }
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
                  Live stale-odds checks only work where this tab has a fresh
                  frontend price snapshot. Racing can compare live Betfair
                  prices; AFL and NBA stay model-led for now.
                </span>
              </div>
            </div>

            {/* Slip Mode Toggle (Item 44) */}
            <div className="px-3 pt-2">
              <SlipModeToggle
                activeMode={activeTab as any}
                onModeChange={(mode) => setActiveTab(mode as any)}
                counts={{
                  singles: singlesBets.length,
                  multi: singlesBets.length >= 2 ? singlesBets.length : 0,
                  sgm: bets.filter((b) => b.bet_family === "sgm").length,
                  round_robin: singlesBets.length >= 3 ? singlesBets.length : 0,
                }}
              />
            </div>

            {/* Dedicated Multi Accumulator View (Item 40, 41, 42, 43, 46, 47, 48, 52) */}
            {activeTab === "multi" && (
              singlesBets.length < 2 ? (
                <div className="betslip-empty p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-2 text-emerald-400">
                    <Sparkles size={20} />
                  </div>
                  <p className="font-bold text-slate-200 text-sm">Multi Accumulator</p>
                  <p className="small text-slate-400 mt-1">
                    Add 2 or more selections from different races or sports to automatically build a Multi accumulator!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 p-3">
                  {/* Live Multi Maths (Item 40, 48) */}
                  <MultiLiveMaths
                    legs={singlesBets}
                    totalStake={multiStake > 0 ? multiStake : defaultStake}
                    sport={singlesBets[0]?.sport || "sport"}
                    onEvaluationResult={(res) => setMultiEvaluation(res)}
                  />

                  {/* Inline Correlation Warnings & Boosts (Item 41) */}
                  <CorrelationWarningBanner
                    warnings={multiEvaluation?.pairwise_warnings || multiEvaluation?.warnings || []}
                    correlationScore={multiEvaluation?.correlation_score}
                    correlationSummary={multiEvaluation?.correlation_summary}
                  />

                  <div className="bg-slate-950 border border-slate-700/80 rounded-xl shadow-md overflow-hidden">
                    <div className="bg-slate-900/90 p-3 border-b border-slate-800 flex justify-between items-center">
                      <div className="font-extrabold text-slate-100 flex items-center gap-1.5 text-sm">
                        <Layers size={15} className="text-emerald-400" />
                        <span>{singlesBets.length}-Leg Multi Accumulator</span>
                      </div>
                      <div className="text-[17.5px] font-black text-fuchsia-300 font-mono">
                        ${combinedMultiOdds.toFixed(2)}
                      </div>
                    </div>

                    {/* Multi Legs List */}
                    <div className="divide-y divide-slate-800/60 p-1">
                      {singlesBets.map((leg, index) => {
                        const legWinOdds = leg.odds && leg.odds > 1 ? leg.odds : 1.0;
                        const isWeakest = index === weakestLegIndex;

                        return (
                          <div
                            key={leg.id}
                            className={`p-3 rounded-lg transition-colors ${
                              isWeakest ? "bg-rose-950/20 border border-rose-900/30" : "hover:bg-slate-900/40"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start space-x-2.5 flex-1 min-w-0">
                                <div className="w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-colors bg-emerald-500 border-emerald-500 text-white mt-0.5">
                                  <Check size={13} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[14px] font-bold text-slate-100 truncate">
                                      {leg.selection}
                                    </span>
                                    {/* Best Price Badge (Item 52) */}
                                    <BestPriceBadge
                                      currentOdds={legWinOdds}
                                      selection={leg.selection}
                                      bookiePrices={leg.bookie_prices}
                                      source={leg.odds_source}
                                    />
                                  </div>
                                  <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                                    <span className="truncate">{leg.event_name}</span>
                                    <span>•</span>
                                    <span className="text-emerald-400 font-medium capitalize">
                                      {leg.bet_type === "place" ? "Place" : leg.bet_type === "each_way" ? "E/W" : "Win"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="text-base font-black font-mono text-fuchsia-200">
                                  ${legWinOdds.toFixed(2)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeBet(leg.id)}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title="Remove leg"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Weakest Leg Highlight & 1-Tap Swap (Item 42) */}
                            {isWeakest && (
                              <WeakestLegBanner
                                isWeakest={true}
                                reason={
                                  multiEvaluation?.weakest_leg?.rationale ||
                                  (multiEvaluation as any)?.reason ||
                                  "Lowest relative EV in multi"
                                }
                                severity={(multiEvaluation as any)?.severity || "warning"}
                                legId={leg.id}
                                legSelection={leg.selection}
                                allLegs={singlesBets}
                                sport={leg.sport}
                                onApplySwap={(oldId, repl) => swapLeg(oldId, repl)}
                              />
                            )}

                            {/* "Why This Leg" Panel (Item 43) */}
                            <WhyThisLegDrawer
                              isOpen={Boolean(expandedInsights[leg.id])}
                              onToggle={() => toggleInsight(leg.id)}
                              selection={leg.selection}
                              eventName={leg.event_name}
                              odds={legWinOdds}
                              modelFairOdds={leg.model_fair_odds}
                              modelProb={leg.model_prob}
                              edgePct={leg.model_edge_pct}
                              confidence={leg.confidence}
                              rationale={leg.notes || leg.rationale}
                              recentForm={leg.recent_form}
                              sport={leg.sport}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Kelly Stake Suggestion & Safer/Bigger Odds Slider (Item 46, 47) */}
                    <div className="p-3 border-t border-slate-800 bg-slate-900/60">
                      <KellyStakeControl
                        combinedOdds={combinedMultiOdds}
                        trueProb={
                          multiEvaluation?.adjusted_probability ||
                          multiEvaluation?.fair_probability ||
                          (combinedMultiOdds > 0 ? 1 / combinedMultiOdds : 0.2)
                        }
                        bankroll={user?.currentBankroll || 10000}
                        currentStake={multiStake}
                        onApplyStake={(val) => setMultiStake(val)}
                      />
                    </div>

                    {/* Multi Stake Input */}
                    <div className="px-3.5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-400 uppercase">Multi Stake</span>
                        <div className="flex gap-1">
                          {[5, 10, 25, 50].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setMultiStake(preset)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                            >
                              ${preset}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="relative w-24">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                        <input
                          type="number"
                          value={multiStake === 0 ? "" : multiStake}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const cleanNum = raw === "" ? 0 : Math.max(0, Number(raw.replace(/^0+/, "") || 0));
                            setMultiStake(cleanNum);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 pl-6 pr-3 text-white text-sm font-bold text-right focus:border-emerald-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Multi Est. Return */}
                    <div className="px-3.5 py-2.5 bg-slate-900 rounded-b-lg border-t border-slate-800 text-right">
                      <span className="text-xs text-slate-300 font-medium">
                        Total Return: <strong className="text-emerald-400 font-mono text-sm">${estMultiCollect.toFixed(2)}</strong> | Cost: <strong className="text-slate-200 font-mono">${(multiStake).toFixed(2)}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* Round-Robin Combinations View (Item 44) */}
            {activeTab === "round_robin" && (
              singlesBets.length < 3 ? (
                <div className="betslip-empty p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-2 text-indigo-400">
                    <Grid3X3 size={20} />
                  </div>
                  <p className="font-bold text-slate-200 text-sm">Round-Robin Combinations</p>
                  <p className="small text-slate-400 mt-1">
                    Add 3 or more selections to build boxed doubles and trebles system tickets!
                  </p>
                </div>
              ) : roundRobinData && (
                <div className="p-3 space-y-3">
                  <div className="bg-slate-950 border border-slate-700 rounded-xl shadow-sm p-3.5 space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                      <div>
                        <div className="font-extrabold text-slate-100 text-sm">
                          Round-Robin ({singlesBets.length} Selections)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Boxed doubles and trebles system bets
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-mono font-bold">
                        {roundRobinData.totalCombinations} Combinations
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">2-Leg Doubles</span>
                        <span className="font-mono font-bold text-slate-200">{roundRobinData.doubles} bets</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">3-Leg Trebles</span>
                        <span className="font-mono font-bold text-slate-200">{roundRobinData.trebles} bets</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-bold text-slate-400">Stake Per Combination</span>
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          value={roundRobinUnitStake === 0 ? "" : roundRobinUnitStake}
                          onChange={(e) => setRoundRobinUnitStake(Number(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded py-1 pl-6 pr-2 text-right text-xs font-bold text-white focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Total Outlay</span>
                        <strong className="text-slate-100 font-mono text-sm">${roundRobinData.totalCost.toFixed(2)}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Max Potential Return</span>
                        <strong className="text-emerald-400 font-mono text-sm">${roundRobinData.estReturn.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

            {(activeTab === "exotics" || activeTab === "quaddie") &&
            tabBets.length === 0 ? (
              <AwaitingExoticPool />
            ) : null}

            {activeTab === "exotics" && tabBets.length > 0 ? (
              <div className="betslip-exotic-summary">
                <span>
                  {tabBets[0]?.exotic_bet_type ?? "EXOTIC"} boxed selections
                </span>
                <strong>{exoticCombinationCount(tabBets)} combinations</strong>
                <span>
                  Flexi % updates from stake / combinations when logged.
                </span>
              </div>
            ) : null}

            {activeTab === "sgm" && tabBets.length === 0 ? (
              <div className="betslip-empty">
                <p>Awaiting same-game markets.</p>
                <p className="small">
                  Add live-priced legs from one match to calculate an SGM.
                </p>
              </div>
            ) : null}

            {activeTab === "singles" && (
              <div className="betslip-list">
                {warnings
                  .filter(({ bet }) =>
                    tabBets.some((tabBet) => tabBet.id === bet.id),
                  )
                  .map(({ bet, issues }) => {
                    const key = buildPaperBetKey({
                      sport: bet.sport,
                      eventId: bet.event_id,
                      selection: bet.selection,
                      betType: bet.bet_type,
                    });
                    const snapshot = selectionSnapshots[key];
                    const latestOdds = snapshot?.current_odds;
                    const isRacing = (bet.sport || "").toLowerCase() === "racing";
                    const isEachWay = bet.bet_type === "each_way";
                    const unitStake = bet.stake || 0;
                    const totalItemStake = isEachWay ? unitStake * 2 : unitStake;
                    const winOdds = bet.odds && bet.odds > 1 ? bet.odds : 1.0;
                    const placeOdds = Number((1 + (winOdds - 1) * 0.25).toFixed(2));

                    if (bet.bet_type === "multi") {
                      const legs = bet.selection.split(" + ");
                      return (
                        <div key={bet.id} className="p-0 mb-3 bg-slate-950 border border-slate-700 rounded-lg shadow-sm overflow-hidden">
                          <div className="flex justify-between items-center p-3 bg-slate-800 border-b border-slate-700">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold">M</span>
                              <div className="font-bold text-slate-100 text-sm">Same Race Multi <span className="text-slate-400 font-normal ml-1">{legs.length} Legs</span></div>
                            </div>
                            <button className="text-slate-500 hover:text-slate-300 transition-colors" onClick={() => removeBet(bet.id)}><X size={16} /></button>
                          </div>
                          <div className="divide-y divide-slate-800/50 bg-slate-950">
                            {legs.map((leg, i) => (
                              <div key={i} className="px-3 py-2 flex items-start gap-2">
                                <div className="w-3 h-3 bg-yellow-400/80 rounded-sm mt-1 shrink-0 border border-slate-600"></div>
                                <div>
                                  <div className="text-xs font-bold text-slate-200">{leg}</div>
                                  <div className="text-[10px] text-slate-500">Top 4</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between bg-slate-900 px-3.5 py-2.5 rounded-b-lg border-t border-slate-800">
                            <div className="text-lg font-black font-mono text-fuchsia-200 px-1">{winOdds.toFixed(2)}</div>
                            <div className="flex items-center space-x-2">
                              <span className="text-[13px] font-bold text-slate-400 uppercase">Stake</span>
                              <div className="relative w-24">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                                <input
                                  type="number"
                                  value={bet.stake === 0 ? "" : bet.stake}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const cleanNum = raw === "" ? 0 : Math.max(0, Number(raw.replace(/^0+/, "") || 0));
                                    updateBet(bet.id, { stake: cleanNum });
                                  }}
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 pl-6 pr-3 text-white text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-right"
                                  placeholder="0"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={bet.id} className="p-3.5 mb-3 bg-slate-950 border border-slate-800/90 rounded-xl shadow-sm">
                        <div className="flex justify-between items-start gap-2 mb-3">
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="text-[13px] text-slate-400 font-medium mb-1 truncate">{bet.event_name}</div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-100 text-[17px] leading-tight break-words">{bet.selection}</span>
                              <BestPriceBadge
                                currentOdds={winOdds}
                                selection={bet.selection}
                                bookiePrices={bet.bookie_prices}
                                source={bet.odds_source}
                              />
                            </div>
                          </div>
                          <button
                            className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeBet(bet.id);
                            }}
                          >
                            <X size={18} />
                          </button>
                        </div>

                        <div className="flex flex-col space-y-3">
                          {isRacing && (
                            <div className="flex space-x-2">
                              {["win", "place", "each_way"].map((t) => {
                                const isActive = bet.bet_type === t;
                                let activeClass = "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50";
                                if (t === "place") activeClass = "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50";
                                if (t === "each_way") activeClass = "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50";

                                return (
                                  <button 
                                    key={t}
                                    onClick={() => updateBet(bet.id, { bet_type: t as any })}
                                    className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-colors ${
                                      isActive 
                                        ? activeClass 
                                        : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                                    }`}
                                  >
                                    {t === "each_way" ? "E/W" : t.toUpperCase()}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between bg-slate-900/90 px-3 py-2.5 rounded-lg border border-slate-800/90">
                             <div className="text-lg font-black font-mono text-fuchsia-200 px-1">
                                {bet.bet_type === 'place' ? placeOdds.toFixed(2) : winOdds.toFixed(2)}
                             </div>
                             <div className="flex items-center space-x-2">
                                <span className="text-[13px] font-bold text-slate-400 uppercase">
                                  {isEachWay ? "Unit Stake" : "Stake"}
                                </span>
                                <div className="relative w-24">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                                  <input
                                    type="number"
                                    value={bet.stake === 0 ? "" : bet.stake}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const cleanNum = raw === "" ? 0 : Math.max(0, Number(raw.replace(/^0+/, "") || 0));
                                      updateBet(bet.id, { stake: cleanNum });
                                    }}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 pl-6 pr-3 text-white text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-right"
                                    placeholder="0"
                                  />
                                </div>
                             </div>
                          </div>
                          
                          {isEachWay && (
                            <div className="text-xs text-right text-slate-300 font-medium px-2 pt-0.5">
                              Total Return: <strong className="text-emerald-400 font-mono">${(unitStake * winOdds + unitStake * placeOdds).toFixed(2)}</strong> | Cost: <strong className="text-slate-200 font-mono">${(totalItemStake).toFixed(2)}</strong>
                            </div>
                          )}

                          {issues.length > 0 ? (
                            <div className="betslip-issues mt-2">
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

                          {/* "Why This Leg" Panel (Item 43) */}
                          <WhyThisLegDrawer
                            isOpen={Boolean(expandedInsights[bet.id])}
                            onToggle={() => toggleInsight(bet.id)}
                            selection={bet.selection}
                            eventName={bet.event_name}
                            odds={winOdds}
                            modelFairOdds={bet.model_fair_odds}
                            modelProb={bet.model_prob}
                            edgePct={bet.model_edge_pct}
                            confidence={bet.confidence}
                            rationale={bet.notes || bet.rationale}
                            recentForm={bet.recent_form}
                            sport={bet.sport}
                          />
                        </div>
                      </div>
                    );
                  })}

                {/* Auto-Multi Banner in Singles Tab */}
                {singlesBets.length >= 2 && (
                  <div className="my-3 p-3 bg-gradient-to-r from-emerald-950/70 via-slate-950 to-slate-950 border border-emerald-500/40 rounded-xl flex items-center justify-between shadow-md">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <Zap size={14} />
                        <span>{singlesBets.length}-Leg Auto Multi Ready</span>
                      </div>
                      <span className="text-[11px] text-slate-300 block font-mono mt-0.5">
                        Combined @ ${combinedMultiOdds.toFixed(2)} | Est. Return: ${estMultiCollect.toFixed(2)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("multi")}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-xs px-3 py-1.5 rounded-lg transition-all shadow-sm shrink-0"
                    >
                      View Multi →
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="betslip-footer">
              <div className="betslip-summary">
                <div className="summary-row">
                  <span>Total Bets</span>
                  <span>{bets.length}</span>
                </div>
                <div className="summary-row total">
                  <span>Total Stake</span>
                  <div className="text-right">
                    <strong>${totalStake.toFixed(2)}</strong>
                    {hasEachWayBet && (
                      <span className="block text-[10px] text-purple-300 font-normal">
                        (includes 2 units for E/W picks)
                      </span>
                    )}
                  </div>
                </div>
                <div className="summary-row total-collect flex items-center justify-between pt-2 mt-1 border-t border-emerald-500/30 text-emerald-400 font-bold">
                  <span>Est. Total Collect</span>
                  <strong className="text-base text-emerald-400">
                    $
                    {bets
                      .reduce((sum, b) => {
                        const isEW = b.bet_type === "each_way";
                        const uStake = b.stake || 0;
                        const odds = b.odds || 1;
                        const est = isEW
                          ? uStake * odds + uStake * (1 + (odds - 1) * 0.25)
                          : uStake * odds;
                        return sum + est;
                      }, 0)
                      .toFixed(2)}
                  </strong>
                </div>
                <div className="summary-row default-stake-row">
                  <span style={{ fontSize: "0.8rem" }}>Default Stake</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <div className="footer-stake-input-wrap">
                      <span>$</span>
                      <input
                        type="number"
                        value={defaultStake === 0 ? "" : defaultStake}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const cleanNum =
                            raw === ""
                              ? 0
                              : Math.max(
                                  0,
                                  Number(raw.replace(/^0+/, "") || 0),
                                );
                          setDefaultStake(cleanNum);
                        }}
                        className="footer-stake-input"
                        title="Default stake applied to new picks"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        bets.forEach((b) =>
                          updateBet(b.id, { stake: defaultStake }),
                        );
                        addToast(
                          `Applied stake of $${defaultStake} to all bets`,
                          "success",
                        );
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
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setShowShareModal(true)}
                  title="Share or export paper slip"
                >
                  <Share2 size={14} /> Share
                </button>
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
                  {placing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
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
      </div>
    )}

    {/* Sportsbet Responsible Gambling Footer Notice */}
    <div className="mt-auto border-t border-slate-800/80 p-3 bg-slate-900 text-center">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5">
        <p className="text-[11px] font-black uppercase text-amber-400 tracking-wide">
          WHAT'S GAMBLING REALLY COSTING YOU?
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
          For free and confidential support call <span className="text-slate-200 font-bold">1800 858 858</span> or visit{" "}
          <span className="text-amber-400/90 underline font-medium">gamblinghelponline.org.au</span>
        </p>
      </div>
    </div>
  </div>
</div>

      <style jsx global>{`
        .betslip-tabs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.35rem;
          margin-bottom: 0.75rem;
        }
        .betslip-tab {
          border: 1px solid var(--border);
          background: rgba(15, 23, 42, 0.85);
          color: var(--text-secondary);
          border-radius: 0.6rem;
          padding: 0.4rem 0.25rem;
          font-size: 0.72rem;
          font-weight: 800;
        }
        .betslip-tab.active {
          border-color: rgba(16, 185, 129, 0.6);
          color: rgb(110, 231, 183);
          background: rgba(6, 78, 59, 0.35);
        }
        .betslip-exotic-summary {
          display: grid;
          gap: 0.25rem;
          padding: 0.65rem;
          border: 1px solid rgba(245, 158, 11, 0.35);
          border-radius: 0.75rem;
          background: rgba(120, 53, 15, 0.22);
          color: rgb(253, 230, 138);
          font-size: 0.75rem;
          margin-bottom: 0.75rem;
        }
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
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
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
          transition: opacity 0.3s ease;
          opacity: 1;
          overflow: hidden;
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
          padding: 1.15rem 1.15rem 1rem;
          background: var(--bg-secondary);
        }

        .betslip-summary {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          margin-bottom: 0.95rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          color: var(--text-muted);
          font-size: 0.82rem;
          padding: 0.15rem 0;
        }

        .summary-row.total {
          color: var(--text-primary);
          font-size: 0.92rem;
          font-weight: 700;
        }

        .default-stake-row {
          padding-top: 0.65rem;
          margin-top: 0.65rem;
          border-top: 1px dashed var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .footer-stake-input-wrap {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 0.25rem 0.5rem;
        }

        .footer-stake-input-wrap span {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .footer-stake-input {
          width: 58px;
          border: none;
          background: transparent;
          color: var(--text-primary);
          outline: none;
          font-size: 0.82rem;
          font-weight: 700;
        }

        .apply-all-btn {
          font-size: 0.72rem;
          padding: 0.3rem 0.6rem;
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
          .betslip-tabs {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 0.35rem;
            margin-bottom: 0.75rem;
          }
          .betslip-tab {
            border: 1px solid var(--border);
            background: rgba(15, 23, 42, 0.85);
            color: var(--text-secondary);
            border-radius: 0.6rem;
            padding: 0.4rem 0.25rem;
            font-size: 0.72rem;
            font-weight: 800;
          }
          .betslip-tab.active {
            border-color: rgba(16, 185, 129, 0.6);
            color: rgb(110, 231, 183);
            background: rgba(6, 78, 59, 0.35);
          }
          .betslip-exotic-summary {
            display: grid;
            gap: 0.25rem;
            padding: 0.65rem;
            border: 1px solid rgba(245, 158, 11, 0.35);
            border-radius: 0.75rem;
            background: rgba(120, 53, 15, 0.22);
            color: rgb(253, 230, 138);
            font-size: 0.75rem;
            margin-bottom: 0.75rem;
          }
          .betslip-container {
            left: auto;
            right: 1rem;
            bottom: 4.5rem;
            width: min(340px, calc(100vw - 2rem));
            max-height: calc(100vh - 90px);
          }
        }
      `}</style>
      <GuestModal
        open={showGuestModal}
        onClose={() => setShowGuestModal(false)}
      />
      {/* Share Slip Modal (Item 49) */}
      <ShareSlipModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        bets={bets}
        slipName={slipName}
        onUpdateSlipName={setSlipName}
        onSaveSlip={saveCurrentSlip}
        onCloneSlip={cloneSlip}
      />
    </>
  );
}

export default function PaperBetslip() {
  return (
    <Suspense fallback={null}>
      <PaperBetslipContent />
    </Suspense>
  );
}
