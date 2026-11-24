import path from "path";
import type { NextConfig } from "next";

const onVercel = !!process.env.VERCEL;

// Local and Docker builds: pin the workspace root to this folder so a stray
// lockfile higher up can't make Next treat a parent directory as the root.
//
// Vercel: don't pin. The Vercel builder (Root Directory = "frontend") locates
// the app as <repo root>/<path of app relative to outputFileTracingRoot>. With
// the root pinned to frontend/ that relative path is "", so it looks for
// /vercel/path0/.next/package.json instead of /vercel/path0/frontend/.next/...
// and the deploy fails with ENOENT after the build completes.
const rootPin: Pick<NextConfig, "outputFileTracingRoot" | "turbopack"> = onVercel
  ? {}
  : {
      outputFileTracingRoot: path.join(__dirname),
      turbopack: { root: path.join(__dirname) },
    };

const nextConfig: NextConfig = {
  // Emits .next/standalone (minimal server.js + traced node_modules) for the Docker image.
  // Vercel builds with its own output format, so skip it there.
  output: onVercel ? undefined : "standalone",
  ...rootPin,
};

export default nextConfig;
