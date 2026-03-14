import path from "node:path";
import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const prisma = new PrismaClient();
const app = express();
const memoryUsers = new Map<
  string,
  { id: string; email: string; username: string; passwordHash: string; currentBankroll: number }
>();

app.use(cors());
app.use(express.json());

const apiPort = Number(process.env.API_PORT ?? 3001);
const jwtSecret = process.env.JWT_SECRET ?? "change-me-in-production";

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(8),
  startingBankroll: z.number().positive().default(1000)
});

const loginSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1)
});

app.get("/health", async (_req, res) => {
  let database = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }

  res.json({ ok: true, service: "api", database });
});

app.post("/api/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: parsed.data.email }, { username: parsed.data.username }]
      }
    });
    if (existing) {
      return res.status(409).json({ error: "Email or username already exists" });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        username: parsed.data.username,
        passwordHash,
        startingBankroll: parsed.data.startingBankroll,
        currentBankroll: parsed.data.startingBankroll
      }
    });

    const accessToken = jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: "1h" });
    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        currentBankroll: Number(user.currentBankroll)
      },
      accessToken
    });
  } catch {
    const existingMemoryUser = [...memoryUsers.values()].find(
      (user) => user.email === parsed.data.email || user.username === parsed.data.username
    );
    if (existingMemoryUser) {
      return res.status(409).json({ error: "Email or username already exists" });
    }

    const id = `local-${Date.now()}`;
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const inMemoryUser = {
      id,
      email: parsed.data.email,
      username: parsed.data.username,
      passwordHash,
      currentBankroll: parsed.data.startingBankroll
    };
    memoryUsers.set(id, inMemoryUser);

    const accessToken = jwt.sign({ sub: id }, jwtSecret, { expiresIn: "1h" });
    return res.status(201).json({
      user: {
        id,
        email: inMemoryUser.email,
        username: inMemoryUser.username,
        currentBankroll: inMemoryUser.currentBankroll
      },
      accessToken,
      mode: "fallback"
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: parsed.data.emailOrUsername }, { username: parsed.data.emailOrUsername }]
      }
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const accessToken = jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: "1h" });
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        currentBankroll: Number(user.currentBankroll)
      },
      accessToken
    });
  } catch {
    const user = [...memoryUsers.values()].find(
      (candidate) =>
        candidate.email === parsed.data.emailOrUsername ||
        candidate.username === parsed.data.emailOrUsername
    );
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const accessToken = jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: "1h" });
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        currentBankroll: user.currentBankroll
      },
      accessToken,
      mode: "fallback"
    });
  }
});

app.get("/api/races/today", async (_req, res) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const races = await prisma.race.findMany({
      where: { raceDate: { gte: start, lt: end } },
      orderBy: [{ venue: "asc" }, { raceNumber: "asc" }],
      include: { predictions: true }
    });

    if (races.length === 0) {
      return res.json({
        meetings: [
          {
            venueName: "Sample Park",
            raceDate: start.toISOString().slice(0, 10),
            races: [
              {
                id: "sample-race-1",
                raceNumber: 1,
                postTime: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
                distance: 1400,
                topPicks: [
                  { horseName: "Golden Star", winProbability: 0.29, confidence: "high" },
                  { horseName: "Rapid Queen", winProbability: 0.23, confidence: "medium" },
                  { horseName: "Night Runner", winProbability: 0.19, confidence: "medium" }
                ]
              }
            ]
          }
        ],
        source: "fallback"
      });
    }

    const byVenue = new Map<string, { venueName: string; raceDate: string; races: unknown[] }>();
    for (const race of races) {
      const key = `${race.venue}-${race.raceDate.toISOString().slice(0, 10)}`;
      const topPicks = race.predictions
        .sort((a, b) => b.winProbability - a.winProbability)
        .slice(0, 3)
        .map((p) => ({
          horseName: p.horseName,
          winProbability: p.winProbability,
          confidence: p.confidence
        }));

      if (!byVenue.has(key)) {
        byVenue.set(key, {
          venueName: race.venue,
          raceDate: race.raceDate.toISOString().slice(0, 10),
          races: []
        });
      }

      byVenue.get(key)?.races.push({
        id: race.id,
        raceNumber: race.raceNumber,
        postTime: race.raceDate.toISOString(),
        distance: race.distanceMeters,
        topPicks
      });
    }

    return res.json({ meetings: [...byVenue.values()], source: "database" });
  } catch {
    return res.json({
      meetings: [
        {
          venueName: "Sample Park",
          raceDate: new Date().toISOString().slice(0, 10),
          races: [
            {
              id: "sample-race-1",
              raceNumber: 1,
              postTime: new Date().toISOString(),
              distance: 1400,
              topPicks: [
                { horseName: "Golden Star", winProbability: 0.29, confidence: "high" },
                { horseName: "Rapid Queen", winProbability: 0.23, confidence: "medium" },
                { horseName: "Night Runner", winProbability: 0.19, confidence: "medium" }
              ]
            }
          ]
        }
      ],
      source: "fallback"
    });
  }
});

app.listen(apiPort, () => {
  console.log(`API listening on http://localhost:${apiPort}`);
});
