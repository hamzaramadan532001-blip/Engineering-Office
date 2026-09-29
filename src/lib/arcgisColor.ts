"use client";

/**
 * Design-token hex → ArcGIS `Color`, for symbols (which cannot read CSS variables).
 *
 * Shared: the map's CAD layers, the regulation styles (src/lib/regulationStyles.ts) and the
 * admin request map all convert token colours the same way.
 */

import Color from "@arcgis/core/Color";

export function hexToRgba(hex: string, opacityPercent: number): Color {
  const clean = hex.replace("#", "");
  const bigint = Number.parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return new Color([r, g, b, Math.max(0, Math.min(100, opacityPercent)) / 100]);
}
