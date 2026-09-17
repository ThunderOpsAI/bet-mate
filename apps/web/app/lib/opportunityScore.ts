import type {
  ConfidenceSignal,
  UrgencySignal,
} from "./predictionSignals";

export type OpportunityCandidate = {
  id: string;
  selectionName: string;
  eventLabel: string;
  sport: "racing" | "afl" | "nba" | "nrl" | "soccer" | "golf" | "mma";
  probability: number;
  fairOdds: number;
  marketOdds?: number | null;
  confidenceSignal?: ConfidenceSignal | null;
  urgencySignal?: UrgencySignal | null;
  href: string;
  note?: string;
  eventTime?: string;
};

export type RankedOpportunity = OpportunityCandidate & {
  edgePercent: number | null;
  score: number;
  summary: string;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function confidenceWeight(signal?: ConfidenceSignal | null) {
  switch (signal?.tone) {
    case "strong":
      return 0.95;
    case "medium":
      return 0.68;
    case "caution":
      return 0.35;
    case "muted":
      return 0.45;
    default:
      return 0.5;
  }
}

function urgencyWeight(signal?: UrgencySignal | null) {
  switch (signal?.tone) {
    case "soon":
      return 1;
    case "today":
      return 0.78;
    case "closed":
    case "pending":
    case "settled":
      return 0;
    default:
      return 0.55;
  }
}

function probabilityWeight(probability: number) {
  const normalised = probability > 1 ? probability / 100 : probability;
  return clamp(normalised);
}

export function getEdgePercent(
  fairOdds: number,
  marketOdds?: number | null,
) {
  if (!marketOdds || marketOdds <= 1 || fairOdds <= 1) {
    return null;
  }

  const valueGap = ((marketOdds - fairOdds) / fairOdds) * 100;
  return valueGap > 0 ? valueGap : null;
}

export function formatOdds(odds?: number | null) {
  if (!odds || odds <= 1) {
    return "N/A";
  }

  return `$${odds.toFixed(2)}`;
}

export function rankOpportunities(candidates: OpportunityCandidate[]) {
  return candidates
    .filter(
      (candidate) =>
        candidate.urgencySignal?.tone !== "closed" &&
        candidate.urgencySignal?.tone !== "pending" &&
        candidate.urgencySignal?.tone !== "settled",
    )
    .map((candidate) => {
      const edgePercent = getEdgePercent(
        candidate.fairOdds,
        candidate.marketOdds,
      );
      const edgeWeight = clamp((edgePercent ?? 0) / 40);
      const score =
        edgeWeight * 0.45 +
        confidenceWeight(candidate.confidenceSignal) * 0.3 +
        urgencyWeight(candidate.urgencySignal) * 0.15 +
        probabilityWeight(candidate.probability) * 0.1;

      const summary = edgePercent
        ? `Good value: market paying ${formatOdds(candidate.marketOdds)}, model fair odds ${formatOdds(candidate.fairOdds)}.`
        : candidate.confidenceSignal?.tone === "muted"
          ? "Model-led read only for now because there is no reliable live market price attached."
          : "Model-led opportunity ranked by confidence, timing, and win probability.";

      return {
        ...candidate,
        edgePercent,
        score,
        summary: candidate.note ?? summary,
      } satisfies RankedOpportunity;
    })
    .sort((left, right) => right.score - left.score);
}
