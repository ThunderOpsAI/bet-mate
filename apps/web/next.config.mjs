/** @type {import('next').NextConfig} */
const DEFAULT_LOCAL_ML_TARGET = "http://127.0.0.1:8000";
const DEFAULT_PRODUCTION_ML_TARGET = "https://thunderops-ai--betmate-prediction-engine-web.modal.run";
const DEFAULT_LOCAL_API_TARGET = "http://127.0.0.1:3001";

const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ],
      },
    ];
  },
  async rewrites() {
    const mlProxyRaw =
      process.env.ML_API_PROXY_TARGET ||
      (process.env.NODE_ENV === "development" ? DEFAULT_LOCAL_ML_TARGET : DEFAULT_PRODUCTION_ML_TARGET);
    const apiProxyTarget =
      process.env.API_PROXY_TARGET ||
      (process.env.NODE_ENV === "development" ? DEFAULT_LOCAL_API_TARGET : "");

    const rewrites = [];

    if (mlProxyRaw) {
      rewrites.push({
        source: "/api/ml-proxy/:path*",
        destination: `${mlProxyRaw.replace(/\/+$/, "")}/:path*`,
      });
    }

    if (apiProxyTarget) {
      rewrites.push({
        source: "/api/:path*",
        destination: `${apiProxyTarget.replace(/\/+$/, "")}/api/:path*`,
      });
    }
    return rewrites;
  },
};

export default nextConfig;
