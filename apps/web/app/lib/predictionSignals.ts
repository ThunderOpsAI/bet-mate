export type ConfidenceSignal = {
  label: string;
  tone: "strong" | "medium" | "caution" | "muted";
  reason: string;
};

export type UrgencySignal = {
  label: string;
  tone: "soon" | "today" | "closed" | "pending" | "settled";
};

type PredictionInsights =
  | {
      data_quality?: "strong" | "moderate" | "thin";
      calibration_confidence?: number | null;
      market_agreement?: boolean;
      notes?: string[];
    }
  | string
  | undefined
  | null;

function normaliseProbability(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  return value > 1 ? value / 100 : value;
}

function parseInsights(insights: PredictionInsights) {
  if (!insights || typeof insights === "string") {
    return {
      dataQuality: undefined as "strong" | "moderate" | "thin" | undefined,
      calibrationConfidence: null,
      marketAgreement: undefined as boolean | undefined,
    };
  }

  return {
    dataQuality: insights.data_quality,
    calibrationConfidence: normaliseProbability(insights.calibration_confidence),
    marketAgreement: insights.market_agreement,
  };
}

export function getConfidenceSignal(insights: PredictionInsights): ConfidenceSignal {
  const parsed = parseInsights(insights);

  if (parsed.marketAgreement === false) {
    return {
      label: "Market disagrees",
      tone: "caution",
      reason: "The model is seeing a different angle than the available market signal.",
    };
  }

  if (parsed.dataQuality === "thin") {
    return {
      label: "Thin data",
      tone: "caution",
      reason: "Historical coverage is limited, so treat this as a lighter-confidence read.",
    };
  }

  if (parsed.marketAgreement === undefined) {
    return {
      label: "Model-only view",
      tone: "muted",
      reason: "There is no clear market agreement signal in the payload, so this is mostly a model-driven read.",
    };
  }

  if (
    parsed.dataQuality === "strong" &&
    parsed.marketAgreement === true &&
    (parsed.calibrationConfidence ?? 0) >= 0.7
  ) {
    return {
      label: "High confidence",
      tone: "strong",
      reason: "The data quality is strong and the model calibration is lining up with the market.",
    };
  }

  return {
    label: "Medium confidence",
    tone: "medium",
    reason: "The model has usable support, but not enough signal to frame this as a top-conviction read.",
  };
}

function parseEventTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function getUrgencySignal(params: {
  startTime?: string | null;
  eventDate?: string | null;
  isClosed?: boolean;
  isSettled?: boolean;
  isResultPending?: boolean;
}): UrgencySignal | null {
  if (params.isSettled) {
    return { label: "Settled", tone: "settled" };
  }

  if (params.isResultPending) {
    return { label: "Result pending", tone: "pending" };
  }

  if (params.isClosed) {
    return { label: "Closed", tone: "closed" };
  }

  const now = Date.now();
  const startTime = parseEventTime(params.startTime) ?? parseEventTime(params.eventDate);
  if (startTime === null) {
    return null;
  }

  const diffMinutes = Math.round((startTime - now) / 60000);
  if (diffMinutes <= 12 && diffMinutes >= 0) {
    return { label: `Starts in ${diffMinutes} min`, tone: "soon" };
  }

  if (diffMinutes > 12 && diffMinutes <= 60) {
    return { label: "Live soon", tone: "soon" };
  }

  if (diffMinutes < 0) {
    return { label: "Closed", tone: "closed" };
  }

  const eventDate = new Date(startTime);
  const nowDate = new Date(now);
  const sameDay =
    eventDate.getFullYear() === nowDate.getFullYear() &&
    eventDate.getMonth() === nowDate.getMonth() &&
    eventDate.getDate() === nowDate.getDate();

  if (sameDay) {
    return { label: "Today", tone: "today" };
  }

  return null;
}
