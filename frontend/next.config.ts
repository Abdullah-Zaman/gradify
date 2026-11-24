import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone (minimal server.js + traced node_modules) for the Docker image.
  // Vercel builds with its own output format, so skip it there.
  output: process.env.VERCEL ? undefined : "standalone",
  // Pin the project root to this folder; otherwise the stray package-lock.json in
  // the repo root makes Next treat the whole repo as the workspace root and nests
  // the standalone output under .next/standalone/frontend/.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
