"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { TrendingUp, TrendingDown, Flame, History, ArrowUpRight, ArrowDownRight } from "lucide-react";
import PaperBetAction from "../PaperBetAction";

export type MoverDirection = "shortening" | "lengthening" | "steady";

export interface FlucPoint {
  timestamp?: number;
  odds: number;
}

/**
 * Standard Australian racing dividend formula for place odds:
 * If explicit place price is present, use it. Otherwise, place odds = 1 + (Win - 1) * 0.25 (minimum $1.04).
 */
export function calculatePlaceOdds(winOdds: number, explicitPlaceOdds?: number): number {
  if (typeof explicitPlaceOdds === "number" && explicitPlaceOdds > 1) {
    return Number(explicitPlaceOdds.toFixed(2));
  }
  if (!winOdds || winOdds <= 1) return 1.04;
  const derived = 1 + (winOdds - 1) * 0.25;
  return Number(Math.max(1.04, derived).toFixed(2));
}

export interface LiveOddsButtonProps {
  /** Current odds value (Win odds) */
  odds: number;
  /** Optional explicit place odds value */
  placeOdds?: number;
  /** Opening odds or previous odds value for change calculation */
  openingOdds?: number;
  previousOdds?: number;
  /** Array of numerical flucs or FlucPoint objects */
  flucHistory?: (number | FlucPoint)[];
  /** Pre-formatted fluc history string (e.g. "$4.50 -> $3.80 -> $3.20") */
  historyString?: string;
  /** Custom label instead of formatted odds */
  label?: string;
  /** Optional runner name */
  runnerName?: string;
  /** Optional selection or runner ID */
  selectionId?: string;
  /** Optional race ID */
  raceId?: string;
  /** Button visual style variant */
  variant?: "default" | "compact" | "badge" | "outline";
  /** Flash duration in ms (default 1500ms) */
  flashDuration?: number;
  /** Render side-by-side Place odds button alongside Win odds button */
  showPlaceButton?: boolean;
  /** Paper bet payload for instant betting action */
  bet?: {
    sport: string;
    event_id: string;
    event_name: string;
    selection_id: string;
    selection: string;
    odds: number;
    place_odds?: number;
    bet_type?: string;
    stake?: number;
    odds_source?: string;
    current_odds?: number;
    can_compare_odds?: boolean;
    event_start_time?: string;
    event_date?: string;
  };
  /** Callback triggered when button is clicked (if paper bet action not handling it) */
  onClick?: (odds: number, betType?: "win" | "place") => void;
  /** Custom additional CSS classes */
  className?: string;
}

export default function LiveOddsButton({
  odds,
  placeOdds,
  openingOdds,
  previousOdds,
  flucHistory = [],
  historyString,
  label,
  runnerName,
  selectionId,
  raceId,
  variant = "default",
  flashDuration = 1500,
  showPlaceButton = true,
  bet,
  onClick,
  className = "",
}: LiveOddsButtonProps) {
  const [flashState, setFlashState] = useState<MoverDirection | null>(null);
  const [showHistoryTooltip, setShowHistoryTooltip] = useState(false);
  const prevOddsRef = useRef<number>(odds);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate place odds using explicit value or standard dividend formula
  const computedPlaceOdds = useMemo(() => {
    return calculatePlaceOdds(odds, placeOdds ?? bet?.place_odds);
  }, [odds, placeOdds, bet?.place_odds]);

  // Monitor odds changes to trigger green (lengthening) or red (shortening) flashes
  useEffect(() => {
    const prevOdds = previousOdds ?? prevOddsRef.current;

    if (prevOdds && odds !== prevOdds) {
      if (odds < prevOdds) {
        // Red flash: Shortening odds / Market Move (e.g. $4.50 -> $3.80)
        setFlashState("shortening");
      } else if (odds > prevOdds) {
        // Green flash: Lengthening odds / Price Increase (e.g. $4.00 -> $4.50)
        setFlashState("lengthening");
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setFlashState(null);
      }, flashDuration);
    }

    prevOddsRef.current = odds;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [odds, previousOdds, flashDuration]);

  // Compute history string e.g. "$4.50 -> $3.80 -> $3.20"
  const formattedHistoryString = useMemo(() => {
    if (historyString) return historyString;

    if (flucHistory.length > 0) {
      const numbers = flucHistory.map((item) => (typeof item === "number" ? item : item.odds));
      return numbers.map((n) => `$${n.toFixed(2)}`).join(" -> ");
    }

    if (openingOdds && openingOdds !== odds) {
      return `$${openingOdds.toFixed(2)} -> $${odds.toFixed(2)}`;
    }

    return "";
  }, [historyString, flucHistory, openingOdds, odds]);

  // Compute percentage price move relative to opening or previous odds
  const priceMoveMetrics = useMemo(() => {
    const baseOdds = openingOdds || previousOdds;
    if (!baseOdds || baseOdds === odds) return null;

    const diff = odds - baseOdds;
    const percent = ((diff / baseOdds) * 100).toFixed(1);
    const direction: MoverDirection = diff < 0 ? "shortening" : "lengthening";

    return {
      diff: Number(diff.toFixed(2)),
      percent: Number(percent),
      direction,
      isMarketMover: diff < 0 && Math.abs(Number(percent)) >= 10,
    };
  }, [openingOdds, previousOdds, odds]);

  // Dynamic styling based on flash state and variant
  let flashClasses = "";
  if (flashState === "shortening") {
    // Red flash for market move / shortening odds
    flashClasses = "bg-rose-500/25 border-rose-500 text-rose-300 ring-2 ring-rose-500/60 shadow-lg shadow-rose-950/50 scale-[1.03] transition-all duration-300";
  } else if (flashState === "lengthening") {
    // Green flash for price increase / lengthening odds
    flashClasses = "bg-emerald-500/25 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/60 shadow-lg shadow-emerald-950/50 scale-[1.03] transition-all duration-300";
  } else {
    flashClasses = "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 transition-all";
  }

  const formattedWinLabel = label ? `WIN ${label}` : `WIN $${odds.toFixed(2)}`;
  const formattedPlaceLabel = `PLACE $${computedPlaceOdds.toFixed(2)}`;

  return (
    <div className={`relative inline-flex items-center gap-1.5 group ${className}`}>
      {/* If bet payload is provided, use PaperBetAction for click handling while keeping flash UI */}
      {bet ? (
        <div className="flex items-center gap-1.5">
          <PaperBetAction
            variant="odds-button"
            label={formattedWinLabel}
            loggedLabel="✓ WIN"
            cancelLabel="✕"
            openBetslipOnAdd={false}
            bet={{
              ...bet,
              bet_type: "win",
              stake: bet.stake ?? 10,
              odds: odds,
              current_odds: odds,
              odds_source: (bet.odds_source as any) || "market",
            }}
          />
          {showPlaceButton && (
            <PaperBetAction
              variant="odds-button"
              label={formattedPlaceLabel}
              loggedLabel="✓ PLACE"
              cancelLabel="✕"
              openBetslipOnAdd={false}
              bet={{
                ...bet,
                bet_type: "place",
                stake: bet.stake ?? 10,
                odds: computedPlaceOdds,
                current_odds: computedPlaceOdds,
                odds_source: (bet.odds_source as any) || "market",
              }}
            />
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onClick?.(odds, "win")}
            className={`px-3 py-1.5 rounded-md font-semibold text-sm border flex items-center gap-1.5 ${flashClasses}`}
          >
            <span>{formattedWinLabel}</span>

            {priceMoveMetrics?.direction === "shortening" && (
              <TrendingDown size={14} className="text-rose-400 animate-bounce-subtle" />
            )}
            {priceMoveMetrics?.direction === "lengthening" && (
              <TrendingUp size={14} className="text-emerald-400 animate-bounce-subtle" />
            )}
          </button>

          {showPlaceButton && (
            <button
              type="button"
              onClick={() => onClick?.(computedPlaceOdds, "place")}
              className="px-3 py-1.5 rounded-md font-semibold text-sm border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-emerald-300 flex items-center gap-1.5 transition-all"
            >
              <span>{formattedPlaceLabel}</span>
            </button>
          )}
        </div>
      )}

      {/* Market Mover flame icon badge if odds shortened significantly */}
      {priceMoveMetrics?.isMarketMover && (
        <span
          className="inline-flex items-center justify-center p-1 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-400 text-xs shadow-xs"
          title={`Market Mover: Shortened by ${Math.abs(priceMoveMetrics.percent)}%`}
        >
          <Flame size={12} className="animate-pulse text-rose-400" />
        </span>
      )}

      {/* Fluc History Toggle Button & Hover/Click Overlay Tooltip */}
      {formattedHistoryString && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowHistoryTooltip((prev) => !prev)}
            onMouseEnter={() => setShowHistoryTooltip(true)}
            onMouseLeave={() => setShowHistoryTooltip(false)}
            className="p-1 text-slate-400 hover:text-purple-300 rounded transition-colors focus:outline-hidden"
            title="View Price Fluc History"
          >
            <History size={13} />
          </button>

          {/* Floating Price Movement History Overlay Tooltip */}
          {showHistoryTooltip && (
            <div className="absolute right-0 bottom-full mb-2 z-30 w-max max-w-xs bg-slate-900 border border-slate-700/80 shadow-xl rounded-lg p-2.5 text-xs animate-fadeIn backdrop-blur-md">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5 text-slate-300 font-medium">
                <span className="flex items-center gap-1">
                  <History size={12} className="text-purple-400" /> Price Movement History
                </span>
                {priceMoveMetrics && (
                  <span
                    className={`font-semibold flex items-center gap-0.5 ${
                      priceMoveMetrics.direction === "shortening" ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {priceMoveMetrics.direction === "shortening" ? (
                      <ArrowDownRight size={12} />
                    ) : (
                      <ArrowUpRight size={12} />
                    )}
                    {priceMoveMetrics.percent > 0 ? `+${priceMoveMetrics.percent}%` : `${priceMoveMetrics.percent}%`}
                  </span>
                )}
              </div>

              <div className="font-mono text-purple-200 font-semibold tracking-tight text-[11px]">
                {formattedHistoryString}
              </div>

              {openingOdds && (
                <div className="text-[10px] text-slate-400 mt-1">
                  Opening: <span className="text-slate-200 font-medium">${openingOdds.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * Sort by Market Movers Header Control for Racecard Matrices
 * ============================================================================ */

export interface SortByMarketMoversControlProps {
  /** Active toggle state */
  isSortedByMovers: boolean;
  /** Callback to toggle market movers sorting */
  onToggle: () => void;
  /** Count of runners identified as market movers */
  moverCount?: number;
  /** Custom container styling */
  className?: string;
}

export function SortByMarketMoversControl({
  isSortedByMovers,
  onToggle,
  moverCount,
  className = "",
}: SortByMarketMoversControlProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
        isSortedByMovers
          ? "bg-rose-950/70 border-rose-500/60 text-rose-200 shadow-md shadow-rose-950/40 ring-1 ring-rose-500/40"
          : "bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
      } ${className}`}
      title="Sort runners by market move intensity (biggest price shortening)"
    >
      <Flame
        size={14}
        className={isSortedByMovers ? "text-rose-400 animate-pulse" : "text-slate-400"}
      />
      <span>Sort by Market Movers</span>
      {typeof moverCount === "number" && moverCount > 0 && (
        <span
          className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            isSortedByMovers ? "bg-rose-500 text-white" : "bg-slate-800 text-slate-300"
          }`}
        >
          {moverCount}
        </span>
      )}
    </button>
  );
}

/**
 * Utility helper to sort an array of race runners by market mover strength
 */
export function sortRunnersByMovers<T>(
  runners: T[],
  getOddsData: (runner: T) => { currentOdds?: number; openingOdds?: number; history?: number[] }
): T[] {
  return [...runners].sort((a, b) => {
    const dataA = getOddsData(a);
    const dataB = getOddsData(b);

    const calcMoverScore = (data: typeof dataA) => {
      const { currentOdds, openingOdds, history } = data;
      if (!currentOdds) return 0;

      const baseOdds = openingOdds || (history && history.length > 0 ? history[0] : currentOdds);
      if (!baseOdds || baseOdds <= currentOdds) return 0; // Not shortening

      const dropPercent = ((baseOdds - currentOdds) / baseOdds) * 100;
      // Price weighting bonus for shorter odds
      const priceWeight = currentOdds < 5 ? 1.5 : currentOdds < 10 ? 1.2 : 1.0;
      return dropPercent * priceWeight;
    };

    return calcMoverScore(dataB) - calcMoverScore(dataA);
  });
}
