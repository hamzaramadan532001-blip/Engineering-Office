/**
 * Restores the CAD file's OWN coordinates on the survey report.
 *
 * The problem this solves: the intersection polygon reaches the report by a round trip.
 * The file's easting/northing are reprojected to WGS84 so the drawing can be put on the
 * map (GeoJSON is lon/lat by spec), the intersection with the regulation boundary is
 * computed there, and the result is projected back to metres for the report. Forward and
 * inverse Transverse Mercator are not exact in floating point, so the numbers that come
 * back are a re-derivation of the file's coordinates, not the file's coordinates — they
 * can differ in the last printed decimals from the شرقيات/شماليات table the user saw at
 * "قراءة الملف".
 *
 * On a survey report (تقرير مساحي) that difference matters: the sheet has to state the
 * submitted file's coordinates verbatim. So every projected vertex that corresponds to a
 * vertex of the CAD file is replaced by that file vertex, bit for bit.
 *
 * Vertices the clip CREATED — where the CAD outline crosses the regulation boundary —
 * have no counterpart in the file and keep their projected value. They cannot "appear as
 * in the file" because they are not in it; they are new points on the boundary.
 *
 * Snapping happens on the RINGS, before any measurement, so the area, the side lengths
 * and the sketch are all derived from the file's own numbers too — not just the table.
 *
 * No React, no ArcGIS: plain arrays in, plain arrays out.
 */

import type { GeoJSONFeatureCollection } from "../CadUploadTool/geometry";

type Pt = [number, number];

/**
 * How far a projected vertex may sit from a file vertex and still be considered the same
 * point, in METRES (the source CRS is projected — see CadUploadTool/constants.ts).
 *
 * 1 cm is ~2 orders of magnitude above the round-trip error being corrected (well under a
 * millimetre) and far below the spacing of any two genuinely distinct survey vertices, so
 * it cannot pull a vertex onto its neighbour.
 */
const SNAP_TOLERANCE_M = 0.01;

/** Grid cell for the lookup, in metres. Must be ≥ the tolerance so a match is always
 *  either in the vertex's own cell or one of the 8 around it. */
const CELL_SIZE_M = 1;

export type SourceVertexIndex = {
  /** Cell key → the file vertices falling in that cell. */
  cells: Map<string, Pt[]>;
  /** How many vertices were indexed — 0 means "nothing to snap to". */
  size: number;
};

function cellKey(x: number, y: number): string {
  return `${Math.floor(x / CELL_SIZE_M)}|${Math.floor(y / CELL_SIZE_M)}`;
}

/** Walks every coordinate of a GeoJSON geometry, whatever its type. */
function eachCoordinate(coordinates: unknown, visit: (point: Pt) => void): void {
  if (!Array.isArray(coordinates)) return;

  // A coordinate pair is [number, number] — anything else is a nested container.
  if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    visit([coordinates[0] as number, coordinates[1] as number]);
    return;
  }

  for (const child of coordinates) eachCoordinate(child, visit);
}

/**
 * Indexes every vertex of the CAD collection **in the file's own CRS**.
 *
 * Deliberately flattens across all features and geometry types, exactly as
 * `extractCoordinateRows` does for the "قراءة الملف" table — so the set of points the
 * report can snap to is precisely the set of points that table lists.
 */
export function indexSourceVertices(collection: GeoJSONFeatureCollection): SourceVertexIndex {
  const cells = new Map<string, Pt[]>();
  let size = 0;

  for (const feature of collection.features) {
    if (!feature.geometry) continue;

    eachCoordinate(feature.geometry.coordinates, (point) => {
      const key = cellKey(point[0], point[1]);
      const bucket = cells.get(key);
      if (bucket) bucket.push(point);
      else cells.set(key, [point]);
      size += 1;
    });
  }

  return { cells, size };
}

/** The indexed file vertex closest to `(x, y)` within the tolerance, or null. */
function nearestSourceVertex(index: SourceVertexIndex, x: number, y: number): Pt | null {
  const cx = Math.floor(x / CELL_SIZE_M);
  const cy = Math.floor(y / CELL_SIZE_M);

  let best: Pt | null = null;
  let bestDistance = SNAP_TOLERANCE_M;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const bucket = index.cells.get(`${cx + dx}|${cy + dy}`);
      if (!bucket) continue;

      for (const candidate of bucket) {
        const distance = Math.hypot(candidate[0] - x, candidate[1] - y);
        if (distance <= bestDistance) {
          bestDistance = distance;
          best = candidate;
        }
      }
    }
  }

  return best;
}

/** Identity of a snapped point, so the report can tell a file vertex from a clip vertex.
 *  Both sides build it from the SAME doubles (the snap copies the file's values through
 *  unchanged), so string equality here is exact-value equality. */
export function coordinateKey(x: number, y: number): string {
  return `${x}|${y}`;
}

export type SnappedRings = {
  rings: number[][][];
  /**
   * `coordinateKey` of every vertex that came from the CAD file verbatim. Vertices the
   * clip created against the regulation boundary are absent — they are new points, so
   * there is no file digit for them to match.
   */
  exact: Set<string>;
};

/**
 * Replaces every ring vertex that matches a CAD file vertex with the file's exact value.
 *
 * With nothing to snap to (a file that was already WGS84, or a drawing published before
 * the source coordinates were carried) the rings pass through untouched and `exact` is
 * empty — the report then falls back to printing rounded projected values, exactly as it
 * did before, rather than failing.
 */
export function snapRingsToSourceVertices(
  rings: number[][][],
  index: SourceVertexIndex | null,
): SnappedRings {
  const exact = new Set<string>();
  if (!index || index.size === 0) return { rings, exact };

  const snapped = rings.map((ring) =>
    ring.map((point) => {
      const match = nearestSourceVertex(index, point[0], point[1]);
      if (!match) return point;

      exact.add(coordinateKey(match[0], match[1]));
      return [match[0], match[1]];
    }),
  );

  return { rings: snapped, exact };
}
