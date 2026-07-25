"use client";

import { useEffect } from "react";
import { ANALYTICS_EVENTS, trackEvent } from "../../lib/analytics";

export function VercelAnalytics() {
  useEffect(() => {
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) {
      return;
    }

    try {
      // Monitor Largest Contentful Paint (LCP) & Layout Shifts (CLS) & First Input (FID)
      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          trackEvent(ANALYTICS_EVENTS.WEB_VITAL, {
            metric: entry.name,
            entryType: entry.entryType,
            value: entry.startTime,
            duration: entry.duration,
          });
        }
      });

      observer.observe({ type: "largest-contentful-paint", buffered: true });
      observer.observe({ type: "layout-shift", buffered: true });
      return () => observer.disconnect();
    } catch {
      // PerformanceObserver entry types might not be supported in older browsers
    }
  }, []);

  return null;
}
