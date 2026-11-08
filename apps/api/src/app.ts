/**
 * Core Express API server application.
 * Mounts domain route handlers for racing feeds, strategy engines, bankroll
 * ledger, syndicates, and user session management.
 */

import path from "node:path";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import authRoutes from "./routes/auth";
import betsRoutes from "./routes/bets";
import racesRoutes from "./routes/races";
import userRoutes from "./routes/user";
import leaderboardsRoutes from "./routes/leaderboards";
import cronRoutes from "./routes/cron";
import blackbookRoutes from "./routes/blackbook";
import searchRoutes from "./routes/search";
import combinationsRoutes from "./routes/combinations";
import notificationsRoutes from "./routes/notifications";
import chatRoutes from "./routes/chat";
import syndicatesRoutes from "./routes/syndicates";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import prisma from "./services/prisma";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api", timestamp: new Date().toISOString() });
});

app.get("/health/db", async (_req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ ok: true, userCount });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/races", racesRoutes);
app.use("/api/bets", betsRoutes);
app.use("/api/user", userRoutes);
app.use("/api/leaderboards", leaderboardsRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/blackbook", blackbookRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/combinations", combinationsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/syndicates", syndicatesRoutes);

import exploreRoutes from "./routes/explore";
import adminRoutes from "./routes/admin";

app.use("/api/explore", exploreRoutes);
app.use("/api/admin", adminRoutes);

import eventsRoutes from "./routes/events";
import situationalRoutes from "./routes/situational";

app.use("/api/events", eventsRoutes);
app.use("/api/situational", situationalRoutes);

import evFeedRoutes from "./routes/evFeed";
app.use("/api/ev-feed", evFeedRoutes);

import recommendationsRoutes from "./routes/recommendations";
app.use("/api/recommendations", recommendationsRoutes);

import multisRoutes from "./routes/multis";
app.use("/api/multis", multisRoutes);

import statsRoutes from "./routes/stats";
app.use("/api/stats", statsRoutes);

import slipsRoutes from "./routes/slips";
app.use("/api/slips", slipsRoutes);

import userPreferencesRoutes from "./routes/userPreferences";
app.use("/api/user-preferences", userPreferencesRoutes);

import savedScreensRoutes from "./routes/savedScreens";
app.use("/api/saved-screens", savedScreensRoutes);

import alertsRoutes from "./routes/alerts";
app.use("/api/alerts", alertsRoutes);

import trustRoutes from "./routes/trust";
app.use("/api/trust", trustRoutes);

import streamRoutes from "./routes/stream";
app.use("/api/stream", streamRoutes);
app.use("/api/odds/stream", streamRoutes);

export default app;
