"use client";
import { useAuth } from "../providers/AuthProvider";
import { useCallback, useState } from "react";

export function useActionGuard() {
  const { user, token } = useAuth();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const isGuest = !user || user.id === "guest";

  const requireAuthAction = useCallback(
    (callback: () => void | Promise<void>) => {
      if (!user || user.id === "guest") {
        setShowGuestModal(true);
        return;
      }
      return callback();
    },
    [user]
  );

  return { requireAuthAction, isGuest, showGuestModal, setShowGuestModal, token };
}
