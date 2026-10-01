import type { NextConfig } from "next";

// Set WINDOWS_BUILD=1 to produce a self-hosted artifact (Windows Server / IIS):
// a standalone server with image optimization disabled, so the bundle needs no
// platform-specific `sharp` binary and runs anywhere with just Node. Unset
// (e.g. Vercel) keeps image optimization per the design-system rule.
const isWindowsBuild = process.env.WINDOWS_BUILD === "1";

// The self-hosted build is served under a sub-path on IIS (/gis-viewer-eng).
// Override with BASE_PATH=/other (or BASE_PATH= for the site root). Build-time only:
// changing it needs a rebuild. Mirrored to NEXT_PUBLIC_BASE_PATH for lib/api.ts.
const basePath = isWindowsBuild ? (process.env.BASE_PATH ?? "/gis-viewer-eng") : "";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@makkah-municipality-gis/ui"],
  reactStrictMode: false,
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Outside the WINDOWS_BUILD branch on purpose: unauthorized()/forbidden() must
  // render app/unauthorized.tsx and app/forbidden.tsx in the self-hosted build too.
  experimental: { authInterrupts: true },
  ...(isWindowsBuild
    ? {
        output: "standalone",
        // Trace from the workspace root (this dir) so the workspace packages +
        // hoisted node_modules are bundled into .next/standalone.
        outputFileTracingRoot: __dirname,
        // OS-agnostic: skip the sharp-based optimizer for the self-host bundle.
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
