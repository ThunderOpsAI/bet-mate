import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET ?? "change-me-in-production";

const memoryUsers = new Map<
  string,
  { id: string; email: string; username: string; passwordHash: string; currentBankroll: number }
>();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(8),
  startingBankroll: z.number().positive().default(1000),
});

const loginSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
});

function makeToken(userId: string) {
  return jwt.sign({ sub: userId }, jwtSecret, { expiresIn: "30d" });
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: parsed.data.email }, { username: parsed.data.username }] },
    });
    if (existing) return res.status(409).json({ error: "Email or username already exists" });

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        username: parsed.data.username,
        passwordHash,
        startingBankroll: parsed.data.startingBankroll,
        currentBankroll: parsed.data.startingBankroll,
      },
    });

    return res.status(201).json({
      user: { id: user.id, email: user.email, username: user.username, currentBankroll: Number(user.currentBankroll) },
      accessToken: makeToken(user.id),
    });
  } catch {
    // Fallback: in-memory registration
    const existingMem = [...memoryUsers.values()].find(
      (u) => u.email === parsed.data.email || u.username === parsed.data.username
    );
    if (existingMem) return res.status(409).json({ error: "Email or username already exists" });

    const id = `local-${Date.now()}`;
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const u = { id, email: parsed.data.email, username: parsed.data.username, passwordHash, currentBankroll: parsed.data.startingBankroll };
    memoryUsers.set(id, u);

    return res.status(201).json({
      user: { id, email: u.email, username: u.username, currentBankroll: u.currentBankroll },
      accessToken: makeToken(id),
      mode: "fallback",
    });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: parsed.data.emailOrUsername }, { username: parsed.data.emailOrUsername }] },
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    return res.json({
      user: { id: user.id, email: user.email, username: user.username, currentBankroll: Number(user.currentBankroll) },
      accessToken: makeToken(user.id),
    });
  } catch {
    const user = [...memoryUsers.values()].find(
      (c) => c.email === parsed.data.emailOrUsername || c.username === parsed.data.emailOrUsername
    );
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    return res.json({
      user: { id: user.id, email: user.email, username: user.username, currentBankroll: user.currentBankroll },
      accessToken: makeToken(user.id),
      mode: "fallback",
    });
  }
});

export default router;
