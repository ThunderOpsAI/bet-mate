export const DEFAULT_PRODUCTION_ML_TARGET =
  "https://thunderops-ai--betmate-prediction-engine-web.modal.run";

export function getMlApiUrl(): string {
  const envUrl = process.env.ML_API_URL || process.env.ML_API_PROXY_TARGET;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:8000";
  }
  return DEFAULT_PRODUCTION_ML_TARGET;
}
