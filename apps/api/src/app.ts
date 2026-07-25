import path from "node:path";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import authRoutes from "./routes/auth";
import betsRoutes from "./routes/bets";
import racesRoutes from "./routes/races";
import userRoutes from "./routes/user";

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

export default app;
