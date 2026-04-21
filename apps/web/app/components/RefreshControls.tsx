"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Clock3, LoaderCircle, RefreshCw, TimerReset } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type RefreshControlsProps = {
  lastUpdated: number | null;
  nextRefreshAt: number | null;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
};

export default function RefreshControls({
  lastUpdated,
  nextRefreshAt,
  isRefreshing,
  onRefresh,
}: RefreshControlsProps) {
  const [now, setNow] = useState(() => Date.now());
  const refreshRef = useRef(onRefresh);
  const refreshingRef = useRef(isRefreshing);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    refreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);

      if (
        nextRefreshAt !== null &&
        currentTime >= nextRefreshAt &&
        !refreshingRef.current
      ) {
        void refreshRef.current();
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [nextRefreshAt]);

  const lastUpdatedLabel =
    lastUpdated === null
      ? "Waiting for first snapshot"
      : formatDistanceToNowStrict(lastUpdated, { addSuffix: true });

  return (
    <div className="refresh-controls">
      <div className="refresh-controls-meta">
        <div className="refresh-pill">
          <Clock3 size={14} />
          <span>Last updated: {lastUpdatedLabel}</span>
        </div>

        <div className="refresh-pill">
          <TimerReset size={14} />
          <span>Auto-refresh in: {formatCountdown(nextRefreshAt, now)}</span>
        </div>

        {isRefreshing ? (
          <div className="refresh-pill is-refreshing">
            <LoaderCircle className="refresh-spinner" size={14} />
            <span>Refreshing in background...</span>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="btn btn-sm btn-secondary refresh-action"
        onClick={() => void onRefresh()}
        disabled={isRefreshing}
      >
        <RefreshCw className={isRefreshing ? "refresh-spinner" : undefined} size={14} />
        {isRefreshing ? "Refreshing..." : "Refresh now"}
      </button>
    </div>
  );
}

function formatCountdown(nextRefreshAt: number | null, now: number) {
  if (nextRefreshAt === null) {
    return "--:--";
  }

  const remainingMs = Math.max(0, nextRefreshAt - now);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
