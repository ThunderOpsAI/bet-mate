export const REFRESH_SLOW_THRESHOLD_MS = 5_000;
export const STALE_DATA_WARNING_MS = 10 * 60 * 1000;

export type CachedViewStatus = {
  tone: "info" | "warning" | "danger";
  title: string;
  message: string;
};

type CachedViewStatusInput = {
  resourceLabel: string;
  hasData: boolean;
  lastUpdated: number | null;
  isRefreshing: boolean;
  refreshFailed: boolean;
};

export function getCachedViewStatus({
  resourceLabel,
  hasData,
  lastUpdated,
  isRefreshing,
  refreshFailed,
}: CachedViewStatusInput): CachedViewStatus | null {
  const dataAgeMs =
    lastUpdated === null ? null : Math.max(0, Date.now() - lastUpdated);
  const isStale = dataAgeMs !== null && dataAgeMs > STALE_DATA_WARNING_MS;

  if (!hasData && refreshFailed) {
    return {
      tone: "danger",
      title: `${resourceLabel} unavailable`,
      message:
        "BetMate could not load a usable snapshot just now. Try a manual refresh in a moment.",
    };
  }

  if (hasData && (refreshFailed || isStale)) {
    return {
      tone: "warning",
      title: `${resourceLabel} delayed`,
      message:
        "Showing the latest cached snapshot while BetMate retries live data in the background.",
    };
  }

  if (hasData && isRefreshing) {
    return {
      tone: "info",
      title: `Refreshing ${resourceLabel.toLowerCase()}`,
      message:
        "Saved predictions stay visible while BetMate checks for a fresher snapshot.",
    };
  }

  return null;
}

export function trackUiSignal(
  event: string,
  detail: Record<string, unknown> = {},
) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("betmate:ui-signal", {
        detail: {
          event,
          at: Date.now(),
          ...detail,
        },
      }),
    );
  }
}

export function trackRefreshOutcome(
  route: string,
  startedAt: number,
  detail: {
    failed: boolean;
    usedCache: boolean;
  },
) {
  const durationMs = Date.now() - startedAt;

  trackUiSignal("refresh_complete", {
    route,
    durationMs,
    failed: detail.failed,
    usedCache: detail.usedCache,
  });

  if (durationMs > REFRESH_SLOW_THRESHOLD_MS) {
    trackUiSignal("slow_refresh", {
      route,
      durationMs,
    });
  }
}

export function trackStaleCache(route: string, lastUpdated: number | null) {
  if (lastUpdated === null) {
    return;
  }

  const ageMs = Date.now() - lastUpdated;
  if (ageMs > STALE_DATA_WARNING_MS) {
    trackUiSignal("stale_cache_visible", {
      route,
      ageMs,
    });
  }
}
