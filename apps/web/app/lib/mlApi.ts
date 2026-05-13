const DEFAULT_ML_API_PROXY_PATH = "/api/ml-proxy";
const ML_API_PROXY_PREFIX = `${DEFAULT_ML_API_PROXY_PATH}/`;

export function normalizeMlApiUrl(rawUrl = process.env.NEXT_PUBLIC_ML_API) {
  const candidate = rawUrl?.trim() || DEFAULT_ML_API_PROXY_PATH;
  // Browser-side ML calls must stay same-origin; next.config.mjs rewrites this
  // path to the env-driven ML_API_PROXY_TARGET on the server.
  if (
    candidate !== DEFAULT_ML_API_PROXY_PATH &&
    !candidate.startsWith(ML_API_PROXY_PREFIX)
  ) {
    return DEFAULT_ML_API_PROXY_PATH;
  }
  return candidate.replace(/\/+$/, "") || DEFAULT_ML_API_PROXY_PATH;
}

export const ML_API = normalizeMlApiUrl();
