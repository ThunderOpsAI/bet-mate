import {
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
  type EventProperties,
  type UserTraits,
} from "./types";

export { ANALYTICS_EVENTS, type AnalyticsEventName, type EventProperties, type UserTraits };

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GA_ID;
const IS_DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true" || process.env.NODE_ENV === "development";

/**
 * Tracks a custom event across all configured analytics providers.
 *
 * @param eventName Name of the event (e.g., "User Logged In", "Added to Blackbook")
 * @param properties Key-value object with event details
 */
export function trackEvent(
  eventName: AnalyticsEventName,
  properties: EventProperties = {}
): void {
  if (typeof window === "undefined") return;

  const payload = {
    ...properties,
    timestamp: Date.now(),
    path: window.location.pathname,
  };

  if (IS_DEBUG) {
    console.debug(`[BetMate Analytics] 📊 ${eventName}`, payload);
  }

  // 1. Dispatch custom DOM event for local app signals & testing
  try {
    window.dispatchEvent(
      new CustomEvent("betmate:analytics", {
        detail: {
          event: eventName,
          properties: payload,
          at: Date.now(),
        },
      })
    );
  } catch (err) {
    console.error("[Analytics] Error dispatching custom event:", err);
  }

  // 2. Google Analytics (GA4)
  if (typeof window.gtag === "function") {
    try {
      window.gtag("event", String(eventName), payload);
    } catch (err) {
      console.error("[Analytics] Error sending to GA4:", err);
    }
  }

  // 3. PostHog
  if (window.posthog && typeof window.posthog.capture === "function") {
    try {
      window.posthog.capture(String(eventName), payload);
    } catch (err) {
      console.error("[Analytics] Error sending to PostHog:", err);
    }
  }

  // 4. Vercel Analytics / Custom Provider Wrapper
  if (typeof window.va === "function") {
    try {
      window.va("event", { name: String(eventName), data: payload });
    } catch (err) {
      console.error("[Analytics] Error sending to Vercel Analytics:", err);
    }
  }
}

/**
 * Tracks client-side page views when users navigate between routes.
 *
 * @param url Full path or relative path (e.g. "/racing", "/blackbook")
 * @param title Document or screen title
 */
export function trackPageView(url: string, title?: string): void {
  if (typeof window === "undefined") return;

  const pageTitle = title || document.title || "BetMate";

  if (IS_DEBUG) {
    console.debug(`[BetMate Analytics] 📄 PageView: ${url} (${pageTitle})`);
  }

  // 1. Track standard page_view custom event
  trackEvent(ANALYTICS_EVENTS.PAGE_VIEW, {
    url,
    title: pageTitle,
    referrer: document.referrer || null,
  });

  // 2. Google Analytics page_view update
  if (typeof window.gtag === "function" && GA_MEASUREMENT_ID) {
    try {
      window.gtag("config", GA_MEASUREMENT_ID, {
        page_path: url,
        page_title: pageTitle,
      });
    } catch (err) {
      console.error("[Analytics] Error updating GA page view:", err);
    }
  }
}

/**
 * Identifies the current user across analytics providers.
 *
 * @param userId Unique user identifier
 * @param traits User profile traits (email, username, bankroll)
 */
export function identifyUser(userId: string, traits: UserTraits = {}): void {
  if (typeof window === "undefined") return;

  if (IS_DEBUG) {
    console.debug(`[BetMate Analytics] 👤 Identify User: ${userId}`, traits);
  }

  if (typeof window.gtag === "function" && GA_MEASUREMENT_ID) {
    try {
      window.gtag("set", "user_properties", {
        user_id: userId,
        ...traits,
      });
    } catch (err) {
      console.error("[Analytics] Error identifying in GA4:", err);
    }
  }

  if (window.posthog && typeof window.posthog.identify === "function") {
    try {
      window.posthog.identify(userId, traits);
    } catch (err) {
      console.error("[Analytics] Error identifying in PostHog:", err);
    }
  }
}

/**
 * Resets user identity when the user logs out.
 */
export function resetUser(): void {
  if (typeof window === "undefined") return;

  if (IS_DEBUG) {
    console.debug("[BetMate Analytics] 🚪 Reset User");
  }

  if (window.posthog && typeof window.posthog.reset === "function") {
    try {
      window.posthog.reset();
    } catch (err) {
      console.error("[Analytics] Error resetting PostHog user:", err);
    }
  }
}
