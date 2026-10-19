"use client";

export type SupportedSport = "racing" | "afl" | "nba" | "nrl" | "soccer" | "golf" | "mma";

export type FeatureImpactItem = {
  feature: string;
  weight?: number | null;
  contribution?: number | null;
};

export type AiInsightsContext = {
  data_quality?: "strong" | "moderate" | "thin" | string;
  calibration_confidence?: number | null;
  market_agreement?: boolean | null;
  notes?: string[] | null;
};

type NormalizedAiInsightsContext = {
  data_quality: "strong" | "moderate" | "thin" | string;
  calibration_confidence: number | null;
  market_agreement: boolean | null;
  notes: string[];
};

export type ModelMetadata = {
  feature_importance?: Record<string, number> | null;
  last_trained?: string | null;
  version?: string | null;
};

export type ExplainablePredictionPayload = {
  sport: SupportedSport;
  selectionName: string;
  opponentName?: string | null;
  probability: number;
  fairOdds?: number | null;
  marketOdds?: number | null;
  featureImpact?: FeatureImpactItem[] | Record<string, number> | null;
  aiInsightsContext?: AiInsightsContext | string | null;
  modelMetadata?: ModelMetadata | null;
};

export type BobExplainSignal = {
  feature: string;
  label: string;
  value: number;
  direction: "positive" | "negative";
  summary: string;
};

export type BobExplanation = {
  selectionName: string;
  probabilityLabel: string;
  fairOddsLabel: string;
  marketOddsLabel: string | null;
  confidenceLabel: string;
  confidenceTone: "strong" | "measured" | "cautious";
  headline: string;
  summary: string;
  confidenceReason: string;
  dataQualityLabel: string;
  marketView: string;
  topSignals: BobExplainSignal[];
  cautionSignals: BobExplainSignal[];
  notes: string[];
  modelMeta: string[];
};

const FEATURE_LABELS: Record<string, string> = {
  speed_rating: "speed rating",
  horse_win_rate: "horse win rate",
  jockey_win_rate: "jockey strike rate",
  recent_form: "recent form",
  recent_form_5: "recent form",
  recent_form_10: "recent form",
  track_conditions: "track conditions",
  class: "class edge",
  class_factor: "class edge",
  barrier_draw: "barrier draw",
  barrier_penalty: "barrier draw",
  carry_weight: "carry weight",
  weight_penalty: "carry weight",
  horse_jockey_combo: "horse and jockey combo",
  jockey_trainer_combo: "jockey and trainer combo",
  live_odds_signal: "market signal",
  market_signal: "market signal",
  market_odds: "market odds",
  points_differential: "points differential",
  head_to_head: "head-to-head results",
  home_ground: "home ground edge",
  home_advantage: "home edge",
  home_court: "home court edge",
  home_court_base: "home court edge",
  rest_advantage: "rest advantage",
  travel_penalty: "travel load",
  travel_distance_away: "away travel",
  fatigue: "fatigue",
  back_to_back: "back-to-back spot",
  offensive_rating: "offensive rating",
  off_rating: "offensive rating",
  defensive_rating: "defensive rating",
  def_rating: "defensive rating",
  usage_rate: "usage rate",
  usage_rates: "usage rate",
  injuries_impact: "injury impact",
  squiggle_signal: "Squiggle signal",
};

function toProbability(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value > 1) {
    return Math.max(0, Math.min(1, value / 100));
  }

  return Math.max(0, Math.min(1, value));
}

function formatProbability(value: number): string {
  return `${Math.round(toProbability(value) * 100)}%`;
}

function formatOdds(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }

  return `$${value.toFixed(2)}`;
}

function prettifyFeatureName(feature: string): string {
  if (FEATURE_LABELS[feature]) {
    return FEATURE_LABELS[feature];
  }

  return feature
    .replace(/^(home|away)_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/^./, (char) => char.toLowerCase());
}

function normalizeFeatureImpact(
  featureImpact?: FeatureImpactItem[] | Record<string, number> | null,
): BobExplainSignal[] {
  if (!featureImpact) {
    return [];
  }

  if (Array.isArray(featureImpact)) {
    return featureImpact
      .map((item) => {
        const rawValue =
          typeof item.contribution === "number"
            ? item.contribution
            : typeof item.weight === "number"
              ? item.weight
              : NaN;

        if (!item.feature || !Number.isFinite(rawValue) || rawValue === 0) {
          return null;
        }

        return {
          feature: item.feature,
          label: prettifyFeatureName(item.feature),
          value: rawValue,
          direction: rawValue >= 0 ? "positive" : "negative",
          summary: "",
        } satisfies BobExplainSignal;
      })
      .filter((item): item is BobExplainSignal => item !== null);
  }

  return Object.entries(featureImpact)
    .map(([feature, value]) => {
      if (!Number.isFinite(value) || value === 0) {
        return null;
      }

      return {
        feature,
        label: prettifyFeatureName(feature),
        value,
        direction: value >= 0 ? "positive" : "negative",
        summary: "",
      } satisfies BobExplainSignal;
    })
    .filter((item): item is BobExplainSignal => item !== null);
}

function normalizeInsights(
  aiInsightsContext?: AiInsightsContext | string | null,
): NormalizedAiInsightsContext {
  if (!aiInsightsContext) {
    return {
      data_quality: "moderate",
      calibration_confidence: null,
      market_agreement: null,
      notes: [],
    };
  }

  if (typeof aiInsightsContext === "string") {
    return {
      data_quality: "moderate",
      calibration_confidence: null,
      market_agreement: null,
      notes: [aiInsightsContext],
    };
  }

  return {
    data_quality: aiInsightsContext.data_quality ?? "moderate",
    calibration_confidence:
      aiInsightsContext.calibration_confidence ?? null,
    market_agreement: aiInsightsContext.market_agreement ?? null,
    notes: aiInsightsContext.notes ?? [],
  };
}

function getSignalSummary(
  sport: SupportedSport,
  signal: BobExplainSignal,
  selectionName: string,
): string {
  const lead = signal.direction === "positive" ? "Helping" : "Holding back";
  const label = signal.label;

  if (label === "barrier draw") {
    return signal.direction === "positive"
      ? `${lead} ${selectionName}: the barrier setup looks workable.`
      : `${lead} ${selectionName}: the barrier draw is not doing it any favors.`;
  }

  if (label === "carry weight") {
    return signal.direction === "positive"
      ? `${lead} ${selectionName}: the weight profile looks manageable.`
      : `${lead} ${selectionName}: the carry weight adds some risk.`;
  }

  if (label === "market signal") {
    return signal.direction === "positive"
      ? `${lead} ${selectionName}: the market is not pushing back on the model.`
      : `${lead} ${selectionName}: the market read is not fully onside.`;
  }

  if (sport === "racing" && label === "track conditions") {
    return signal.direction === "positive"
      ? `${lead} ${selectionName}: the track profile fits what the model wants.`
      : `${lead} ${selectionName}: the track setup is less convincing.`;
  }

  if ((sport === "afl" || sport === "nba") && label === "rest advantage") {
    return signal.direction === "positive"
      ? `${lead} ${selectionName}: rest is in its favor.`
      : `${lead} ${selectionName}: the rest spot is not ideal.`;
  }

  if ((sport === "afl" || sport === "nba") && label === "home court edge") {
    return signal.direction === "positive"
      ? `${lead} ${selectionName}: venue edge is part of the case.`
      : `${lead} ${selectionName}: there is no real venue edge here.`;
  }

  if (sport === "afl" && label === "away travel") {
    return signal.direction === "positive"
      ? `${lead} ${selectionName}: travel load favors this side.`
      : `${lead} ${selectionName}: travel could drag on this matchup.`;
  }

  return `${lead} ${selectionName}: ${label} is a meaningful part of the read.`;
}

function buildHeadline(
  selectionName: string,
  confidenceTone: BobExplanation["confidenceTone"],
  topSignals: BobExplainSignal[],
): string {
  if (confidenceTone === "strong") {
    const signalLabel = topSignals[0]?.label ?? "the numbers";
    return `Bob likes ${selectionName} on the strength of ${signalLabel}.`;
  }

  if (confidenceTone === "cautious") {
    return `Bob can make the case for ${selectionName}, but the edge is not clean.`;
  }

  return `Bob gives ${selectionName} a measured lean, not a free swing.`;
}

function buildSummary(
  selectionName: string,
  probabilityLabel: string,
  positiveSignals: BobExplainSignal[],
  negativeSignals: BobExplainSignal[],
  insights: NormalizedAiInsightsContext,
): string {
  const leadingReasons = positiveSignals.slice(0, 2).map((signal) => signal.label);
  const caution = negativeSignals[0]?.label;

  let summary = `${selectionName} is sitting at ${probabilityLabel}.`;

  if (leadingReasons.length > 0) {
    summary += ` The main push comes from ${leadingReasons.join(" and ")}.`;
  }

  if (caution) {
    summary += ` The watch-out is ${caution}.`;
  }

  if (insights.data_quality === "thin") {
    summary += " Data depth is thin, so this needs a lighter touch.";
  } else if (insights.calibration_confidence !== null) {
    const calibration = toProbability(insights.calibration_confidence);

    if (calibration >= 0.7) {
      summary += " The model calibration looks stable enough to trust the lean.";
    } else if (calibration <= 0.45) {
      summary += " Calibration is patchy, so I would treat the number carefully.";
    }
  }

  return summary;
}

function getConfidenceTone(
  probability: number,
  insights: NormalizedAiInsightsContext,
): {
  label: string;
  tone: BobExplanation["confidenceTone"];
  reason: string;
} {
  const normalizedProbability = toProbability(probability);
  const edge = Math.abs(normalizedProbability - 0.5);
  const calibration =
    insights.calibration_confidence === null
      ? null
      : toProbability(insights.calibration_confidence);

  if (
    insights.data_quality === "thin" ||
    (calibration !== null && calibration < 0.5) ||
    edge < 0.06
  ) {
    return {
      label: "Cautious",
      tone: "cautious",
      reason:
        "The edge is slim or the supporting data is light, so this reads more like a lean than a conviction play.",
    };
  }

  if (
    insights.data_quality === "strong" &&
    (calibration === null || calibration >= 0.7) &&
    edge >= 0.12
  ) {
    return {
      label: "Strong",
      tone: "strong",
      reason:
        "The edge is clear, the data quality is solid, and the model calibration is in a healthier range.",
    };
  }

  return {
    label: "Measured",
    tone: "measured",
    reason:
      "There is a real signal here, but it still needs to be treated as a probability call rather than a certainty.",
  };
}

function getDataQualityLabel(insights: NormalizedAiInsightsContext): string {
  if (insights.data_quality === "strong") {
    return "Data quality looks strong.";
  }

  if (insights.data_quality === "thin") {
    return "Data quality is thin, so Bob is keeping this honest.";
  }

  return "Data quality is workable, but not bulletproof.";
}

function getMarketView(
  marketOdds: number | null | undefined,
  fairOdds: number | null | undefined,
  insights: NormalizedAiInsightsContext,
): string {
  if (marketOdds === null || marketOdds === undefined || !Number.isFinite(marketOdds)) {
    if (insights.market_agreement === false) {
      return "No market price is attached here, and the context already hints the market may disagree.";
    }

    return "No market price is attached, so this is the model on its own.";
  }

  if (fairOdds === null || fairOdds === undefined || !Number.isFinite(fairOdds)) {
    return "A market price is available, but the model fair odds were not supplied cleanly.";
  }

  const gap = marketOdds - fairOdds;

  if (Math.abs(gap) < 0.15) {
    return "Model and market are broadly in the same range.";
  }

  if (gap > 0) {
    return "The market is offering a longer price than the model fair line, so there is some value if you trust the read.";
  }

  return "The market is shorter than the model fair line, so the edge is less generous than the raw win probability suggests.";
}

function buildModelMeta(modelMetadata?: ModelMetadata | null): string[] {
  if (!modelMetadata) {
    return [];
  }

  const meta: string[] = [];

  if (modelMetadata.version) {
    meta.push(`Model version ${modelMetadata.version}`);
  }

  if (modelMetadata.last_trained) {
    meta.push(`Last trained ${formatDateLabel(modelMetadata.last_trained)}`);
  }

  const importanceCount = modelMetadata.feature_importance
    ? Object.keys(modelMetadata.feature_importance).length
    : 0;

  if (importanceCount > 0) {
    meta.push(`${importanceCount} tracked model features`);
  }

  return meta;
}

function formatDateLabel(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function buildBobExplanation(
  payload: ExplainablePredictionPayload,
): BobExplanation {
  const probabilityLabel = formatProbability(payload.probability);
  const fairOddsLabel = formatOdds(payload.fairOdds);
  const marketOddsLabel =
    payload.marketOdds === null || payload.marketOdds === undefined
      ? null
      : formatOdds(payload.marketOdds);
  const normalizedSignals = normalizeFeatureImpact(payload.featureImpact)
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
    .map((signal) => ({
      ...signal,
      summary: getSignalSummary(payload.sport, signal, payload.selectionName),
    }));
  const positiveSignals = normalizedSignals
    .filter((signal) => signal.value > 0)
    .slice(0, 4);
  const negativeSignals = normalizedSignals
    .filter((signal) => signal.value < 0)
    .slice(0, 3);
  const insights = normalizeInsights(payload.aiInsightsContext);
  const confidence = getConfidenceTone(payload.probability, insights);
  const notes = insights.notes.filter(Boolean).slice(0, 3);

  return {
    selectionName: payload.selectionName,
    probabilityLabel,
    fairOddsLabel,
    marketOddsLabel,
    confidenceLabel: confidence.label,
    confidenceTone: confidence.tone,
    headline: buildHeadline(
      payload.selectionName,
      confidence.tone,
      positiveSignals,
    ),
    summary: buildSummary(
      payload.selectionName,
      probabilityLabel,
      positiveSignals,
      negativeSignals,
      insights,
    ),
    confidenceReason: confidence.reason,
    dataQualityLabel: getDataQualityLabel(insights),
    marketView: getMarketView(payload.marketOdds, payload.fairOdds, insights),
    topSignals: positiveSignals,
    cautionSignals: negativeSignals,
    notes,
    modelMeta: buildModelMeta(payload.modelMetadata),
  };
}
