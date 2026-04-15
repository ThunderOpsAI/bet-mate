/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const target = process.env.ML_API_PROXY_TARGET;
    if (!target) return [];
    return [
      {
        source: "/api/ml-proxy/:path*",
        destination: `${target}/:path*`,
      },
    ];
  },
};

export default nextConfig;
