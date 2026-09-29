/**
 * Design-token resolution for ArcGIS symbols.
 *
 * ArcGIS symbol colours are read by the SDK, not the browser's style engine, so they
 * need a real colour string — `var(--token)` never resolves. This reads the computed
 * value of a token off `:root` so symbols stay tied to the design system (CLAUDE.md
 * rule 7) instead of hardcoding the hex the token happens to hold today.
 */

/**
 * Resolves a CSS custom property to its computed value.
 *
 * `fallback` covers the window before the stylesheet applies (SSR, early paint) and
 * should mirror the token's current value from `packages/ui/src/styles`.
 */
export function resolveToken(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
