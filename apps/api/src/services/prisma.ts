import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

// Node.js environments require an explicit WebSocket constructor
neonConfig.webSocketConstructor = ws;

function getPooledConnectionString(url: string | undefined): string | undefined {
  if (!url) return undefined;
  // If it's a neon database URL and missing -pooler, ensure pooler host is used
  // Neon format: ep-subdomain-12345.region.aws.neon.tech -> ep-subdomain-12345-pooler.region.aws.neon.tech
  if (url.includes(".neon.tech") && !url.includes("-pooler")) {
    return url.replace(/@([^/.]+)(\.[^/]+)/, "@$1-pooler$2");
  }
  return url;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  neonPool: Pool | undefined;
};

export function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;
  const connectionString = getPooledConnectionString(rawUrl);

  if (connectionString) {
    try {
      const adapter = new PrismaNeon({ connectionString });
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      });
    } catch (err) {
      console.warn("[Prisma] Failed to initialize Neon driver adapter, falling back to standard client:", err);
    }
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// In serverless environments (e.g. Vercel), preserve connection pool across warm container invocations
globalForPrisma.prisma = prisma;

export default prisma;
