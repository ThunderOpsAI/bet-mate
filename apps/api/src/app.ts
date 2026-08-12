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

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api", timestamp: new Date().toISOString() });
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

export default app;
