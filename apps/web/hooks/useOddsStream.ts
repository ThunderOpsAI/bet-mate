"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export interface OddsUpdate {
  marketId: string;
  runnerId?: string;
  bestBack: number;
  bestLay?: number;
  timestamp: number;
}

export function useOddsStream(marketIds: string | string[] | null | undefined) {
  const [oddsMap, setOddsMap] = useState<Record<string, OddsUpdate>>({});
  const [lastUpdate, setLastUpdate] = useState<OddsUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasFlashed, setHasFlashed] = useState<Record<string, boolean>>({});
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const marketIdKey = Array.isArray(marketIds)
    ? marketIds.filter(Boolean).sort().join(",")
    : marketIds || "";

  const clearFlash = useCallback((key: string) => {
    setTimeout(() => {
      setHasFlashed((prev) => ({ ...prev, [key]: false }));
    }, 1200);
  }, []);

  useEffect(() => {
    if (!marketIdKey) {
      setIsConnected(false);
      return;
    }

    let isMounted = true;

    function connect() {
      if (typeof window === "undefined") return;

      const url = `/api/stream/odds?marketIds=${encodeURIComponent(marketIdKey)}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener("connected", () => {
        if (!isMounted) return;
        setIsConnected(true);
      });

      es.addEventListener("price_update", (event) => {
        if (!isMounted) return;
        try {
          const update: OddsUpdate = JSON.parse(event.data);
          const key = update.runnerId ? `${update.marketId}:${update.runnerId}` : update.marketId;

          setOddsMap((prev) => ({ ...prev, [key]: update }));
          setLastUpdate(update);
          setHasFlashed((prev) => ({ ...prev, [key]: true }));
          clearFlash(key);
        } catch (err) {
          console.error("[useOddsStream] Failed to parse price update:", err);
        }
      });

      es.onerror = () => {
        if (!isMounted) return;
        setIsConnected(false);
        es.close();

        // Graceful exponential reconnect
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            if (isMounted) connect();
          }, 3000);
        }
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [marketIdKey, clearFlash]);

  return {
    oddsMap,
    lastUpdate,
    isConnected,
    hasFlashed,
  };
}

export default useOddsStream;
