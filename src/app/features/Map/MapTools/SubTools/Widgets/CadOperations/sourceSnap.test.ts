import { describe, expect, it } from "vitest";
import type { GeoJSONFeatureCollection } from "../CadUploadTool/geometry";
import { buildReportGeometry } from "./reportGeometry";
import { coordinateKey, indexSourceVertices, snapRingsToSourceVertices } from "./sourceSnap";

/** A CAD parcel as the file carries it: UTM 37N metres, four decimals. */
const FILE_EASTINGS = [
  [572431.1234, 2371844.5678],
  [572461.4321, 2371844.5678],
  [572461.4321, 2371874.8765],
  [572431.1234, 2371874.8765],
];

function sourceCollection(points: number[][]): GeoJSONFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [ 
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [[...points, points[0]]] },
      },
    ],
  };
}

/** What the WGS84 round trip does to the file's numbers: shifts them by a fraction of a
 *  millimetre, which is enough to change the printed decimals. */
function withRoundTripDrift(points: number[][]): number[][] {
  return points.map(([x, y], i) => [x + (i % 2 ? 0.0002 : -0.0003), y + 0.00015]);
}

describe("snapping report coordinates back to the CAD file", () => {
  const index = indexSourceVertices(sourceCollection(FILE_EASTINGS));

  it("restores the file's exact digits on a round-tripped ring", () => {
    const drifted = withRoundTripDrift(FILE_EASTINGS);
    expect(drifted[0][0]).not.toBe(FILE_EASTINGS[0][0]);

    const { rings, exact } = snapRingsToSourceVertices([drifted], index);

    expect(rings[0]).toEqual(FILE_EASTINGS);
    expect(exact.has(coordinateKey(FILE_EASTINGS[0][0], FILE_EASTINGS[0][1]))).toBe(true);
  });

  it("leaves a clip-created vertex alone and does not mark it exact", () => {
    // A point on the regulation boundary, metres away from any file vertex.
    const clipped = [572446.98765, 2371844.5678];
    const { rings, exact } = snapRingsToSourceVertices(
      [[...withRoundTripDrift(FILE_EASTINGS), clipped]],
      index,
    );

    expect(rings[0][4]).toEqual(clipped);
    expect(exact.has(coordinateKey(clipped[0], clipped[1]))).toBe(false);
  });

  it("never pulls a vertex onto a different one", () => {
    // 30 m away — well outside the 1 cm tolerance, so it must stay put.
    const far = [[572431.1234 + 30, 2371844.5678]];
    const { rings } = snapRingsToSourceVertices([far], index);
    expect(rings[0][0]).toEqual(far[0]);
  });

  it("passes the rings through untouched when there is no source to snap to", () => {
    const drifted = withRoundTripDrift(FILE_EASTINGS);
    const { rings, exact } = snapRingsToSourceVertices([drifted], null);

    expect(rings[0]).toEqual(drifted);
    expect(exact.size).toBe(0);
  });

  it("marks the snapped vertices exact in the built report geometry", () => {
    const { rings, exact } = snapRingsToSourceVertices([withRoundTripDrift(FILE_EASTINGS)], index);
    const geometry = buildReportGeometry(rings, exact);

    expect(geometry).not.toBeNull();
    expect(geometry?.vertices).toHaveLength(4);
    expect(geometry?.vertices.every((v) => v.exact)).toBe(true);
    // The value the report prints is the file's own double, not a re-derivation.
    expect(String(geometry?.vertices[0].easting)).toBe("572431.1234");
    // 30.3086 m x 30.3087 m ≈ 918 m²; the snap must not have distorted the shape.
    expect(geometry?.area).toBeCloseTo(30.3087 * 30.3087, 0);
  });
});

describe("the report sketch drawing both halves", () => {
  /** A square, and a second square beside it standing for the part outside the line. */
  const inside = [
    [
      [572431, 2371844],
      [572461, 2371844],
      [572461, 2371874],
      [572431, 2371874],
    ],
  ];
  const outside = [
    [
      [572461, 2371844],
      [572521, 2371844],
      [572521, 2371874],
      [572461, 2371874],
    ],
  ];

  it("emits no outside paths when the drawing is entirely inside the line", () => {
    const geometry = buildReportGeometry(inside);
    expect(geometry?.drawing.outsidePaths).toEqual([]);
    expect(geometry?.drawing.paths).toHaveLength(1);
  });

  it("emits one path per outside ring", () => {
    const geometry = buildReportGeometry(inside, undefined, outside);
    expect(geometry?.drawing.outsidePaths).toHaveLength(1);
    expect(geometry?.drawing.paths).toHaveLength(1);
  });

  it("fits both halves to ONE extent, so they line up as a single drawing", () => {
    const insideOnly = buildReportGeometry(inside);
    const withOutside = buildReportGeometry(inside, undefined, outside);

    // Adding a part three times as wide must shrink the inside half on the canvas; if the
    // two were fitted separately they would be drawn at different scales and not meet.
    expect(withOutside?.drawing.paths[0]).not.toEqual(insideOnly?.drawing.paths[0]);

    // The shared edge (x = 572461) must land on the same canvas x in both halves.
    const xsOf = (d: string) =>
      [...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => Number(m[1]));
    const insideMaxX = Math.max(...xsOf(withOutside?.drawing.paths[0] ?? ""));
    const outsideMinX = Math.min(...xsOf(withOutside?.drawing.outsidePaths[0] ?? ""));
    expect(insideMaxX).toBeCloseTo(outsideMinX, 2);
  });

  it("measures only the inside half — the outside part adds no vertices or area", () => {
    const insideOnly = buildReportGeometry(inside);
    const withOutside = buildReportGeometry(inside, undefined, outside);

    expect(withOutside?.vertices).toHaveLength(insideOnly?.vertices.length ?? 0);
    expect(withOutside?.area).toBeCloseTo(insideOnly?.area ?? 0, 6);
  });
});

describe("the two length columns", () => {
  /** A 30x30 plot whose western 30x30 half is inside the line and eastern 60x30 outside. */
  const inside = [
    [
      [572431, 2371844],
      [572461, 2371844],
      [572461, 2371874],
      [572431, 2371874],
    ],
  ];
  const plot = [
    [
      [572431, 2371844],
      [572521, 2371844],
      [572521, 2371874],
      [572431, 2371874],
    ],
  ];

  it("measures the whole plot for الطول and the inside part for بموجب التنظيم", () => {
    const geometry = buildReportGeometry(inside, undefined, [], plot);

    // Inside: the north and south sides are 30 m each.
    expect(geometry?.directionLengths.north).toBeCloseTo(30, 3);
    expect(geometry?.directionLengths.south).toBeCloseTo(30, 3);

    // Whole plot: those same sides run the full 90 m.
    expect(geometry?.totalDirectionLengths.north).toBeCloseTo(90, 3);
    expect(geometry?.totalDirectionLengths.south).toBeCloseTo(90, 3);
  });

  it("never reports a total SHORTER than the regulated part", () => {
    const geometry = buildReportGeometry(inside, undefined, [], plot);
    const directions = ["north", "south", "east", "west"] as const;

    for (const d of directions) {
      expect(geometry?.totalDirectionLengths[d]).toBeGreaterThanOrEqual(
        geometry?.directionLengths[d] ?? 0,
      );
    }
  });

  it("falls back to the inside lengths when no plot outline is supplied", () => {
    const geometry = buildReportGeometry(inside);
    expect(geometry?.totalDirectionLengths).toEqual(geometry?.directionLengths);
  });
});


describe("one number per side, matching the limits table", () => {
  /** An ALIGNED part whose western edge bends part-way along, so it is two geometric sides
   *  but one edge to a reader — the shape that put 163.52 and 475.14 on one edge of a real
   *  report. The sketch is labelled from the aligned part, so the bend is put there. */
  const bentWest = [
    [
      [592400, 2376300],
      [592700, 2376300],
      [592700, 2376800],
      [592420, 2376800],
      [592400, 2376500],
    ],
  ];

  /** The whole drawing around it — its lengths belong in the table, never on the sketch. */
  const plot = [
    [
      [592300, 2376200],
      [592800, 2376200],
      [592800, 2376900],
      [592300, 2376900],
    ],
  ];

  it("draws exactly one number per direction, never two on one edge", () => {
    const geometry = buildReportGeometry(bentWest, undefined, [], plot);
    const labels = geometry?.drawing.edgeLabels ?? [];

    expect(labels.length).toBeLessThanOrEqual(4);
    expect(new Set(labels.map((l) => l.text)).size).toBe(labels.length);
  });

  it("prints the SAME value the بموجب التنظيم column prints for that direction", () => {
    const geometry = buildReportGeometry(bentWest, undefined, [], plot);

    const labelTexts = new Set((geometry?.drawing.edgeLabels ?? []).map((l) => l.text));
    const tableValues = Object.values(geometry?.directionLengths ?? {})
      .filter((v) => v > 0)
      .map((v) => v.toFixed(2));

    // Every number on the sketch is one of the aligned part's own direction totals.
    expect(labelTexts.size).toBeGreaterThan(0);
    for (const text of labelTexts) {
      expect(tableValues).toContain(text);
    }
  });

  it("labels the bent western edge once, with its FULL length", () => {
    const geometry = buildReportGeometry(bentWest, undefined, [], plot);

    const west = geometry?.directionLengths.west ?? 0;
    const westLabels = (geometry?.drawing.edgeLabels ?? []).filter(
      (l) => l.text === west.toFixed(2),
    );

    expect(west).toBeGreaterThan(0);
    expect(westLabels).toHaveLength(1);
  });

  it("still labels a plain rectangle once per side", () => {
    const rectangle = [
      [
        [592400, 2376300],
        [592490, 2376300],
        [592490, 2376330],
        [592400, 2376330],
      ],
    ];

    const geometry = buildReportGeometry(rectangle, undefined, [], plot);
    expect(geometry?.drawing.edgeLabels).toHaveLength(4);
  });
});
