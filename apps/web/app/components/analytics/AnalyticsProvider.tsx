"use client";

import { GoogleAnalytics } from "./GoogleAnalytics";
import { PostHogProvider } from "./PostHogProvider";
import { VercelAnalytics } from "./VercelAnalytics";
import { PageViewTracker } from "./PageViewTracker";

export function AnalyticsProvider() {
  return (
    <>
      <GoogleAnalytics />
      <PostHogProvider />
      <VercelAnalytics />
      <PageViewTracker />
    </>
  );
}
