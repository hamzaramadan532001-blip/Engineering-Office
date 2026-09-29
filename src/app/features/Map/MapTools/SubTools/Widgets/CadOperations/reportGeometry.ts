
/**
 * Pure geometry maths for the survey-report sheet (IntersectReport.tsx).
 *
 * Input is the CAD ∩ regulation polygon's rings ALREADY in metres (UTM 37N, WKID
 * 32637 — see projectToUtm.ts). Everything the form needs is derived from those rings
 * and nothing else:
 *   - the numbered table of the MAIN corners (easting = x, northing = y) — the points where
 *     the boundary really turns, not every vertex a CAD arc or collinear run adds — once
 *     for the aligned part and once for the whole drawing,
 *   - the total area,
 *   - the length of each cardinal direction for the "limits" table: the main sides facing
 *     it, added up (see MIN_DIRECTION_SIDE_RATIO),
 *   - a ready-to-draw SVG (path, vertex numbers, rotated side lengths).
 *
 * No React, no ArcGIS — so it can be unit-tested with plain arrays.
 */

import { coordinateKey } from "./sourceSnap";

export type Direction = "north" | "south" | "east" | "west";

export type ReportVertex = {
  /** 1-based, continuous across all rings and counted over the MAIN corners only — the same
   *  number drawn on the sketch. */
  n: number;
  /** الشرقيات — metres. */
  easting: number;
  /** الشماليات — metres. */
  northing: number;
  /**
   * True when this vertex is a CAD file vertex reproduced verbatim (see sourceSnap.ts),
   * so the report prints the file's own digits. False for a vertex the clip against the
   * regulation boundary created, which exists in no file and is printed rounded.
   */
  exact: boolean;
};

export type DrawingLabel = { x: number; y: number };

export type ReportDrawing = {
  width: number;
  height: number;
  /** One closed SVG path per ring of the part INSIDE the regulation line. */
  paths: string[];
  /**
   * The part of the CAD drawing OUTSIDE the regulation line, one closed path per ring.
   *
   * Drawn so the report's sketch shows the WHOLE drawing rather than just the regulated
   * piece — the reviewer can see how much of the parcel falls outside. Empty when the
   * drawing lies entirely inside the line. It carries no labels or measurements: the
   * numbered corners, side lengths and area all describe the inside part.
   */
  outsidePaths: string[];
  /** Where each main corner sits on the sketch — a dot is drawn there so the number
   *  beside it is unambiguous. */
  cornerPoints: DrawingLabel[];
  vertexLabels: Array<DrawingLabel & { n: number }>;
  edgeLabels: Array<DrawingLabel & { text: string; angle: number }>;
};

export type ReportGeometry = {
  /** The main corners of the part INSIDE the regulation line, in order, numbered 1..n —
   *  "الإحداثيات بعد التنظيم", and the numbers drawn on the sketch. */
  vertices: ReportVertex[];
  /**
   * The main corners of the WHOLE CAD drawing, numbered 1..n on their own —
   * "الإحداثيات بموجب الطبيعة". Same corner rule as `vertices`. Empty when the drawing
   * was not supplied: a blank table is better than repeating the aligned corners under
   * the wrong heading.
   */
  plotVertices: ReportVertex[];
  /** Planar area in m² (UTM is conformal enough at parcel scale) of the part INSIDE the
   *  regulation line — the total area "بموجب التنظيم". */
  area: number;
  /** The same for the WHOLE CAD drawing — the total area under "الطول". `null` when the
   *  drawing was not supplied, so the cell stays blank rather than repeating `area`. */
  plotArea: number | null;
  /** Per direction, in metres: the sum of the MAIN sides (stretches between two main
   *  corners) whose outward normal faces it. Short jogs are left out — see
   *  MIN_DIRECTION_SIDE_RATIO — so this is NOT the perimeter split by direction.
   *
   *  This is the part INSIDE the regulation line — the report's "بموجب التنظيم" column. */
  directionLengths: Record<Direction, number>;
  /**
   * The same measurement taken on the WHOLE plot, inside and outside the regulation line
   * together — the report's "الطول" column.
   *
   * Measured on the original drawing, never by adding the two halves: the cut along the
   * regulation line is an edge of both halves but of neither's real boundary.
   */
  totalDirectionLengths: Record<Direction, number>;
  drawing: ReportDrawing;
};

/** Sketch canvas — the SVG viewBox. Padding leaves room for the labels outside the shape. */
const DRAWING = { width: 500, height: 450, padding: 62 } as const;

/**
 * A vertex is a MAIN corner when the boundary turns by at least this many degrees there.
 * Vertices on a straight run (0°) and the many small turns a CAD arc is exploded into are
 * not corners, so they get no row in the coordinates table and no number on the sketch.
 * The trade-off is deliberate: a gently rounded corner has no single main corner. Lower it
 * to keep shallower bends; raise it to keep fewer.
 */
const MIN_CORNER_TURN_DEGREES = 20;

/**
 * A side counts towards its direction's length only when it is at least this share of the
 * LONGEST side facing that direction. The limits table wants one full distance per
 * direction ("الشمال 152.86"), not that distance plus every small jog beside it, so a
 * 17 m step next to a 153 m side is left out. Because the yardstick is the direction's own
 * longest side, a direction always keeps at least its main side and is never left empty.
 * Raise it to drop more, lower it to keep more.
 */
const MIN_DIRECTION_SIDE_RATIO = 0.25;

/** Past this many MAIN corners labels only add noise. */
const MAX_LABELLED_VERTICES = 16;
/** A side shorter than this on the sketch (SVG units) gets no length label. */
const MIN_EDGE_LABEL_LENGTH = 34;

/**
 * A side carries a number only when it is at least this share of the outline's longest side.
 *
 * Without it a short jog between two long sides counts as a side of its own and puts a
 * second number along what reads as one edge. Same idea — and same 0.25 — as
 * MIN_DIRECTION_SIDE_RATIO, so the sketch and the limits table agree about what a side is.
 */
const MIN_EDGE_LABEL_RATIO = 0.25;

const VERTEX_LABEL_OFFSET = 17;
const EDGE_LABEL_OFFSET = 11;

type Pt = [number, number];

/** Drops the closing vertex ArcGIS repeats at the end of every ring. */
function cleanRing(ring: number[][]): Pt[] {
  const pts: Pt[] = ring.map((p) => [p[0], p[1]]);
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.length > 1 && first[0] === last[0] && first[1] === last[1]) pts.pop();
  return pts;
}

/**
 * Indices of a ring's main corners (see MIN_CORNER_TURN_DEGREES). A ring with fewer than
 * three of them — a circle, or an arc-only outline — has no corners to speak of, so it
 * keeps every vertex rather than collapsing to a line.
 */
function cornerIndices(ring: Pt[]): number[] {
  const count = ring.length;
  const corners: number[] = [];

  for (let i = 0; i < count; i++) {
    const [px, py] = ring[(i - 1 + count) % count];
    const [x, y] = ring[i];
    const [nx, ny] = ring[(i + 1) % count];

    const ax = x - px;
    const ay = y - py;
    const bx = nx - x;
    const by = ny - y;
    if ((ax === 0 && ay === 0) || (bx === 0 && by === 0)) continue;

    const turn = (Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by)) * 180) / Math.PI;
    if (turn >= MIN_CORNER_TURN_DEGREES) corners.push(i);
  }

  return corners.length >= 3 ? corners : ring.map((_, i) => i);
}

/**
 * ONE length label per side of the drawing — the same four numbers the limits table prints.
 *
 * Earlier versions labelled each geometric side, which is not what a reader counts as a side:
 * a boundary that bends part-way along still reads as one edge of the property. On a real
 * report that put 163.52 and 475.14 along the western edge while the table called that edge
 * 638.67, and left the southern edge showing 224.59 against a table value of 423.90.
 *
 * So a label now belongs to a DIRECTION, not to a segment: one number per cardinal direction,
 * carrying that direction's total length (`directionLengths`, exactly the الطول column), drawn
 * on the longest side facing that way. Four sides, four numbers, and the sketch can no longer
 * disagree with the table beneath it.
 */
function edgeLabelsFor(
  rings: Pt[][],
  sx: (x: number) => number,
  sy: (y: number) => number,
  directionLengths: Record<Direction, number>,
): ReportDrawing["edgeLabels"] {
  const labels: ReportDrawing["edgeLabels"] = [];
  if (rings.length === 0) return labels;

  // Only the outline — the largest ring by area. Interior rings (holes, or an inner ring left
  // by a union of overlapping CAD polygons) are not sides of the property.
  const outline = rings.reduce((a, b) =>
    Math.abs(signedArea(b)) > Math.abs(signedArea(a)) ? b : a,
  );

  const corners = cornerIndices(outline);
  const count = outline.length;

  const materialOnRight = signedArea(outline) < 0;
  const outward = (dx: number, dy: number): [number, number] =>
    materialOnRight ? [-dy, dx] : [dy, -dx];

  const segmentLengths: number[] = [];
  for (let i = 0; i < count; i++) {
    const [x1, y1] = outline[i];
    const [x2, y2] = outline[(i + 1) % count];
    segmentLengths.push(Math.hypot(x2 - x1, y2 - y1));
  }

  /** The longest side facing each direction — where that direction's number is drawn. */
  const anchor = new Map<Direction, { index: number; next: number; length: number }>();

  corners.forEach((index, k) => {
    const next = corners[(k + 1) % corners.length];

    let length = 0;
    for (let i = index; i !== next; i = (i + 1) % count) length += segmentLengths[i];
    if (length <= 0) return;

    const [x1, y1] = outline[index];
    const [x2, y2] = outline[next];
    const [nx, ny] = normalize(...outward(x2 - x1, y2 - y1));

    const direction: Direction =
      Math.abs(ny) >= Math.abs(nx) ? (ny > 0 ? "north" : "south") : nx > 0 ? "east" : "west";

    const current = anchor.get(direction);
    if (!current || length > current.length) anchor.set(direction, { index, next, length });
  });

  for (const [direction, side] of anchor) {
    const total = directionLengths[direction];
    if (!total || total <= 0) continue;

    const [x1, y1] = outline[side.index];
    const [x2, y2] = outline[side.next];

    const svgDx = sx(x2) - sx(x1);
    const svgDy = sy(y2) - sy(y1);
    if (Math.hypot(svgDx, svgDy) < MIN_EDGE_LABEL_LENGTH) continue;

    const [nx, ny] = normalize(...outward(x2 - x1, y2 - y1));

    let angle = (Math.atan2(svgDy, svgDx) * 180) / Math.PI;
    if (angle > 90) angle -= 180; // keep the text upright, never upside-down
    if (angle <= -90) angle += 180;

    labels.push({
      text: total.toFixed(2),
      x: (sx(x1) + sx(x2)) / 2 + nx * EDGE_LABEL_OFFSET,
      y: (sy(y1) + sy(y2)) / 2 - ny * EDGE_LABEL_OFFSET,
      angle,
    });
  }

  return labels;
}

/**
 * Direction lengths for a set of rings, by the SAME rule the inside part uses: main sides
 * only (the stretch between two main corners), classified by outward normal, with short jogs
 * beside a long side dropped (MIN_DIRECTION_SIDE_RATIO).
 *
 * Extracted so the "الطول" and "بموجب التنظيم" columns are measured identically and differ
 * only in the geometry they are given. Measuring the plot by a different rule — every edge,
 * say — would make the total smaller than the regulated part on some shapes, which is
 * nonsense on the page.
 */
function directionLengthsFor(rings: Pt[][]): Record<Direction, number> {
  const lengths: Record<Direction, number> = { north: 0, south: 0, east: 0, west: 0 };
  if (rings.length === 0) return lengths;

  const largest = rings
    .map(signedArea)
    .reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
  const materialOnRight = largest < 0;
  const outward = (dx: number, dy: number): [number, number] =>
    materialOnRight ? [-dy, dx] : [dy, -dx];

  const sides: Array<{ direction: Direction; length: number }> = [];

  for (const ring of rings) {
    const count = ring.length;
    const corners = cornerIndices(ring);

    const sideLengths: number[] = [];
    for (let i = 0; i < count; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % count];
      sideLengths.push(Math.hypot(x2 - x1, y2 - y1));
    }

    corners.forEach((index, k) => {
      const next = corners[(k + 1) % corners.length];

      let length = 0;
      for (let i = index; i !== next; i = (i + 1) % count) length += sideLengths[i];

      const [x1, y1] = ring[index];
      const [x2, y2] = ring[next];
      const [nx, ny] = normalize(...outward(x2 - x1, y2 - y1));

      if (Math.abs(ny) >= Math.abs(nx)) {
        sides.push({ direction: ny > 0 ? "north" : "south", length });
      } else {
        sides.push({ direction: nx > 0 ? "east" : "west", length });
      }
    });
  }

  for (const direction of Object.keys(lengths) as Direction[]) {
    const facing = sides.filter((side) => side.direction === direction);
    const longest = Math.max(0, ...facing.map((side) => side.length));
    lengths[direction] = facing
      .filter((side) => side.length >= longest * MIN_DIRECTION_SIDE_RATIO)
      .reduce((sum, side) => sum + side.length, 0);
  }

  return lengths;
}

/** The main corners of a set of rings as table rows, numbered continuously across rings. */
function cornerVerticesFor(rings: Pt[][], exactKeys?: ReadonlySet<string>): ReportVertex[] {
  const vertices: ReportVertex[] = [];
  for (const ring of rings) {
    for (const index of cornerIndices(ring)) {
      const [easting, northing] = ring[index];
      vertices.push({
        n: vertices.length + 1,
        easting,
        northing,
        exact: exactKeys?.has(coordinateKey(easting, northing)) ?? false,
      });
    }
  }
  return vertices;
}

/** Shoelace, shifted to the ring's first vertex so 7-digit UTM values don't cost precision. */
function signedArea(pts: Pt[]): number {
  const [ox, oy] = pts[0];
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    sum += (x1 - ox) * (y2 - oy) - (x2 - ox) * (y1 - oy);
  }
  return sum / 2;
}

function normalize(x: number, y: number): [number, number] {
  const len = Math.hypot(x, y);
  return len === 0 ? [0, 0] : [x / len, y / len];
}

/**
 * @param utmRings   the intersection polygon's rings in the file's own projected CRS.
 * @param exactKeys  `coordinateKey`s of the vertices that came from the CAD file verbatim
 *                   (from `snapRingsToSourceVertices`). Omitted → nothing is marked exact.
 */
export function buildReportGeometry(
  utmRings: number[][][],
  exactKeys?: ReadonlySet<string>,
  outsideUtmRings: number[][][] = [],
  plotUtmRings: number[][][] = [],
): ReportGeometry | null {
  const rings = utmRings.map(cleanRing).filter((ring) => ring.length >= 3);
  if (rings.length === 0) return null;

  const outsideRings = outsideUtmRings.map(cleanRing).filter((ring) => ring.length >= 3);
  const plotRings = plotUtmRings.map(cleanRing).filter((ring) => ring.length >= 3);

  // The canvas is fitted to BOTH halves. Fitting to the inside part alone would scale the
  // two differently and the outside piece would not line up with it — they have to share one
  // extent to read as one drawing.
  const all = [...rings, ...outsideRings].flat();
  const minX = Math.min(...all.map((p) => p[0]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const w = maxX - minX;
  const h = maxY - minY;
  if (w === 0 && h === 0) return null;

  // Fit the shape inside the padded canvas, centred, north up (SVG y grows downwards).
  const { width: W, height: H, padding } = DRAWING;
  const scale = Math.min(
    w > 0 ? (W - 2 * padding) / w : Infinity,
    h > 0 ? (H - 2 * padding) / h : Infinity,
  );
  const offsetX = (W - w * scale) / 2;
  const offsetY = (H - h * scale) / 2;
  const sx = (x: number) => offsetX + (x - minX) * scale;
  const sy = (y: number) => H - (offsetY + (y - minY) * scale);

  // ArcGIS keeps the polygon's material on the RIGHT of every ring (outer rings clockwise,
  // holes counter-clockwise), so "away from the material" is the LEFT normal for all rings.
  // The largest ring decides which convention this polygon actually follows.
  const areas = rings.map(signedArea);
  const largest = areas.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
  const materialOnRight = largest < 0;
  const outward = (dx: number, dy: number): [number, number] =>
    materialOnRight ? [-dy, dx] : [dy, -dx];

  const vertices: ReportVertex[] = [];
  const paths: string[] = [];
  const cornerPoints: ReportDrawing["cornerPoints"] = [];
  const vertexLabels: ReportDrawing["vertexLabels"] = [];
  const directionLengths: Record<Direction, number> = { north: 0, south: 0, east: 0, west: 0 };

  const sides: Array<{ direction: Direction; length: number }> = [];

  const cornersByRing = rings.map(cornerIndices);
  const totalCorners = cornersByRing.reduce((sum, corners) => sum + corners.length, 0);
  const labelled = totalCorners <= MAX_LABELLED_VERTICES;

  let base = 0;
  rings.forEach((ring, ringIndex) => {
    const count = ring.length;
    const corners = cornersByRing[ringIndex];

    // The outline is drawn through EVERY vertex, so an arc keeps its shape.
    paths.push(
      `${ring
        .map(([x, y], i) => `${i === 0 ? "M" : "L"}${sx(x).toFixed(2)} ${sy(y).toFixed(2)}`)
        .join(" ")} Z`,
    );

    // Length (metres) of every side — a stretch between two main corners is the sum of the
    // sides in between, so a run of collinear points reads as the single side it is.
    const sideLengths: number[] = [];
    for (let i = 0; i < count; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % count];
      sideLengths.push(Math.hypot(x2 - x1, y2 - y1));
    }

    // The numbered table and the sketch's labels cover the main corners only.
    corners.forEach((index, k) => {
      const [x1, y1] = ring[index];
      const [px, py] = ring[(index - 1 + count) % count];
      const [x2, y2] = ring[(index + 1) % count];
      const n = base + k + 1;

      vertices.push({
        n,
        easting: x1,
        northing: y1,
        exact: exactKeys?.has(coordinateKey(x1, y1)) ?? false,
      });
      cornerPoints.push({ x: sx(x1), y: sy(y1) });

      if (!labelled) return;

      // Corner number: pushed out along the bisector of the two adjoining outward normals.
      const [nx, ny] = normalize(...outward(x2 - x1, y2 - y1));
      const [pnx, pny] = normalize(...outward(x1 - px, y1 - py));
      const [bx, by] = normalize(nx + pnx, ny + pny);
      const [vx, vy] = bx === 0 && by === 0 ? [nx, ny] : [bx, by];
      vertexLabels.push({
        n,
        x: sx(x1) + vx * VERTEX_LABEL_OFFSET,
        y: sy(y1) - vy * VERTEX_LABEL_OFFSET,
      });
    });

    // One side per stretch BETWEEN main corners, not per vertex. Each is labelled on the
    // sketch and counted towards the direction its outward normal faces.
    corners.forEach((index, k) => {
      const next = corners[(k + 1) % corners.length];

      let length = 0;
      for (let i = index; i !== next; i = (i + 1) % count) length += sideLengths[i];

      const [x1, y1] = ring[index];
      const [x2, y2] = ring[next];
      const [nx, ny] = normalize(...outward(x2 - x1, y2 - y1));

      if (Math.abs(ny) >= Math.abs(nx)) sides.push({ direction: ny > 0 ? "north" : "south", length });
      else sides.push({ direction: nx > 0 ? "east" : "west", length });
    });

    base += corners.length;
  });

  // Per direction: the main sides added up, without the short jogs beside them.
  for (const direction of Object.keys(directionLengths) as Direction[]) {
    const facing = sides.filter((side) => side.direction === direction);
    const longest = Math.max(0, ...facing.map((side) => side.length));
    directionLengths[direction] = facing
      .filter((side) => side.length >= longest * MIN_DIRECTION_SIDE_RATIO)
      .reduce((sum, side) => sum + side.length, 0);
  }

  const outsidePaths = outsideRings.map(
    (ring) =>
      `${ring
        .map(([x, y], i) => `${i === 0 ? "M" : "L"}${sx(x).toFixed(2)} ${sy(y).toFixed(2)}`)
        .join(" ")} Z`,
  );

  // The whole plot's boundary. With no drawing supplied there is nothing better to report
  // than the inside part's own lengths — never a zero, which would read as "no boundary".
  const totalDirectionLengths =
    plotRings.length > 0 ? directionLengthsFor(plotRings) : directionLengths;

  // The sketch describes the plot AFTER alignment: its corner numbers (above) and its side
  // lengths are both the inside part's, so the drawing matches "الإحداثيات بعد التنظيم" and
  // the "بموجب التنظيم" column. One number per direction, so the clip's fragments are not
  // labelled one by one. The outside part is drawn for context only.
  const edgeLabels = edgeLabelsFor(rings, sx, sy, directionLengths);

  return {
    vertices,
    plotVertices: cornerVerticesFor(plotRings, exactKeys),
    area: Math.abs(areas.reduce((a, b) => a + b, 0)),
    plotArea:
      plotRings.length > 0
        ? Math.abs(plotRings.map(signedArea).reduce((a, b) => a + b, 0))
        : null,
    directionLengths,
    totalDirectionLengths,
    drawing: { width: W, height: H, paths, outsidePaths, cornerPoints, vertexLabels, edgeLabels },
  };
}