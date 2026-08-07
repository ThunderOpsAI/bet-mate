import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { chatSocketService } from "../services/chatSocket";

const router = Router();
const prisma: any = new PrismaClient();

const sendMessageSchema = z.object({
  text: z.string().max(1000).default(""),
  betPayload: z
    .object({
      eventType: z.string(),
      eventId: z.string(),
      eventName: z.string(),
      selection: z.string(),
      odds: z.number().positive(),
      stake: z.number().positive(),
      betType: z.string().default("WIN"),
      wasAIRecommended: z.boolean().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  isSystem: z.boolean().default(false),
});

// GET /api/chat/:syndicateId/stream — Real-time SSE stream for group chat
router.get("/:syndicateId/stream", (req, res) => {
  const { syndicateId } = req.params;
  if (!syndicateId) {
    return res.status(400).json({ error: "Syndicate ID is required" });
  }
  chatSocketService.handleSSEStream(req, res, syndicateId);
});

// GET /api/chat/:syndicateId — Fetch chat message history for syndicate
router.get("/:syndicateId", requireAuth, async (req: AuthRequest, res) => {
  const { syndicateId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;
  const includeReported = req.query.includeReported === "true";

  try {
    // Verify syndicate exists
    const syndicate = await prisma.syndicate.findUnique({
      where: { id: syndicateId },
      include: {
        members: {
          select: { userId: true, role: true, username: true },
        },
      },
    });

    if (!syndicate) {
      return res.status(404).json({ error: "Syndicate not found" });
    }

    // Build role map for syndicate members
    const memberRoles: Record<string, string> = {};
    if (syndicate.members && Array.isArray(syndicate.members)) {
      syndicate.members.forEach((m: any) => {
        memberRoles[m.userId] = m.role || "MEMBER";
      });
    }

    const whereCondition: any = { syndicateId };
    if (!includeReported) {
      whereCondition.isReported = false;
    }

    const [messages, total] = await Promise.all([
      prisma.syndicateMessage.findMany({
        where: whereCondition,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.syndicateMessage.count({ where: whereCondition }),
    ]);

    // Format messages with user roles (reverse so newest is last for chat stream UI)
    const formattedMessages = messages
      .map((m: any) => ({
        id: m.id,
        syndicateId: m.syndicateId,
        userId: m.userId,
        username: m.username,
        userRole: memberRoles[m.userId] || (m.userId === syndicate.ownerId ? "OWNER" : "MEMBER"),
        text: m.text,
        betPayload: m.betPayload,
        isSystem: m.isSystem,
        isReported: m.isReported,
        createdAt: m.createdAt.toISOString(),
      }))
      .reverse();

    return res.json({
      syndicateId,
      syndicateName: syndicate.name,
      messages: formattedMessages,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (err: any) {
    console.error("Failed to fetch chat history:", err);
    return res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

// POST /api/chat/:syndicateId — Send a message or automated paper bet placement card
router.post("/:syndicateId", requireAuth, async (req: AuthRequest, res) => {
  const { syndicateId } = req.params;
  const userId = req.userId!;

  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid chat message payload", details: parsed.error.flatten() });
  }

  const { text, betPayload, isSystem } = parsed.data;

  // Must have text or betPayload
  if (!text.trim() && !betPayload) {
    return res.status(400).json({ error: "Message text or bet card payload is required" });
  }

  try {
    // Check syndicate and member
    const syndicate = await prisma.syndicate.findUnique({
      where: { id: syndicateId },
      include: {
        members: {
          where: { userId },
        },
      },
    });

    if (!syndicate) {
      return res.status(404).json({ error: "Syndicate not found" });
    }

    const member = syndicate.members?.[0];
    let username = member?.username;

    if (!username) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      username = user?.username || "Anonymous";
    }

    const userRole = member?.role || (syndicate.ownerId === userId ? "OWNER" : "MEMBER");

    // Save message to database
    const dbMessage = await prisma.syndicateMessage.create({
      data: {
        syndicateId,
        userId,
        username,
        text: text.trim(),
        betPayload: betPayload ? (betPayload as any) : null,
        isSystem,
        isReported: false,
      },
    });

    const formattedMessage = {
      id: dbMessage.id,
      syndicateId: dbMessage.syndicateId,
      userId: dbMessage.userId,
      username: dbMessage.username,
      userRole,
      text: dbMessage.text,
      betPayload: dbMessage.betPayload,
      isSystem: dbMessage.isSystem,
      isReported: dbMessage.isReported,
      createdAt: dbMessage.createdAt.toISOString(),
    };

    // Broadcast message via real-time socket service
    chatSocketService.broadcastMessage(syndicateId, formattedMessage);

    return res.status(201).json({ message: formattedMessage });
  } catch (err: any) {
    console.error("Failed to send chat message:", err);
    return res.status(500).json({ error: "Failed to send chat message" });
  }
});

// POST /api/chat/messages/:messageId/report — Flag/report inappropriate message for moderation
router.post("/messages/:messageId/report", requireAuth, async (req: AuthRequest, res) => {
  const { messageId } = req.params;

  try {
    const existingMessage = await prisma.syndicateMessage.findUnique({
      where: { id: messageId },
    });

    if (!existingMessage) {
      return res.status(404).json({ error: "Message not found" });
    }

    const updated = await prisma.syndicateMessage.update({
      where: { id: messageId },
      data: { isReported: true },
    });

    chatSocketService.broadcastModeration(
      existingMessage.syndicateId,
      messageId,
      "reported",
      req.userId!
    );

    return res.json({
      success: true,
      messageId: updated.id,
      syndicateId: updated.syndicateId,
      status: "reported",
      message: "Message has been reported for moderation.",
    });
  } catch (err: any) {
    console.error("Failed to report message:", err);
    return res.status(500).json({ error: "Failed to report message" });
  }
});

// POST /api/chat/users/:targetUserId/block — Moderation action to block/flag a user in chat
router.post("/users/:targetUserId/block", requireAuth, async (req: AuthRequest, res) => {
  const { targetUserId } = req.params;
  const currentUserId = req.userId!;

  if (targetUserId === currentUserId) {
    return res.status(400).json({ error: "You cannot block yourself" });
  }

  return res.json({
    success: true,
    blockedUserId: targetUserId,
    message: "User has been blocked from your local chat feed.",
  });
});

export default router;
