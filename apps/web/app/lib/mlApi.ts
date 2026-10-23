const DEFAULT_ML_API_PROXY_PATH = "/api/ml-proxy";

export function normalizeMlApiUrl(rawUrl = process.env.NEXT_PUBLIC_ML_API) {
  const candidate = rawUrl?.trim() || DEFAULT_ML_API_PROXY_PATH;
  if (!candidate.startsWith("/")) {
    return DEFAULT_ML_API_PROXY_PATH;
  }
  return candidate.replace(/\/+$/, "") || DEFAULT_ML_API_PROXY_PATH;
}

export const ML_API = normalizeMlApiUrl();
