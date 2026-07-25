"use client";

import { useEffect, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "../../lib/analytics";

function PageViewTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    const queryString = searchParams?.toString();
    const fullUrl = queryString ? `${pathname}?${queryString}` : pathname;

    // Prevent duplicate pageview triggers for identical URLs in rapid succession
    if (lastTrackedUrl.current === fullUrl) return;

    lastTrackedUrl.current = fullUrl;
    trackPageView(fullUrl);
  }, [pathname, searchParams]);

  return null;
}

export function PageViewTracker() {
  return (
    <Suspense fallback={null}>
      <PageViewTrackerInner />
    </Suspense>
  );
}
