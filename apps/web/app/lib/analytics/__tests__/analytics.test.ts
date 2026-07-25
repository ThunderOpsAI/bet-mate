import {
  ANALYTICS_EVENTS,
  identifyUser,
  resetUser,
  trackEvent,
  trackPageView,
} from "../index";

describe("Analytics Tracking Utility", () => {
  let eventsDispatched: CustomEvent[] = [];

  beforeEach(() => {
    eventsDispatched = [];
    // Mock window dispatchEvent
    window.dispatchEvent = ((event: CustomEvent) => {
      eventsDispatched.push(event);
      return true;
    }) as unknown as typeof window.dispatchEvent;

    // Reset mocks on window
    window.gtag = jest.fn();
    window.posthog = {
      capture: jest.fn(),
      identify: jest.fn(),
      reset: jest.fn(),
    };
    window.va = jest.fn();
  });

  test("trackEvent dispatches custom event and calls external providers", () => {
    trackEvent(ANALYTICS_EVENTS.USER_LOGGED_IN, { userId: "user-123" });

    expect(eventsDispatched.length).toBe(1);
    expect(eventsDispatched[0].detail.event).toBe(ANALYTICS_EVENTS.USER_LOGGED_IN);
    expect(eventsDispatched[0].detail.properties.userId).toBe("user-123");

    expect(window.gtag).toHaveBeenCalledWith(
      "event",
      ANALYTICS_EVENTS.USER_LOGGED_IN,
      expect.objectContaining({ userId: "user-123" })
    );

    expect(window.posthog?.capture).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.USER_LOGGED_IN,
      expect.objectContaining({ userId: "user-123" })
    );

    expect(window.va).toHaveBeenCalledWith(
      "event",
      expect.objectContaining({
        name: ANALYTICS_EVENTS.USER_LOGGED_IN,
      })
    );
  });

  test("trackPageView tracks page views across Next.js navigation", () => {
    trackPageView("/racing", "Racing Dashboard");

    expect(eventsDispatched.length).toBe(1);
    expect(eventsDispatched[0].detail.event).toBe(ANALYTICS_EVENTS.PAGE_VIEW);
    expect(eventsDispatched[0].detail.properties.url).toBe("/racing");
    expect(eventsDispatched[0].detail.properties.title).toBe("Racing Dashboard");
  });

  test("identifyUser identifies user across GA4 and PostHog", () => {
    identifyUser("user-456", { username: "pro_punter", email: "pro@betmate.app" });

    expect(window.gtag).toHaveBeenCalledWith("set", "user_properties", {
      user_id: "user-456",
      username: "pro_punter",
      email: "pro@betmate.app",
    });

    expect(window.posthog?.identify).toHaveBeenCalledWith("user-456", {
      username: "pro_punter",
      email: "pro@betmate.app",
    });
  });

  test("resetUser resets PostHog identity on logout", () => {
    resetUser();

    expect(window.posthog?.reset).toHaveBeenCalled();
  });
});
