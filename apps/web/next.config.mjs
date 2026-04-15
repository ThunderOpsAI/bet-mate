/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const raw = process.env.ML_API_PROXY_TARGET;
    if (!raw) return [];
    // Normalize: if the target points to port 8000, rewrite to port 80
    // (nginx on the Lightsail instance exposes port 80 and proxies to :8000 internally)
    let target = raw;
    try {
      const u = new URL(raw);
      if (u.port === "8000") {
        u.port = "";
        target = u.toString().replace(/\/$/, "");
      }
    } catch {
      // not a valid URL — use as-is
    }
    return [
      {
        source: "/api/ml-proxy/:path*",
        destination: `${target}/:path*`,
      },
    ];
  },
};

export default nextConfig;
