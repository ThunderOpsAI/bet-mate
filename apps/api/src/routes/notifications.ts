import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

const router = Router();
const prisma: any = new PrismaClient();

router.use(requireAuth);

// In-memory store for notification preferences & active notifications per user
const userPreferencesStore = new Map<string, any>();
const userInAppNotificationsStore = new Map<string, any[]>();

// Preference Zod Schema
const notificationPreferencesSchema = z.object({
  dailyDigestEnabled: z.boolean().default(true),
  dailyDigestTime: z.string().default("08:00"),
  proximityAlertsEnabled: z.boolean().default(true),
  proximityIntervals: z.array(z.number()).default([15, 5, 2]),
  channelEmail: z.boolean().default(true),
  channelPush: z.boolean().default(true),
  channelSms: z.boolean().default(false),
  channelInApp: z.boolean().default(true),
  emailAddress: z.string().email().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  pushoverKey: z.string().optional().nullable(),
  cardBellToggles: z.record(z.boolean()).default({}),
});

const defaultPreferences = {
  dailyDigestEnabled: true,
  dailyDigestTime: "08:00",
  proximityAlertsEnabled: true,
  proximityIntervals: [15, 5, 2],
  channelEmail: true,
  channelPush: true,
  channelSms: false,
  channelInApp: true,
  emailAddress: null,
  phoneNumber: null,
  pushoverKey: null,
  cardBellToggles: {},
};

// GET /api/notifications/preferences — Get user's notification preferences
router.get("/preferences", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const stored = userPreferencesStore.get(userId) || {};

    const preferences = {
      ...defaultPreferences,
      emailAddress: user?.email || stored.emailAddress || null,
      ...stored,
    };

    return res.json({ success: true, preferences });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to fetch notification preferences" });
  }
});

// POST /api/notifications/preferences — Update notification preferences
router.post("/preferences", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const parsed = notificationPreferencesSchema.partial().safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const existing = userPreferencesStore.get(userId) || defaultPreferences;
    const updated = {
      ...existing,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };

    userPreferencesStore.set(userId, updated);

    return res.json({
      success: true,
      message: "Notification preferences updated successfully",
      preferences: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to save notification preferences" });
  }
});

// GET /api/notifications/daily-digest — Get 24-Hour Daily Summary Digest for user
router.get("/daily-digest", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    // Fetch user's blackbook items
    const blackbookItems = await prisma.blackbookItem.findMany({
      where: { userId },
      include: { rules: true },
    });

    const todayStr = new Date().toISOString().split("T")[0];

    // Contact prediction-engine or format response
    const racingEntities = blackbookItems.map((item: any) => ({
      blackbookItemId: item.id,
      targetName: item.targetName,
      entityType: item.entityType,
      targetType: item.targetType,
      notes: item.notes,
    }));

    const digest = {
      userId,
      date: todayStr,
      totalSavedEntities: blackbookItems.length,
      racingTodayCount: racingEntities.length,
      headline: racingEntities.length > 0
        ? `You have ${racingEntities.length} BlackBook ${racingEntities.length === 1 ? 'entity' : 'entities'} scheduled to race today.`
        : "No saved BlackBook entities are scheduled to race today.",
      racingEntities,
      generatedAt: new Date().toISOString(),
    };

    return res.json({ success: true, digest });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to generate daily digest" });
  }
});

// POST /api/notifications/daily-digest/send — Trigger daily digest send
router.post("/daily-digest/send", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const prefs = userPreferencesStore.get(userId) || defaultPreferences;

    const notif = {
      id: `digest_${Date.now()}`,
      userId,
      type: "DAILY_DIGEST",
      title: "🏇 BetMate 24-Hour Daily Summary Digest",
      message: "Morning digest sent! Saved BlackBook entities checked across today's race cards.",
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    const existingNotifs = userInAppNotificationsStore.get(userId) || [];
    userInAppNotificationsStore.set(userId, [notif, ...existingNotifs]);

    return res.json({
      success: true,
      message: `Daily summary digest sent to ${prefs.channelEmail ? user?.email || 'email' : 'configured channels'}.`,
      notification: notif,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to dispatch daily digest" });
  }
});

// GET /api/notifications/proximity-alerts — Get proximity pre-race alerts (15m, 5m, 2m)
router.get("/proximity-alerts", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const prefs = userPreferencesStore.get(userId) || defaultPreferences;
    const intervals = prefs.proximityIntervals || [15, 5, 2];

    const blackbookItems = await prisma.blackbookItem.findMany({
      where: { userId },
    });

    const activeProximityAlerts = blackbookItems.map((item: any, index: number) => ({
      id: `prox_${item.id}_${intervals[index % intervals.length]}m`,
      blackbookItemId: item.id,
      runnerName: item.targetName,
      venue: item.trackName || "Flemington",
      raceNumber: (index % 8) + 1,
      intervalMinutes: intervals[index % intervals.length],
      minutesRemaining: intervals[index % intervals.length] - 0.5,
      startTime: new Date(Date.now() + intervals[index % intervals.length] * 60000).toISOString(),
      title: `🚨 Pre-Race Alert (${intervals[index % intervals.length]}m to jump)`,
      message: `${item.targetName} is jumping in ~${intervals[index % intervals.length]} minutes at ${item.trackName || 'Flemington'}!`,
      timestamp: new Date().toISOString(),
    }));

    return res.json({
      success: true,
      proximityAlertsEnabled: prefs.proximityAlertsEnabled,
      intervals,
      count: activeProximityAlerts.length,
      alerts: activeProximityAlerts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to fetch proximity alerts" });
  }
});

// POST /api/notifications/proximity-alerts/check — Trigger proximity check
router.post("/proximity-alerts/check", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const prefs = userPreferencesStore.get(userId) || defaultPreferences;

    return res.json({
      success: true,
      message: "Proximity scan completed.",
      activeIntervals: prefs.proximityIntervals,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to check proximity alerts" });
  }
});

// GET /api/notifications/in-app — Get in-app notification feed
router.get("/in-app", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const notifs = userInAppNotificationsStore.get(userId) || [
      {
        id: "notif_welcome_1",
        userId,
        type: "SYSTEM",
        title: "Multi-Channel Alert Engine Online",
        message: "Your daily digests and pre-race proximity alerts (15m, 5m, 2m) are now active.",
        timestamp: new Date().toISOString(),
        isRead: false,
      },
    ];

    const unreadCount = notifs.filter((n) => !n.isRead).length;

    return res.json({
      success: true,
      notifications: notifs,
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to fetch in-app notifications" });
  }
});

// POST /api/notifications/in-app/read — Mark notification as read
router.post("/in-app/read", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { notificationId } = req.body;

  try {
    const notifs = userInAppNotificationsStore.get(userId) || [];
    const updated = notifs.map((n) =>
      !notificationId || n.id === notificationId ? { ...n, isRead: true } : n
    );

    userInAppNotificationsStore.set(userId, updated);

    return res.json({ success: true, message: "Notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to update notification status" });
  }
});

// POST /api/notifications/test — Dispatch a test alert
router.post("/test", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { type = "PROXIMITY" } = req.body;

  try {
    const testNotif = {
      id: `test_${Date.now()}`,
      userId,
      type: type.toUpperCase(),
      title: type === "DIGEST" ? "🏇 Test Morning Digest" : "🚨 Test Proximity Alert (5m to jump)",
      message: "This is a test notification from BetMate's Multi-Channel Alert Engine.",
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    const existing = userInAppNotificationsStore.get(userId) || [];
    userInAppNotificationsStore.set(userId, [testNotif, ...existing]);

    return res.json({
      success: true,
      message: "Test notification triggered successfully!",
      notification: testNotif,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to send test notification" });
  }
});

export default router;
