"use client";

import { usePaperBetslip } from "../../app/providers/PaperBetslipProvider";
import type { PlayerProp } from "./types";

export function useBetslip() {
  const paperBetslip = usePaperBetslip();

  const addPropBet = (
    prop: PlayerProp,
    selection: "Over" | "Under" = "Over",
    customPrice?: number
  ) => {
    const marketLabel = prop.marketType.charAt(0).toUpperCase() + prop.marketType.slice(1).toLowerCase();
    const eventName = prop.matchup
      ? `${prop.player.team} matchup (${prop.matchup})`
      : `${prop.player.fullName} vs Opponent`;

    const oddsPrice =
      customPrice ||
      (selection === "Over"
        ? prop.bestOdds?.price || prop.odds?.find((o) => o.selection.toLowerCase().includes("over"))?.price || 1.90
        : prop.odds?.find((o) => o.selection.toLowerCase().includes("under"))?.price || 1.90);

    return paperBetslip.addBet(
      {
        sport: prop.sport.toLowerCase(),
        event_id: prop.gameId,
        event_name: eventName,
        bet_type: `Player Prop - ${marketLabel}`,
        selection: `${prop.player.fullName} ${selection} ${prop.line} ${marketLabel}`,
        odds: Number(oddsPrice.toFixed(2)),
        stake: paperBetslip.defaultStake || 10,
        odds_source: "market",
        runner_name: prop.player.fullName,
      },
      { openBetslip: true }
    );
  };

  const isPropInSlip = (
    prop: PlayerProp,
    selection: "Over" | "Under"
  ): boolean => {
    const marketLabel = prop.marketType.toLowerCase();
    return paperBetslip.bets.some(
      (b) =>
        b.event_id === prop.gameId &&
        b.selection.toLowerCase().includes(prop.player.fullName.toLowerCase()) &&
        b.selection.toLowerCase().includes(selection.toLowerCase()) &&
        b.selection.toLowerCase().includes(marketLabel)
    );
  };

  return {
    ...paperBetslip,
    addPropBet,
    isPropInSlip,
  };
}

export default useBetslip;
