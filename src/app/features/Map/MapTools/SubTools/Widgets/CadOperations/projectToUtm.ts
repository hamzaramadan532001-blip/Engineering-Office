"use client";

import * as projectOperator from "@arcgis/core/geometry/operators/projectOperator.js";
import type EsriPolygon from "@arcgis/core/geometry/Polygon";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";

/** UTM zone 37N — the municipality's working CRS (the MapServer's own WKID), and the
 *  fallback when a drawing carries no source CRS of its own. */
export const UTM_37N_WKID = 32637;

/**
 * Projects the intersection polygon (WGS84 degrees) into UTM 37N metres and returns its
 * rings, ready for `buildReportGeometry`.
 *
 * Why: side lengths, area and the شرقيات/شماليات table are all in METRES. Measuring on
 * degrees would be wrong, and drawing degrees directly would squash the sketch (a degree
 * of longitude is shorter than a degree of latitude). Same operator and load pattern as
 * `reprojectToWGS84` in CadUploadTool/geometry.ts.
 *
 * `targetWkid` is the CAD file's OWN CRS, so the rings come back in the same coordinate
 * system as the file's easting/northing and `snapRingsToSourceVertices` can match them.
 * Projecting into a different CRS than the file's would make every snap miss.
 */
export async function projectPolygonToUtmRings(
  polygon: EsriPolygon,
  targetWkid: number = UTM_37N_WKID,
): Promise<number[][][] | null> {
  if (!projectOperator.isLoaded()) await projectOperator.load();

  const projected = projectOperator.execute(
    polygon,
    new SpatialReference({ wkid: targetWkid }),
  ) as EsriPolygon | null;

  return projected ? (projected.rings as unknown as number[][][]) : null;
}
