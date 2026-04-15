"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { useCallback } from "react";

export function useActionGuard() {
  const { token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requireAuthAction = useCallback(
    (callback: () => void | Promise<void>) => {
      if (!token) {
        const query = searchParams.toString();
        const fullPath = query ? `${pathname}?${query}` : pathname;
        router.push(`/login?returnUrl=${encodeURIComponent(fullPath)}`);
        return;
      }
      return callback();
    },
    [token, router, pathname, searchParams]
  );

  return { requireAuthAction, token };
}
