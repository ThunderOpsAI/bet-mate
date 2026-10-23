export interface EVLeg {
  id: string;
  sport: string;
  gameContext: string;
  game_context?: string;
  legDescription: string;
  leg_description?: string;
  trueProb: number;
  true_prob?: number;
  bestOdds: number;
  best_odds?: number;
  edgePct: number;
  edge_pct?: number;
  correlationGroup?: string | null;
  correlation_group?: string | null;
  backPrice?: number | null;
  back_price?: number | null;
  layPrice?: number | null;
  lay_price?: number | null;
  marketType?: string;
  market_type?: string;
  selection?: string;
  selectionId?: string;
}

export interface PairwiseWarning {
  leg_a_index: number;
  leg_b_index: number;
  leg_a_desc: string;
  leg_b_desc: string;
  rho: number;
  level: "high" | "mild" | "negative" | "none";
  color: "red" | "yellow" | "blue" | "gray";
  message: string;
}

export interface SGMPriceResult {
  fair_probability: number;
  fair_odds: number;
  adjusted_probability: number;
  adjusted_odds: number;
  correlation_haircut: number;
  combined_odds: number;
  combined_edge_pct: number;
  expected_value_10: number;
  warnings: PairwiseWarning[];
  max_rho: number;
}
