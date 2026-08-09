const DEFAULT_TIMEOUT_MS = 30000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
) {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();

  // Ensure timer works in both Node.js (SSR) and browser environments
  const timer = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      // Ignore abort errors
    }
  }, timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.warn(`[fetchWithTimeout] Request to ${String(input)} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
