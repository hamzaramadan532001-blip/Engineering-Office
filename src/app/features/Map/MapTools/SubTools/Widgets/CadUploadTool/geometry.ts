"use client";

/**
 * Geometry helpers shared by the CAD upload tool and the CAD operations panel.
 *
 * These used to live as private functions inside CadUploadTool.tsx. They moved
 * here when the geoprocessing operations (the intersect with the regulation line)
 * were split out into their own panel — both sides need to convert between
 * GeoJSON and Esri geometry, so keeping one copy avoids the two drifting apart.
 */

import Color from "@arcgis/core/Color";
import type EsriGeometry from "@arcgis/core/geometry/Geometry";
import EsriMultipoint from "@arcgis/core/geometry/Multipoint";
import EsriPoint from "@arcgis/core/geometry/Point";
import EsriPolygon from "@arcgis/core/geometry/Polygon";
import EsriPolyline from "@arcgis/core/geometry/Polyline";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import * as projectOperator from "@arcgis/core/geometry/operators/projectOperator.js";
import type { CoordinateRow } from "./types";

export type ArcGISFeatureSet = {
  geometryType?: string;
  features?: Array<{
    attributes?: Record<string, unknown>;
    geometry?: {
      x?: number;
      y?: number;
      points?: number[][];
      paths?: number[][][];
      rings?: number[][][];
    };
  }>;
};

export type GeoJSONGeometry = {
  type: string;
  coordinates: unknown;
};

export type GeoJSONFeature = {
  type: "Feature";
  id?: string | number;
  properties: Record<string, unknown>;
  geometry: GeoJSONGeometry | null;
};

export type GeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};

/** Convert ArcGIS FeatureSet to standard GeoJSON FeatureCollection. */
export function featureSetToGeoJSON(featureSet: ArcGISFeatureSet): GeoJSONFeatureCollection {
  const geometryType = featureSet.geometryType;
  const features = featureSet.features ?? [];

  return {
    type: "FeatureCollection",

    features: features.map((feature) => {
      const geometry = feature.geometry;

      let geoJSONGeometry: GeoJSONGeometry | null = null;

      if (!geometry) {
        geoJSONGeometry = null;
      } else {
        switch (geometryType) {
          case "esriGeometryPoint":
            if (typeof geometry.x === "number" && typeof geometry.y === "number") {
              geoJSONGeometry = {
                type: "Point",
                coordinates: [geometry.x, geometry.y],
              };
            }
            break;

          case "esriGeometryMultipoint":
            geoJSONGeometry = {
              type: "MultiPoint",
              coordinates: geometry.points ?? [],
            };
            break;

          case "esriGeometryPolyline":
            geoJSONGeometry = {
              type: "MultiLineString",
              coordinates: geometry.paths ?? [],
            };
            break;

          case "esriGeometryPolygon":
            geoJSONGeometry = {
              type: "Polygon",
              coordinates: geometry.rings ?? [],
            };
            break;

          default:
            console.warn("[CAD] Unsupported ArcGIS geometry type:", geometryType);
        }
      }

      return {
        type: "Feature" as const,
        id: feature.attributes?.OID as string | number | undefined,
        properties: feature.attributes ?? {},
        geometry: geoJSONGeometry,
      };
    }),
  };
}

/** Flattens every ring/path/point across every feature into one numbered list of
 *  vertices — that's what fills the شرقيات/شمالیات table once "قراءة الملف" resolves. */
export function extractCoordinateRows(collection: GeoJSONFeatureCollection): CoordinateRow[] {
  const points: Array<[number, number]> = [];

  for (const feature of collection.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    switch (geometry.type) {
      case "Point": {
        const [x, y] = geometry.coordinates as [number, number];
        if (typeof x === "number" && typeof y === "number") points.push([x, y]);
        break;
      }

      case "MultiPoint": {
        for (const pt of geometry.coordinates as [number, number][]) points.push([pt[0], pt[1]]);
        break;
      }

      case "MultiLineString": {
        for (const path of geometry.coordinates as [number, number][][]) {
          for (const pt of path) points.push([pt[0], pt[1]]);
        }
        break;
      }

      case "Polygon": {
        for (const ring of geometry.coordinates as [number, number][][]) {
          for (const pt of ring) points.push([pt[0], pt[1]]);
        }
        break;
      }

      default:
        break;
    }
  }

  return points.map(([x, y], index) => ({ id: index + 1, x, y }));
}

/** First feature's geometry type drives which symbol class the renderer uses. */
export function dominantGeometryType(collection: GeoJSONFeatureCollection): string | undefined {
  return collection.features.find((f) => f.geometry)?.geometry?.type;
}

/** Builds the matching Esri geometry instance for a GeoJSON geometry, tagged with the
 *  given spatial reference — required input shape for the geometry operators. */
export function toEsriGeometry(geometry: GeoJSONGeometry, spatialReference: SpatialReference) {
  switch (geometry.type) {
    case "Point": {
      const [x, y] = geometry.coordinates as [number, number];
      return new EsriPoint({ x, y, spatialReference });
    }
    case "MultiPoint":
      return new EsriMultipoint({ points: geometry.coordinates as number[][], spatialReference });
    case "MultiLineString":
      return new EsriPolyline({ paths: geometry.coordinates as number[][][], spatialReference });
    case "Polygon":
      return new EsriPolygon({ rings: geometry.coordinates as number[][][], spatialReference });
    default:
      return null;
  }
}

/** Reverses toEsriGeometry after an operator runs, back into plain GeoJSON coordinates. */
export function fromEsriGeometry(geometry: EsriGeometry | null): GeoJSONGeometry | null {
  if (!geometry) return null;

  switch (geometry.type) {
    case "point": {
      const point = geometry as EsriPoint;
      return { type: "Point", coordinates: [point.x, point.y] };
    }
    case "multipoint": {
      const multipoint = geometry as EsriMultipoint;
      return { type: "MultiPoint", coordinates: multipoint.points };
    }
    case "polyline": {
      const polyline = geometry as EsriPolyline;
      return { type: "MultiLineString", coordinates: polyline.paths as unknown as number[][][] };
    }
    case "polygon": {
      const polygon = geometry as EsriPolygon;
      return { type: "Polygon", coordinates: polygon.rings as unknown as number[][][] };
    }
    default:
      return null;
  }
}

/** The CAD API returns raw easting/northing in the file's own projected CRS (e.g. UTM
 *  zone 37N), not lon/lat. GeoJSON coordinates are always WGS84 degrees by spec, so
 *  without this step the layer either renders nowhere sensible or has a broken extent
 *  (which is what made `view.goTo()` throw on `extent.expand()` returning null). Uses the
 *  same operators-based projection API as `Attestations/drawLayer.ts`. */
export async function reprojectToWGS84(
  collection: GeoJSONFeatureCollection,
  sourceWkid: number,
): Promise<GeoJSONFeatureCollection> {
  if (!projectOperator.isLoaded()) await projectOperator.load();

  const sourceSpatialReference = new SpatialReference({ wkid: sourceWkid });
  const targetSpatialReference = new SpatialReference({ wkid: 4326 });

  return {
    type: "FeatureCollection",
    features: collection.features.map((feature) => {
      if (!feature.geometry) return feature;

      const esriGeometry = toEsriGeometry(feature.geometry, sourceSpatialReference);
      if (!esriGeometry) return feature;

      const projected = projectOperator.execute(
        esriGeometry,
        targetSpatialReference,
      ) as EsriGeometry | null;

      return { ...feature, geometry: fromEsriGeometry(projected) };
    }),
  };
}

export function hexToRgba(hex: string, opacityPercent: number): Color {
  const clean = hex.replace("#", "");
  const bigint = Number.parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return new Color([r, g, b, Math.max(0, Math.min(100, opacityPercent)) / 100]);
}

/** Serialises a collection to a blob URL — GeoJSONLayer takes a URL, not an object. */
export function toGeoJSONBlobUrl(collection: GeoJSONFeatureCollection): string {
  const blob = new Blob([JSON.stringify(collection)], { type: "application/geo+json" });
  return URL.createObjectURL(blob);
}
