/** @type {import('next').NextConfig} */
const DEFAULT_PROXY_TARGET = "http://54.79.12.88";
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
      (process.env.NODE_ENV === "production" ? DEFAULT_PROXY_TARGET : "");
    const apiProxyTarget =
      process.env.API_PROXY_TARGET ||
      (process.env.NODE_ENV === "development" ? DEFAULT_LOCAL_API_TARGET : "");

    const rewrites = [];

    if (apiProxyTarget) {
      rewrites.push(
        {
          source: "/api/auth/:path*",
          destination: `${apiProxyTarget}/api/auth/:path*`,
        },
        {
          source: "/api/user/:path*",
          destination: `${apiProxyTarget}/api/user/:path*`,
        },
        {
          source: "/api/races/:path*",
          destination: `${apiProxyTarget}/api/races/:path*`,
        },
        {
          source: "/api/bets/:path*",
          destination: `${apiProxyTarget}/api/bets/:path*`,
        },
      );
    }

    if (!mlProxyRaw) return rewrites;

    let mlProxyTarget = mlProxyRaw;
    try {
      const u = new URL(mlProxyRaw);
      if (u.port === "8000") {
        u.port = "";
        mlProxyTarget = u.toString().replace(/\/$/, "");
      }
    } catch {
      // ignore
    }
    rewrites.push({
      source: "/api/ml-proxy/:path*",
      destination: `${mlProxyTarget}/:path*`,
    });
    return rewrites;
  },
};

export default nextConfig;
