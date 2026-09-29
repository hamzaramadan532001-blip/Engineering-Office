import path from "node:path";
import type { NextConfig } from "next";

// Set WINDOWS_BUILD=1 to produce a self-hosted artifact (Windows Server / IIS):
// a standalone server with image optimization disabled, so the bundle needs no
// platform-specific `sharp` binary and runs anywhere with just Node. Unset
// (e.g. Vercel) keeps image optimization per the design-system rule.
const isWindowsBuild = process.env.WINDOWS_BUILD === "1";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@makkah-municipality-gis/ui"],
  reactStrictMode: false,
  // Outside the WINDOWS_BUILD branch on purpose: unauthorized()/forbidden() must
  // render app/unauthorized.tsx and app/forbidden.tsx in the self-hosted build too.
  experimental: { authInterrupts: true },
  ...(isWindowsBuild
    ? {
        output: "standalone",
        // Monorepo: trace from the repo root so the workspace UI package +
        // hoisted node_modules are bundled into .next/standalone.
        outputFileTracingRoot: path.join(__dirname, "../../"),
        // OS-agnostic: skip the sharp-based optimizer for the self-host bundle.
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
