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
      email: `user_${Date.now()}@betmate.internal`,
      username: `bettor_${Date.now().toString().slice(-4)}`,
      passwordHash: "unauthenticated",
      currentBankroll: 10000,
    },
  });
  return demoUser.id;
}

const preferenceSchema = z.object({
  sports: z.array(z.string()).default([]),
  favoriteTeams: z.array(z.string()).default([]),
  riskTolerance: z.enum(["SAFE", "BALANCED", "LONG_SHOT"]).default("BALANCED"),
  onboarded: z.boolean().default(true),
});

// GET /api/user-preferences
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = await getEffectiveUserId(req);

    const preference = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      return res.json({
        data: null,
        onboarded: false,
        status: "empty",
        message: "No user preferences recorded yet. Onboarding required.",
      });
    }

    return res.json({
      data: preference,
      onboarded: preference.onboarded,
      status: "ok",
    });
  } catch (error: any) {
    console.error("Error fetching user preferences:", error);
    return res.status(500).json({ error: "Failed to fetch user preferences" });
  }
});

// POST /api/user-preferences
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = preferenceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid preference payload",
        details: parsed.error.flatten(),
      });
    }

    const userId = await getEffectiveUserId(req);
    const { sports, favoriteTeams, riskTolerance, onboarded } = parsed.data;

    const preference = await prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        sports,
        favoriteTeams,
        riskTolerance,
        onboarded,
      },
      update: {
        sports,
        favoriteTeams,
        riskTolerance,
        onboarded,
      },
    });

    return res.status(200).json({
      success: true,
      data: preference,
      status: "ok",
    });
  } catch (error: any) {
    console.error("Error saving user preferences:", error);
    return res.status(500).json({ error: "Failed to save user preferences" });
  }
});

export default router;
