/**
 * next.config.ts
 * Next.js configuration for Powietrze.
 *
 * Redirects:
 *   /krakow  →  /?city=krakow  (307 — not permanent; route may change in future)
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/krakow",
        destination: "/?city=krakow",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
