import { EventEmitter } from "node:events";
import type { Request, Response } from "express";

export interface BetCardPayload {
  eventType: string;
  eventId: string;
  eventName: string;
  selection: string;
  odds: number;
  stake: number;
  betType: string;
  wasAIRecommended?: boolean;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  syndicateId: string;
  userId: string;
  username: string;
  userRole?: string; // OWNER, ADMIN, MEMBER
  text: string;
  betPayload?: BetCardPayload | null;
  isSystem: boolean;
  isReported: boolean;
  createdAt: string;
}

export class ChatSocketService extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }

  /**
   * Broadcast a chat message event to all real-time listeners for a syndicate
   */
  public broadcastMessage(syndicateId: string, message: ChatMessage): void {
    this.emit(`chat:${syndicateId}`, { type: "message", payload: message });
  }

  /**
   * Broadcast a message moderation event (report/block)
   */
  public broadcastModeration(
    syndicateId: string,
    messageId: string,
    action: "reported" | "blocked",
    userId?: string
  ): void {
    this.emit(`chat:${syndicateId}`, {
      type: "moderation",
      payload: { messageId, action, userId, timestamp: new Date().toISOString() },
    });
  }

  /**
   * Handle Server-Sent Events (SSE) connection stream for real-time syndicate chat
   */
  public handleSSEStream(req: Request, res: Response, syndicateId: string): void {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) res.flushHeaders();

    // Send initial connection handshake event
    res.write(
      `event: connected\ndata: ${JSON.stringify({ syndicateId, connectedAt: new Date().toISOString() })}\n\n`
    );

    const listener = (event: { type: string; payload: any }) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
    };

    this.on(`chat:${syndicateId}`, listener);

    req.on("close", () => {
      this.off(`chat:${syndicateId}`, listener);
    });
  }
}

export const chatSocketService = new ChatSocketService();
