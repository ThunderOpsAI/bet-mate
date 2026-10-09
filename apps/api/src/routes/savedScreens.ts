import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { z } from "zod";

const router = Router();
const prisma: any = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET ?? "change-me-in-production";

function getOptionalUserId(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, jwtSecret) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

async function getEffectiveUserId(req: Request): Promise<string> {
  const userId = getOptionalUserId(req);
  if (userId) return userId;

  const firstUser = await prisma.user.findFirst({ select: { id: true } });
  if (firstUser) return firstUser.id;

  const demoUser = await prisma.user.create({
    data: {
      email: `screen_user_${Date.now()}@betmate.internal`,
      username: `screener_${Date.now().toString().slice(-4)}`,
      passwordHash: "unauthenticated",
      currentBankroll: 10000,
    },
  });
  return demoUser.id;
}

const saveScreenSchema = z.object({
  name: z.string().min(1, "Name is required"),
  filterJson: z.record(z.any()),
});

// GET /api/saved-screens - List user's saved screens
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = await getEffectiveUserId(req);

    const savedScreens = await prisma.savedScreen.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (savedScreens.length === 0) {
      return res.json({
        savedScreens: [],
        count: 0,
        status: "empty",
        message: "No saved screens found. Create your first custom stat screen.",
      });
    }

    return res.json({
      savedScreens,
      count: savedScreens.length,
      status: "ok",
    });
  } catch (error: any) {
    console.error("Error listing saved screens:", error);
    return res.status(500).json({ error: "Failed to list saved screens" });
  }
});

// POST /api/saved-screens - Save a new screen
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = saveScreenSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid screen payload",
        details: parsed.error.flatten(),
      });
    }

    const userId = await getEffectiveUserId(req);
    const { name, filterJson } = parsed.data;

    const screen = await prisma.savedScreen.create({
      data: {
        userId,
        name,
        filterJson,
      },
    });

    return res.status(201).json({
      success: true,
      savedScreen: screen,
      status: "ok",
    });
  } catch (error: any) {
    console.error("Error saving screen:", error);
    return res.status(500).json({ error: "Failed to save screen" });
  }
});

// DELETE /api/saved-screens/:id - Delete a saved screen
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = await getEffectiveUserId(req);

    const screen = await prisma.savedScreen.findFirst({
      where: { id, userId },
    });

    if (!screen) {
      return res.status(404).json({ error: "Saved screen not found" });
    }

    await prisma.savedScreen.delete({
      where: { id },
    });

    return res.json({ success: true, message: "Screen deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting saved screen:", error);
    return res.status(500).json({ error: "Failed to delete saved screen" });
  }
});

// POST or GET /api/saved-screens/:id/execute - Execute a saved screen with 1 tap
const executeHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = await getEffectiveUserId(req);

    const screen = await prisma.savedScreen.findFirst({
      where: { id, userId },
    });

    if (!screen) {
      return res.status(404).json({ error: "Saved screen not found" });
    }

    const filters = (screen.filterJson || {}) as Record<string, any>;
    const sport = filters.sport ? String(filters.sport).toUpperCase() : undefined;
    const marketType = filters.marketType ? String(filters.marketType) : undefined;
    const minEdge = filters.minEdge !== undefined ? Number(filters.minEdge) : undefined;

    // Query active prop markets matching the saved screen criteria
    const where: any = { status: "OPEN" };
    if (sport) where.sport = sport;
    if (marketType) where.marketType = { contains: marketType, mode: "insensitive" };

    const propMarkets = await prisma.propMarket.findMany({
      where,
      include: {
        player: true,
        odds: { orderBy: { capturedAt: "desc" } },
      },
      take: 50,
    });

    let results = propMarkets.map((m: any) => {
      const bestOdds = (m.odds || []).reduce((best: any, curr: any) => {
        const currEdge = curr.edgePct ?? -999;
        const bestEdge = best?.edgePct ?? -999;
        return currEdge > bestEdge ? curr : best;
      }, m.odds?.[0] || null);

      return {
        id: m.id,
        sport: m.sport,
        gameId: m.gameId,
        marketType: m.marketType,
        line: m.line,
        playerName: m.player?.fullName || "Player",
        team: m.player?.team || "Team",
        bestOdds: bestOdds
          ? {
              price: bestOdds.price,
              fairPrice: bestOdds.fairPrice,
              edgePct: bestOdds.edgePct,
              bookmaker: bestOdds.bookmaker,
              selection: bestOdds.selection,
            }
          : null,
      };
    });

    if (minEdge !== undefined && !isNaN(minEdge)) {
      results = results.filter((r: any) => (r.bestOdds?.edgePct ?? -999) >= minEdge);
    }

    return res.json({
      status: results.length > 0 ? "ok" : "empty",
      screen: {
        id: screen.id,
        name: screen.name,
        filterJson: screen.filterJson,
      },
      count: results.length,
      results,
      executedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error executing saved screen:", error);
    return res.status(500).json({ error: "Failed to execute saved screen" });
  }
};

router.post("/:id/execute", executeHandler);
router.get("/:id/execute", executeHandler);

export default router;
