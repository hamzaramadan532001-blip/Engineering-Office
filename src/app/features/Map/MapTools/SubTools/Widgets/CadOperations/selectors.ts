/**
 * Pure view-model mapping for the intersect operation's spatial read-out.
 *
 * Both renderers of that read-out — the on-screen panel list and the printable PDF
 * sheet — derive their rows from here, so the PDF can never drift from what the panel
 * shows. It is also why exporting re-renders data already in memory instead of
 * re-running the five spatial queries.
 *
 * No React, no ArcGIS: `SpatialContext` in, display rows out.
 */

import { COPY } from "./constants";
import type { IntersectZone } from "./intersect";
import type { ContextMatch, SpatialContext } from "./spatialContext";

const CONTEXT = COPY.intersect.context;

export type ContextRow = {
  /** Stable key — also the Arabic label shown in both renderers. */
  label: string;
  value: string;
  /**
   * Boundary rows render as a yes/no badge rather than free text. `undefined` on the
   * name rows (neighbourhood / municipality / land use), which have no binary answer.
   */
  intersects?: boolean;
};

/** Joins the distinct matches for one layer, or the "not available" placeholder when
 *  the intersection polygon fell outside that layer's published coverage. */
export function matchesLabel(matches: ContextMatch[]): string {
  return matches.length > 0 ? matches.map((match) => match.name).join(" · ") : CONTEXT.none;
}

/**
 * التعارض مع خط التنظيم — whether any part of the drawing falls OUTSIDE the regulation line.
 *
 * Read off the intersect split itself, not a spatial query: a drawing that sits wholly
 * inside the line agrees with the regulation; one with an outside piece does not.
 */
export function conflictsWithRegulation(zones: IntersectZone[]): boolean {
  return zones.includes("outside");
}

/** THE row set for the read-out — the same answers, in the same order, everywhere. */
export function toContextRows(
  context: SpatialContext,
  regulationConflict: boolean,
): ContextRow[] {
  return [
    { label: CONTEXT.neighborhood, value: matchesLabel(context.neighborhoods) },
    { label: CONTEXT.municipality, value: matchesLabel(context.municipalities) },
    { label: CONTEXT.landUse, value: matchesLabel(context.landUses) },
    {
      label: CONTEXT.haram,
      value: context.intersectsHaram ? CONTEXT.inside : CONTEXT.outside,
      intersects: context.intersectsHaram,
    },
    {
      label: CONTEXT.urban,
      value: context.intersectsUrbanBoundary ? CONTEXT.inside : CONTEXT.outside,
      intersects: context.intersectsUrbanBoundary,
    },
    {
      label: CONTEXT.regulationConflict,
      value: regulationConflict ? CONTEXT.yes : CONTEXT.no,
      intersects: regulationConflict,
    },
  ];
}

/**
 * Arabic-locale timestamp stamped on the PDF, so a printed sheet says when it was
 * produced. Gregorian with Arabic numerals — only the Gregorian date is derivable
 * without a Hijri conversion table.
 */
export function formatReportDate(date: Date): string {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

/**
 * The التاريخ line under the engineer's and the manager's signature: the issue DAY only (no
 * time — a signature is dated, not timed), in the same Gregorian calendar and Arabic numerals
 * as `formatReportDate`, so the two dates on the sheet can never read differently.
 */
export function formatSignatureDate(date: Date): string {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { dateStyle: "long" }).format(date);
}

/** Decimal places shown for every شرقيات/شماليات value, on screen and on the PDF. */
export const COORDINATE_DECIMALS = 3;

/**
 * Prints one شرقيات/شماليات value — always to three decimals (millimetres).
 *
 * ONE rule for both places a coordinate is shown: the "قراءة الملف" table and the survey
 * report. They used to disagree — the table printed the file's raw double
 * (`572431.1234…`) while the report rounded — so the same vertex could read differently in
 * two places on the same screen.
 *
 * Rounding is presentation only. The stored and measured values are still the CAD file's own
 * numbers (see sourceSnap.ts), so area and side lengths are unaffected by what is displayed.
 */
export function formatCoordinate(value: number): string {
  return value.toFixed(COORDINATE_DECIMALS);
}
