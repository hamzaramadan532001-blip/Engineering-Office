import { describe, expect, it } from "vitest";
import { buildReportGeometry } from "./reportGeometry";

/** A 100 × 100 m plot whose eastern 40 m fall outside the regulation line. */
const PLOT = [[[0, 0], [0, 100], [100, 100], [100, 0], [0, 0]]];
const INSIDE = [[[0, 0], [0, 100], [60, 100], [60, 0], [0, 0]]];
const OUTSIDE = [[[60, 0], [60, 100], [100, 100], [100, 0], [60, 0]]];

describe("report coordinates", () => {
  it("lists the whole drawing and the aligned part as two separate tables", () => {
    const geometry = buildReportGeometry(INSIDE, undefined, OUTSIDE, PLOT);

    expect(geometry?.plotVertices.map((v) => [v.easting, v.northing])).toEqual([
      [0, 0],
      [0, 100],
      [100, 100],
      [100, 0],
    ]);
    expect(geometry?.vertices.map((v) => [v.easting, v.northing])).toEqual([
      [0, 0],
      [0, 100],
      [60, 100],
      [60, 0],
    ]);
    // Each table is numbered on its own, from 1.
    expect(geometry?.plotVertices.map((v) => v.n)).toEqual([1, 2, 3, 4]);
    expect(geometry?.vertices.map((v) => v.n)).toEqual([1, 2, 3, 4]);
  });

  it("numbers the sketch after the aligned part", () => {
    const geometry = buildReportGeometry(INSIDE, undefined, OUTSIDE, PLOT);
    expect(geometry?.drawing.vertexLabels.map((label) => label.n)).toEqual([1, 2, 3, 4]);
    expect(geometry?.drawing.cornerPoints).toHaveLength(4);
  });

  it("labels the sketch's sides with the aligned lengths, not the whole plot's", () => {
    const geometry = buildReportGeometry(INSIDE, undefined, OUTSIDE, PLOT);
    const texts = geometry?.drawing.edgeLabels.map((label) => label.text) ?? [];

    expect(texts).toContain("60.00"); // north/south of the aligned part
    expect(geometry?.directionLengths.north).toBe(60);
    expect(geometry?.totalDirectionLengths.north).toBe(100);
  });

  it("reports the whole plot's area and the aligned area separately", () => {
    const geometry = buildReportGeometry(INSIDE, undefined, OUTSIDE, PLOT);
    expect(geometry?.plotArea).toBeCloseTo(10000, 6); // 100 × 100
    expect(geometry?.area).toBeCloseTo(6000, 6); // 60 × 100, inside the regulation line
  });

  it("leaves the site table empty when the drawing was not supplied", () => {
    const geometry = buildReportGeometry(INSIDE);
    expect(geometry?.plotArea).toBeNull();
    expect(geometry?.plotVertices).toEqual([]);
    expect(geometry?.vertices).toHaveLength(4);
  });
});
