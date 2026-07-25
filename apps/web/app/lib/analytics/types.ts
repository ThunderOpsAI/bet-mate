/**
 * Analytics Tracking Event Definitions and Global Types
 */

export const ANALYTICS_EVENTS = {
  PAGE_VIEW: "page_view",
  USER_LOGGED_IN: "User Logged In",
  USER_REGISTERED: "User Registered",
  USER_LOGGED_OUT: "User Logged Out",
  ADDED_TO_BLACKBOOK: "Added to Blackbook",
  REMOVED_FROM_BLACKBOOK: "Removed from Blackbook",
  PAPER_BET_PLACED: "Paper Bet Placed",
  STRATEGY_SAVED: "Strategy Saved",
  SPORT_VIEWED: "Sport Viewed",
  WEB_VITAL: "Web Vital",
  CUSTOM_EVENT: "custom_event",
} as const;

export type AnalyticsEventName =
  | (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]
  | (string & {});

export type EventProperties = Record<string, unknown>;

export type UserTraits = {
  email?: string;
  username?: string;
  currentBankroll?: number;
  [key: string]: unknown;
};

declare global {
  interface Window {
    gtag?: (
      command: "config" | "event" | "js" | "set",
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
    posthog?: {
      capture: (eventName: string, properties?: Record<string, unknown>) => void;
      identify: (distinctId: string, userProperties?: Record<string, unknown>) => void;
      reset: () => void;
      [key: string]: unknown;
    };
    va?: (action: string, options?: Record<string, unknown>) => void;
  }
}
