export const ML_DATA_CACHE_TTL_MS = 5 * 60 * 1000;
export const ML_DATA_CACHE_RETRY_MS = 60 * 1000;

const ML_DATA_CACHE_NAMESPACE = "betmate:ml-data-cache:v1";

const memoryCache = new Map<string, MlDataCacheEntry<unknown>>();
const inflightCache = new Map<string, Promise<MlDataCacheEntry<unknown>>>();

export type MlDataCacheEntry<T> = {
  data: T;
  lastUpdated: number;
  nextRefreshAt: number;
  ttlMs: number;
};

function getStorageKey(key: string) {
  return `${ML_DATA_CACHE_NAMESPACE}:${key}`;
}

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isMlDataCacheEntry(value: unknown): value is MlDataCacheEntry<unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<MlDataCacheEntry<unknown>>;
  return (
    "data" in candidate &&
    typeof candidate.lastUpdated === "number" &&
    typeof candidate.nextRefreshAt === "number" &&
    typeof candidate.ttlMs === "number"
  );
}

function persistMlDataCache<T>(key: string, entry: MlDataCacheEntry<T>) {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(getStorageKey(key), JSON.stringify(entry));
  } catch {
    // Ignore storage quota and privacy-mode failures. In-memory cache still works.
  }
}

function hydrateMlDataCache<T>(key: string): MlDataCacheEntry<T> | null {
  const storage = getSessionStorage();

  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(getStorageKey(key));
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isMlDataCacheEntry(parsed)) {
      storage.removeItem(getStorageKey(key));
      return null;
    }

    memoryCache.set(key, parsed);
    return parsed as MlDataCacheEntry<T>;
  } catch {
    return null;
  }
}

export function getMlCacheDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

export function getMlDataCacheKey(
  kind: "fixtures" | "predictions",
  sport: "racing" | "afl" | "nba" | "nrl" | "soccer" | "golf" | "mma",
  dateKey: string,
) {
  return `${kind}:${sport}:${dateKey}`;
}

export function readMlDataCache<T>(key: string): MlDataCacheEntry<T> | null {
  const cached = memoryCache.get(key);

  if (cached) {
    return cached as MlDataCacheEntry<T>;
  }

  return hydrateMlDataCache<T>(key);
}

export function writeMlDataCache<T>(
  key: string,
  data: T,
  options?: {
    updatedAt?: number;
    ttlMs?: number;
  },
) {
  const lastUpdated = options?.updatedAt ?? Date.now();
  const ttlMs = options?.ttlMs ?? ML_DATA_CACHE_TTL_MS;

  const entry: MlDataCacheEntry<T> = {
    data,
    lastUpdated,
    nextRefreshAt: lastUpdated + ttlMs,
    ttlMs,
  };

  memoryCache.set(key, entry);
  persistMlDataCache(key, entry);

  return entry;
}

export function isMlDataCacheStale(
  entry: MlDataCacheEntry<unknown> | null | undefined,
  now = Date.now(),
) {
  if (!entry) {
    return true;
  }

  return entry.nextRefreshAt <= now;
}

export function scheduleMlDataCacheRetry(
  key: string,
  retryInMs = ML_DATA_CACHE_RETRY_MS,
) {
  const cached = readMlDataCache(key);

  if (!cached) {
    return null;
  }

  const nextEntry = {
    ...cached,
    nextRefreshAt: Date.now() + retryInMs,
  };

  memoryCache.set(key, nextEntry);
  persistMlDataCache(key, nextEntry);

  return nextEntry;
}

export function getMlDataCacheMetadata(keys: string[]) {
  const entries = keys
    .map((key) => readMlDataCache(key))
    .filter((entry): entry is MlDataCacheEntry<unknown> => entry !== null);

  if (entries.length === 0) {
    return {
      lastUpdated: null as number | null,
      nextRefreshAt: null as number | null,
    };
  }

  return {
    lastUpdated: Math.min(...entries.map((entry) => entry.lastUpdated)),
    nextRefreshAt: Math.min(...entries.map((entry) => entry.nextRefreshAt)),
  };
}

export async function refreshMlDataCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    force?: boolean;
    ttlMs?: number;
  },
) {
  const cached = readMlDataCache<T>(key);
  if (!options?.force && cached && !isMlDataCacheStale(cached)) {
    return cached;
  }

  const inflight = inflightCache.get(key);
  if (inflight) {
    return inflight as Promise<MlDataCacheEntry<T>>;
  }

  const request = (async () => {
    const data = await fetcher();
    return writeMlDataCache(key, data, { ttlMs: options?.ttlMs });
  })();

  inflightCache.set(key, request);

  try {
    return await request;
  } finally {
    inflightCache.delete(key);
  }
}
