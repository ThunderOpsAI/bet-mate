const LOCAL_ML_API = "http://localhost:8000";
const PRODUCTION_ML_API = "https://bet-mateprediction-engine-production.up.railway.app";

const DEFAULT_ML_API =
  process.env.NODE_ENV === "production" ? PRODUCTION_ML_API : LOCAL_ML_API;

const HAS_PROTOCOL = /^https?:\/\//i;
const LOCAL_HOST = /^(localhost|127(?:\.\d{1,3}){3})(?::\d+)?(?:\/|$)/i;

function withProtocol(url: string) {
  if (HAS_PROTOCOL.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (LOCAL_HOST.test(url)) return `http://${url}`;
  return `https://${url}`;
}

export function normalizeMlApiUrl(rawUrl = process.env.NEXT_PUBLIC_ML_API) {
  const candidate = rawUrl?.trim() || DEFAULT_ML_API;
  return withProtocol(candidate).replace(/\/+$/, "");
}

export const ML_API = normalizeMlApiUrl();
