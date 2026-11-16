import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  experimental: {
    // Photo uploads (gallery, case evidence) go through Server Actions. Next.js accepts 1 MB by
    // default; allow what nginx allows for the dashboard (client_max_body_size 15m), so the
    // gallery's 15 MB limit and case evidence photos work. Only signed-in staff reach these actions.
    serverActions: { bodySizeLimit: '15mb' },
    proxyClientMaxBodySize: '15mb',
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
