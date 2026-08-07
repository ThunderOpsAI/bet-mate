"use client";

import { useCallback, useEffect, useState } from "react";
import { ML_API } from "./mlApi";
import { useAuth } from "../providers/AuthProvider";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";

const LOCAL_STORAGE_KEY = "betmate_quick_blackbook";

export type BlackbookQuickAddParams = {
  runner: string;
  type?: "runner" | "jockey" | "trainer" | "selection";
  sport?: string;
};

export function useBlackbookQuickAdd() {
  const { token, user } = useAuth();
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());

  // Load saved items on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedItems(new Set(parsed));
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const isSaved = useCallback(
    (name: string) => {
      if (!name) return false;
      return savedItems.has(name.trim().toLowerCase());
    },
    [savedItems],
  );

  const addToBlackbook = useCallback(
    async (params: BlackbookQuickAddParams) => {
      const rawName = params.runner.trim();
      if (!rawName) return false;

      const normalizedKey = rawName.toLowerCase();
      
      // Optimistic update
      setSavedItems((prev) => {
        const next = new Set(prev);
        next.add(normalizedKey);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(next)));
        } catch {
          // ignore
        }
        return next;
      });

      trackEvent(ANALYTICS_EVENTS.ADDED_TO_BLACKBOOK, {
        runner: rawName,
        type: params.type || "runner",
        sport: params.sport || "racing",
      });

      // If user is authenticated, sync with ML_API backend
      if (user && user.id !== "guest" && token) {
        try {
          await fetch(`${ML_API}/blackbook/${encodeURIComponent(rawName)}/auto-bet`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              user_id: user.id,
              sport: params.sport || "racing",
              bet_type: "win",
              stake: 10,
              enabled: true,
              probability_threshold: 50,
            }),
          });
        } catch (err) {
          console.error("Failed to sync quick-add blackbook with backend", err);
        }
      }

      return true;
    },
    [token, user],
  );

  const removeFromBlackbook = useCallback(
    async (name: string) => {
      const rawName = name.trim();
      if (!rawName) return;
      const normalizedKey = rawName.toLowerCase();

      setSavedItems((prev) => {
        const next = new Set(prev);
        next.delete(normalizedKey);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(next)));
        } catch {
          // ignore
        }
        return next;
      });

      trackEvent(ANALYTICS_EVENTS.REMOVED_FROM_BLACKBOOK, {
        runner: rawName,
      });

      if (user && user.id !== "guest" && token) {
        try {
          await fetch(`${ML_API}/blackbook/${encodeURIComponent(rawName)}/auto-bet`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (err) {
          console.error("Failed to remove blackbook item from backend", err);
        }
      }
    },
    [token, user],
  );

  return {
    savedItems,
    isSaved,
    addToBlackbook,
    removeFromBlackbook,
  };
}
