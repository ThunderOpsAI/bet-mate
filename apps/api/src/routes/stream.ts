import { Router, Request, Response } from "express";

const router = Router();

export interface OddsTick {
  marketId: string;
  runnerId?: string;
  bestBack: number;
  bestLay?: number;
  timestamp: number;
}

interface SSEClient {
  id: string;
  res: Response;
  marketIds: Set<string>;
}

const clients = new Map<string, SSEClient>();

export function broadcastOddsUpdate(update: OddsTick): void {
  const payload = `event: price_update\ndata: ${JSON.stringify(update)}\n\n`;
  for (const client of clients.values()) {
    if (client.marketIds.size === 0 || client.marketIds.has(update.marketId)) {
      try {
        client.res.write(payload);
      } catch {
        clients.delete(client.id);
      }
    }
  }
}

// GET /api/stream/odds (or /api/stream)
router.get("/odds", (req: Request, res: Response) => {
  const marketIdParam = (req.query.marketId || req.query.marketIds) as string | undefined;
  const marketIds = new Set<string>();
  if (marketIdParam) {
    marketIdParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((id) => marketIds.add(id));
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const client: SSEClient = { id: clientId, res, marketIds };
  clients.set(clientId, client);

  // Send initial connected confirmation
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      clientId,
      marketIds: Array.from(marketIds),
      timestamp: Date.now(),
    })}\n\n`
  );

  // Keep-alive heartbeat every 15s to prevent timeouts across serverless gateways
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
    } catch {
      clearInterval(heartbeat);
      clients.delete(clientId);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
  });
});

export default router;
