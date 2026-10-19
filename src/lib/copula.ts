import type { EVLeg, SGMPriceResult } from "../types";

export function calculateCopulaMultiPricing(legs: EVLeg[]): SGMPriceResult {
  if (legs.length === 0) {
    return {
      fair_probability: 0,
      fair_odds: 0,
      adjusted_probability: 0,
      adjusted_odds: 0,
      correlation_haircut: 0,
      combined_odds: 0,
      combined_edge_pct: 0,
      expected_value_10: 0,
      warnings: []
    };
  }

  // 1. Calculate raw combined odds and raw independence probability
  const combinedOdds = legs.reduce((acc, l) => acc * (l.best_odds || 1.90), 1);
  const fairProb = legs.reduce((acc, l) => acc * (l.true_prob || 0.5), 1);

  // 2. Pairwise correlation check
  const warnings: SGMPriceResult["warnings"] = [];
  let totalCorrelationAdjustment = 0;

  for (let i = 0; i < legs.length; i++) {
    for (let j = i + 1; j < legs.length; j++) {
      const legA = legs[i];
      const legB = legs[j];

      // Same game / same event check
      if (legA.correlation_group && legB.correlation_group && legA.correlation_group === legB.correlation_group) {
        // Synergy or Conflict
        const isSynergy = (legA.market_type.includes("Pts") && legB.market_type.includes("Threes")) ||
                          (legA.market_type.includes("Try") && legB.market_type.includes("Points")) ||
                          (legA.market_type.includes("Disposals") && legB.market_type.includes("Goals"));

        if (isSynergy) {
          totalCorrelationAdjustment += 0.08;
          warnings.push({
            legA: legA.selection,
            legB: legB.selection,
            correlation: 0.28,
            type: "synergy",
            message: `Positive synergy detected: ${legA.selection} and ${legB.selection} thrive in game scripts with high scoring pace.`
          });
        } else {
          totalCorrelationAdjustment += 0.04;
          warnings.push({
            legA: legA.selection,
            legB: legB.selection,
            correlation: 0.14,
            type: "neutral",
            message: `Same-matchup correlation detected between ${legA.selection} and ${legB.selection}. Haircut adjusted.`
          });
        }
      }
    }
  }

  // Base haircut starts at 5% per leg above 2 legs, plus any intra-game correlations
  const baseHaircut = Math.min(0.28, 0.05 * (legs.length - 1) + totalCorrelationAdjustment);
  const adjustedProb = Math.max(0.0001, fairProb * (1 - baseHaircut));
  const adjustedOdds = adjustedProb > 0 ? 1 / adjustedProb : 0;
  const combinedEdgePct = ((adjustedProb * combinedOdds) - 1.0) * 100.0;
  const ev10 = (10.0 * combinedOdds * adjustedProb) - 10.0;

  return {
    fair_probability: Number(fairProb.toFixed(4)),
    fair_odds: Number((fairProb > 0 ? 1 / fairProb : 0).toFixed(2)),
    adjusted_probability: Number(adjustedProb.toFixed(4)),
    adjusted_odds: Number(adjustedOdds.toFixed(2)),
    correlation_haircut: Number((baseHaircut * 100).toFixed(1)),
    combined_odds: Number(combinedOdds.toFixed(2)),
    combined_edge_pct: Number(combinedEdgePct.toFixed(1)),
    expected_value_10: Number(ev10.toFixed(2)),
    warnings
  };
}
