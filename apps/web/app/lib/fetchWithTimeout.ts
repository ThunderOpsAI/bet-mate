const DEFAULT_TIMEOUT_MS = 60000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
) {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();

  let callerAbortHandler: (() => void) | undefined;
  if (init?.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      callerAbortHandler = () => controller.abort();
      init.signal.addEventListener("abort", callerAbortHandler, { once: true });
    }
  }

  // Ensure timer works in both Node.js (SSR) and browser environments
  const timer = setTimeout(() => {
    try {
      controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
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
    if (init?.signal && callerAbortHandler) {
      init.signal.removeEventListener("abort", callerAbortHandler);
    }
  }
}
