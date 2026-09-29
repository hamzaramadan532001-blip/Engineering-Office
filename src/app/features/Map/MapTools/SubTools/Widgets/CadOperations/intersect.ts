"use client";

import * as differenceOperator from "@arcgis/core/geometry/operators/differenceOperator.js";
// NOTE: the module is `intersectionOperator`, not `intersectOperator` — there is no
// `intersectOperator.js` in @arcgis/core. Also, unlike the geodesic operators, none
// of these three planar operators use the isLoaded()/load() pattern — that pattern is
// only for the geodesic operators (they pull in extra geodesy data); these are plain
// synchronous functions available as soon as the module is imported.
import * as intersectionOperator from "@arcgis/core/geometry/operators/intersectionOperator.js";
import * as unionOperator from "@arcgis/core/geometry/operators/unionOperator.js";
import type EsriPolygon from "@arcgis/core/geometry/Polygon";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import {
  fromEsriGeometry,
  toEsriGeometry,
  type GeoJSONFeatureCollection,
} from "../CadUploadTool/geometry";
import { COPY, REGULATION_LAYER_URL } from "./constants";

/** Zone tag stamped on each output feature — driving the UniqueValueRenderer
 *  in IntersectOperation.tsx (red for "inside", the drawing's normal style for
 *  "outside"). Kept as a plain string property since GeoJSONLayer infers its
 *  schema from the data. */
export type IntersectZone = "inside" | "outside";

export type IntersectResult = {
  collection: GeoJSONFeatureCollection;
  /** Which zones actually produced a feature — an all-outside or all-inside
   *  result still succeeds, it just has nothing to show for the other zone. */
  zones: IntersectZone[];
  /**
   * THE exact CAD ∩ regulation-boundary polygon, kept as a live Esri geometry in
   * WGS84 — the very object the red "inside" feature below was serialised from.
   *
   * Exposed so downstream spatial queries (spatialContext.ts) run against the real
   * intersection instead of the drawing, its union, or any extent/bbox of either.
   * `null` when nothing fell inside the boundary (an all-outside result): callers
   * must read that as "no geometry to query with", never as "query the drawing".
   */
  insideGeometry: EsriPolygon | null;
  /**
   * The mirror of `insideGeometry`: the part of the drawing OUTSIDE the regulation
   * boundary, as a live Esri geometry in WGS84.
   *
   * Exposed for the same reason — it is what gets persisted to the "خارج الموقع" layer
   * (REGULATION_LAYERS.BOUNDARY_OUTSIDE) for the open request. `null` when the drawing
   * falls entirely inside the boundary.
   */
  outsideGeometry: EsriPolygon | null;
  /**
   * The WHOLE CAD drawing as one polygon in WGS84 — inside and outside the regulation line
   * together, before any clipping.
   *
   * The report needs it for the plot's TOTAL boundary lengths. Those cannot be had by adding
   * the two halves up: the cut along the regulation line is an edge of both halves but is not
   * part of the plot's boundary at all, so summing them would count a line that does not
   * exist on the ground.
   */
  drawingGeometry: EsriPolygon;
};

/** Unions every polygon feature of a collection into one Esri polygon, in WGS84.
 *  `unionOperator.executeMany` takes an array; only its two-geometry sibling is
 *  called `execute`. */
function collectionToUnionPolygon(
  collection: GeoJSONFeatureCollection,
  wgs84: SpatialReference,
): EsriPolygon | null {
  const polygons = collection.features
    .map((feature) => (feature.geometry ? toEsriGeometry(feature.geometry, wgs84) : null))
    .filter((geometry): geometry is EsriPolygon => geometry?.type === "polygon");

  if (polygons.length === 0) return null;
  if (polygons.length === 1) return polygons[0];

  return (unionOperator.executeMany(polygons) as EsriPolygon | null | undefined) ?? null;
}

/**
 * Queries the live "مضلع خطوط التنظيم" layer for whatever intersects the drawing's
 * extent, and unions the result into one polygon in WGS84 — the drawing itself may
 * span more than one regulation-boundary feature (e.g. a corner parcel).
 */
async function queryRegulationBoundary(
  drawingGeometry: EsriPolygon,
  wgs84: SpatialReference,
): Promise<EsriPolygon | null> {
  const layer = new FeatureLayer({ url: REGULATION_LAYER_URL, outFields: [] });

  let featureSet;
  try {
    await layer.load();
    const query = layer.createQuery();
    query.geometry = drawingGeometry;
    query.spatialRelationship = "intersects";
    query.returnGeometry = true;
    query.outSpatialReference = wgs84;
    featureSet = await layer.queryFeatures(query);
  } catch (err) {
    console.error("[CAD ops] regulation layer query failed:", err);
    throw new Error(COPY.intersect.noRegulationData);
  }

  const polygons = (featureSet.features ?? [])
    .map((f) => f.geometry)
    .filter((geometry): geometry is EsriPolygon => geometry?.type === "polygon");

  if (polygons.length === 0) return null;
  if (polygons.length === 1) return polygons[0];

  return (unionOperator.executeMany(polygons) as EsriPolygon | null | undefined) ?? null;
}

/**
 * Splits the CAD drawing into the part that falls inside the regulation boundary
 * (intersection) and the part that falls outside it (difference), against whatever
 * the live "مضلع خطوط التنظيم" layer currently publishes for this extent.
 *
 * Returns null when the drawing has no polygon geometry to split at all — an empty
 * regulation query is NOT null, it resolves to a single "outside" feature covering
 * the whole drawing, since "no boundary found here" is a valid, displayable result.
 */
export async function buildIntersectSplitCollection(
  drawingCollection: GeoJSONFeatureCollection,
): Promise<IntersectResult | null> {
  const wgs84 = new SpatialReference({ wkid: 4326 });

  const drawingUnion = collectionToUnionPolygon(drawingCollection, wgs84);
  if (!drawingUnion) return null;

  const regulationUnion = await queryRegulationBoundary(drawingUnion, wgs84);

  // Nothing published for this extent — the whole drawing counts as "outside".
  if (!regulationUnion) {
    return {
      zones: ["outside"],
      insideGeometry: null,
      outsideGeometry: drawingUnion,
      drawingGeometry: drawingUnion,
      collection: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature" as const,
            id: 0,
            properties: { zone: "outside" satisfies IntersectZone },
            geometry: fromEsriGeometry(drawingUnion),
          },
        ],
      },
    };
  }

  const insidePart = intersectionOperator.execute(drawingUnion, regulationUnion) as
    | EsriPolygon
    | null
    | undefined;
  const outsidePart = differenceOperator.execute(drawingUnion, regulationUnion) as
    | EsriPolygon
    | null
    | undefined;

  const zones: IntersectZone[] = [];
  const features: GeoJSONFeatureCollection["features"] = [];

  if (insidePart) {
    zones.push("inside");
    features.push({
      type: "Feature" as const,
      id: features.length,
      properties: { zone: "inside" satisfies IntersectZone },
      geometry: fromEsriGeometry(insidePart),
    });
  }

  if (outsidePart) {
    zones.push("outside");
    features.push({
      type: "Feature" as const,
      id: features.length,
      properties: { zone: "outside" satisfies IntersectZone },
      geometry: fromEsriGeometry(outsidePart),
    });
  }

  if (features.length === 0) return null;

  return {
    collection: { type: "FeatureCollection", features },
    zones,
    insideGeometry: insidePart ?? null,
    outsideGeometry: outsidePart ?? null,
    drawingGeometry: drawingUnion,
  };
}