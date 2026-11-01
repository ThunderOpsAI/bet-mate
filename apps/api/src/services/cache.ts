import { Redis } from "@upstash/redis";

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlSeconds: number;
}

// In-memory fallback TTL cache if Upstash credentials are not provided or for local dev
const memoryCache = new Map<string, CacheEntry<unknown>>();

let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } catch (err) {
    console.warn("[Cache] Failed to initialize Upstash Redis:", err);
  }
}

export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  bypassCache: boolean = false
): Promise<T> {
  const now = Date.now();

  if (!bypassCache) {
    if (redis) {
      try {
        const cached = await redis.get<T>(key);
        if (cached !== null && cached !== undefined) {
          return cached;
        }
      } catch (err) {
        console.warn(`[Cache] Redis read failure for ${key}:`, err);
      }
    } else {
      const entry = memoryCache.get(key);
      if (entry && now - entry.cachedAt < entry.ttlSeconds * 1000) {
        return entry.data as T;
      }
    }
  }

  const freshData = await fetcher();

  if (redis) {
    try {
      await redis.setex(key, ttlSeconds, freshData);
    } catch (err) {
      console.warn(`[Cache] Redis write failure for ${key}:`, err);
    }
  } else {
    memoryCache.set(key, {
      data: freshData,
      cachedAt: now,
      ttlSeconds,
    });
  }

  return freshData;
}

export function invalidateCache(key: string): void {
  memoryCache.delete(key);
  if (redis) {
    void redis.del(key).catch(() => null);
  }
}
