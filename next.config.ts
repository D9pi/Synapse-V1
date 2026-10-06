import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle that the desktop app (Electron) runs locally.
  output: "standalone",
  // No next/image usage; skipping the optimizer keeps the desktop bundle small.
  images: { unoptimized: true },
  cacheComponents: true,
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
