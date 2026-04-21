"use client";

type BetKeyParams = {
  sport: string;
  eventId: string;
  selection: string;
  betType?: string | null;
};

export function normaliseSelectionValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildPaperBetKey(params: BetKeyParams) {
  return [
    params.sport.trim().toLowerCase(),
    params.eventId.trim().toLowerCase(),
    normaliseSelectionValue(params.selection),
    (params.betType ?? "").trim().toLowerCase(),
  ].join("::");
}

export function parseEventStart(params: {
  eventStartTime?: string | null;
  eventDate?: string | null;
}) {
  const candidate = params.eventStartTime ?? params.eventDate;
  if (!candidate) {
    return null;
  }

  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? null : parsed;
}

export function hasEventStarted(params: {
  eventStartTime?: string | null;
  eventDate?: string | null;
  isClosed?: boolean;
}) {
  if (params.isClosed) {
    return true;
  }

  const parsed = parseEventStart(params);
  return parsed !== null ? parsed <= Date.now() : false;
}

export function getOddsShiftPercent(
  originalOdds?: number | null,
  latestOdds?: number | null,
) {
  if (
    originalOdds === null ||
    originalOdds === undefined ||
    latestOdds === null ||
    latestOdds === undefined ||
    originalOdds <= 1 ||
    latestOdds <= 1
  ) {
    return null;
  }

  return ((latestOdds - originalOdds) / originalOdds) * 100;
}
