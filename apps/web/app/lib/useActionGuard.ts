"use client";
import { useAuth } from "../providers/AuthProvider";
import { useCallback } from "react";

export function useActionGuard() {
  const { token } = useAuth();

  const requireAuthAction = useCallback(
    (callback: () => void | Promise<void>) => {
      return callback();
    },
    []
  );

  return { requireAuthAction, token };
}
