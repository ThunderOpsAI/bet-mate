import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const pythonBin = resolve(rootDir, "services/prediction-engine/venv/bin/python");

if (process.argv.includes("--help")) {
  console.log("Starts the local ML engine on :8000 and the Next web app on :3000.");
  console.log("Usage: pnpm dev:local-stack");
  process.exit(0);
}

if (!existsSync(pythonBin)) {
  console.error(`Missing Python venv at ${pythonBin}`);
  process.exit(1);
}

const processes = [];

function start(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? rootDir,
    stdio: "inherit",
    env: { ...process.env, ...options.env },
  });

  child.on("exit", (code, signal) => {
    const status = signal ? `signal ${signal}` : `code ${code}`;
    console.log(`[${name}] exited with ${status}`);
    shutdown(child);
  });

  processes.push(child);
}

function shutdown(origin) {
  for (const child of processes) {
    if (child === origin || child.killed) continue;
    child.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

import { readFileSync } from "node:fs";

let databaseUrl = process.env.DATABASE_URL;
try {
  const envFile = readFileSync(resolve(rootDir, "packages/prisma/.env"), "utf-8");
  const match = envFile.match(/DATABASE_URL="([^"]+)"/);
  if (match) databaseUrl = match[1];
} catch (e) {}

start(
  "ml-engine",
  pythonBin,
  ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
  { env: { DATABASE_URL: databaseUrl }, cwd: resolve(rootDir, "services/prediction-engine") },
);

start(
  "web",
  "pnpm",
  ["--filter", "@bet-mate/web", "exec", "next", "dev", "-p", "3000", "-H", "127.0.0.1"],
  {
    env: {
      NEXT_PUBLIC_ML_API: "/api/ml-proxy",
      ML_API_PROXY_TARGET: "http://127.0.0.1:8000",
    },
  },
);
