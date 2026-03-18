import type { NextConfig } from "next";

const ENGINE_URL = process.env.ENGINE_URL || "https://claw-wars-production.up.railway.app";
const WS_ENGINE_URL = process.env.WS_ENGINE_URL || "https://claw-wars-production.up.railway.app";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/engine/:path*",
        destination: `${ENGINE_URL}/:path*`,
      },
      {
        source: "/ws",
        destination: WS_ENGINE_URL,
      },
    ];
  },
};

export default nextConfig;
