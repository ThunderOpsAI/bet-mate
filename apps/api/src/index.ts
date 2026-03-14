import path from "node:path";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

import authRoutes from "./routes/auth";
import racesRoutes from "./routes/races";
import betsRoutes from "./routes/bets";
import userRoutes from "./routes/user";

const app = express();
const apiPort = Number(process.env.API_PORT ?? 3001);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/races", racesRoutes);
app.use("/api/bets", betsRoutes);
app.use("/api/user", userRoutes);

app.listen(apiPort, () => {
  console.log(`API listening on http://localhost:${apiPort}`);
});
