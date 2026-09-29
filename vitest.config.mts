import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromApp = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Vitest config for the gis-viewer workspace. jsdom by default because the suites
 * that exist render React (the permission gates); the `@/*` → `src/*` alias mirrors
 * tsconfig.json so test imports match app code. The nafath suites stay on
 * `node --test` (see the `test:node` script) — they are ESM `.mjs` by design.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: fromApp("./src") },
      // packages/ui and Mantine resolve their own React copy in the pnpm store; two
      // copies in one renderer break hooks. Pin every import to the app's React.
      { find: /^react$/, replacement: fromApp("./node_modules/react") },
      { find: /^react-dom$/, replacement: fromApp("./node_modules/react-dom") },
      { find: /^react\/(.*)$/, replacement: `${fromApp("./node_modules/react")}/$1` },
      { find: /^react-dom\/(.*)$/, replacement: `${fromApp("./node_modules/react-dom")}/$1` },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    // Mantine and its React-consuming deps must go through Vite (not Node), so the
    // React alias above applies to them too.
    server: { deps: { inline: [/@mantine\//, /@floating-ui\//, /react-remove-scroll/] } },
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
