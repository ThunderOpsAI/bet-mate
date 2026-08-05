const DEFAULT_API_BASE = "/api";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE;

export async function safeResponseJson<T = any>(res: Response): Promise<T | null> {
  try {
    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!text || text.trim().startsWith("<")) {
      return null;
    }
    if (contentType.includes("application/json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
      return JSON.parse(text) as T;
    }
    return null;
  } catch {
    return null;
  }
}

