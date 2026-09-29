"use client";

/**
 * The QR code printed in the report's باركود box: a Google Maps link to the site.
 *
 * Scanning it opens the plot's location on a phone, which is what a field inspector holding
 * the printed sheet actually needs.
 *
 * The point is taken from the CAD drawing itself rather than from the map view — the report
 * must describe the property, not wherever the user happened to be looking when they
 * exported.
 *
 * Generated locally with `qrcode`. Deliberately not an image service such as
 * api.qrserver.com: that would send a citizen's plot coordinates to a third party on every
 * export, and would put the report's contents behind someone else's uptime.
 */

import type EsriPolygon from "@arcgis/core/geometry/Polygon";
import * as labelPointOperator from "@arcgis/core/geometry/operators/labelPointOperator.js";
import { resolveToken } from "@/lib/designTokens";

export type SiteLocation = {
  /** WGS84 latitude. */
  latitude: number;
  /** WGS84 longitude. */
  longitude: number;
};

/** Decimal places kept in the link — ~1 cm, far finer than a plot needs and short enough to
 *  keep the QR's error correction comfortable. */
const COORDINATE_PRECISION = 6;

/**
 * The plot's centre in WGS84.
 *
 * `polygon` must be in WGS84 (4326) — the intersect pipeline works in it throughout, so the
 * geometry handed here already is. A polygon in any other spatial reference would silently
 * produce a point in the sea, so the spatial reference is checked rather than assumed.
 */
export function siteLocationOf(polygon: EsriPolygon | null | undefined): SiteLocation | null {
  if (!polygon) return null;

  const wkid = polygon.spatialReference?.wkid;
  if (wkid !== undefined && wkid !== 4326) {
    console.warn(`[CAD ops] site location skipped: polygon is WKID ${wkid}, expected 4326.`);
    return null;
  }

  // A label point, not the centroid: it is guaranteed to lie INSIDE the polygon, whereas the
  // centroid of an L- or U-shaped plot can land on the neighbour's land. (`polygon.centroid`
  // is also deprecated in the SDK.) For a multi-part drawing it sits in the largest part.
  let point: { x: number; y: number } | null;
  try {
    point = labelPointOperator.execute(polygon);
  } catch (error) {
    console.warn("[CAD ops] label point failed, falling back to the extent centre:", error);
    point = polygon.extent?.center ?? null;
  }
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

  return { latitude: point.y, longitude: point.x };
}

/**
 * A Google Maps link that drops a pin on the site.
 *
 * `?q=lat,lng` is the documented, long-lived form: it opens in the Google Maps app on a
 * phone and in the browser everywhere else, with no API key.
 */
export function googleMapsUrl(location: SiteLocation): string {
  const latitude = location.latitude.toFixed(COORDINATE_PRECISION);
  const longitude = location.longitude.toFixed(COORDINATE_PRECISION);
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

/**
 * A PNG data URL of the QR code for that link, or `null` if it cannot be produced.
 *
 * A data URL (not a canvas or an SVG) because the sheet is rasterised by html2canvas for the
 * PDF: an `<img>` with inline data is the one form that survives that step without needing
 * the library to resolve anything.
 *
 * Never throws — a missing QR leaves the box empty, which must not stop the export.
 */
export async function siteQrDataUrl(location: SiteLocation): Promise<string | null> {
  try {
    // Loaded on demand so the encoder stays out of the main map bundle, like jsPDF.
    const QRCode = (await import("qrcode")).default;

    return await QRCode.toDataURL(googleMapsUrl(location), {
      errorCorrectionLevel: "M",
      margin: 1,
      // Generated well above its printed size so it stays sharp after the sheet is
      // rasterised and scaled into the PDF.
      width: 512,
      // `qrcode` needs literal hex, so the tokens are resolved here. The alpha-* primitives,
      // not --text-default/--surface-page: those flip in the dark theme, and a printed QR
      // must stay dark-on-white regardless of the viewer's theme.
      color: {
        dark: resolveToken("--alpha-black-100", "#161616"),
        light: resolveToken("--alpha-white-100", "#FFFFFF"),
      },
    });
  } catch (error) {
    console.error("[CAD ops] failed to generate the site QR code:", error);
    return null;
  }
}
