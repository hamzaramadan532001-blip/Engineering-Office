"use client";

/**
 * Spatial read-out of the CAD ∩ regulation-boundary polygon.
 *
 * Data/transport layer for the intersect operation: takes THE intersection polygon
 * produced by `buildIntersectSplitCollection` (`IntersectResult.insideGeometry`) and
 * asks the BusinessMap MapServer, server-side, which administrative and regulatory
 * polygons that exact shape falls in.
 *
 * Deliberate constraints:
 *  - The geometry passed in is the real intersection — NOT the CAD drawing, not its
 *    union, and not any extent/bbox. The question being answered is "what does the
 *    *regulated part* sit in", so widening the geometry would answer a different one.
 *  - Every relation is evaluated by the SERVER (`spatialRelationship: "intersects"`).
 *    Nothing is re-tested client-side, and no layer geometry is pulled down
 *    (`returnGeometry = false`) — these are city-wide polygons.
 *  - The intersection ring can be long. `FeatureLayer.queryFeatures` switches to POST
 *    past `esriConfig.request.maxUrlLength`, so a complex CAD outline is safe.
 *
 * No React here (CLAUDE.md layering): this file is `fetch`-equivalent + DTO shaping.
 */

import type EsriPolygon from "@arcgis/core/geometry/Polygon";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import type CodedValueDomain from "@arcgis/core/layers/support/CodedValueDomain";
import { BUSINESS_MAP_URL } from "@/app/features/Map/arcgis.config";
import { CONTEXT_FIELDS, CONTEXT_LAYERS, COPY } from "./constants";

/** One matched polygon, decoded to something displayable. */
export type ContextMatch = {
  /** Raw attribute value — the domain CODE on the coded-value layers. */
  code: string | number | null;
  /** Decoded Arabic label (the domain's name), or the raw value stringified. */
  name: string;
};

export type SpatialContext = {
  /** الأحياء — every neighbourhood the intersection polygon touches. */
  neighborhoods: ContextMatch[];
  /** البلديات — every sub-municipality it touches. */
  municipalities: ContextMatch[];
  /** إستخدامات الأراضي — the land-use name for each land-use polygon it touches. */
  landUses: ContextMatch[];
  /** حد الحرم — whether the intersection polygon meets the Haram boundary at all. */
  intersectsHaram: boolean;
  /** النطاق العمراني — the same question for the urban boundary. */
  intersectsUrbanBoundary: boolean;
  /**
   * Arabic labels of the layers whose query failed. A failed layer yields an empty
   * list / `false`, which is indistinguishable from a genuine "no match" — so it is
   * reported here instead of being silently rendered as a negative answer.
   */
  failed: string[];
};

/** FeatureLayers are stateless for querying and `load()` is the expensive part, so one
 *  instance per sublayer is reused across runs. */
const layerCache = new Map<number, FeatureLayer>();

async function loadContextLayer(layerId: number): Promise<FeatureLayer> {
  let layer = layerCache.get(layerId);

  if (!layer) {
    // Same host as REGULATION_LAYER_URL → covered by the token registered in
    // Map/index.tsx; no extra registration is needed here.
    layer = new FeatureLayer({ url: `${BUSINESS_MAP_URL}/${layerId}` });
    layerCache.set(layerId, layer);
  }

  await layer.load();
  return layer;
}

/**
 * Turns a raw attribute into its readable Arabic label.
 *
 * DIST_ANAME / SECT_ANAME are integers backed by a coded-value domain, so `20` has to
 * be resolved through the layer's own domain rather than displayed as-is. Fields with
 * no domain (LANDUSE_PLAN_NAME) fall through unchanged.
 */
function decodeFieldValue(layer: FeatureLayer, fieldName: string, raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;

  const domain = layer.getFieldDomain(fieldName);

  if (domain?.type === "coded-value") {
    const decoded = (domain as CodedValueDomain).getName(raw as string | number);
    if (decoded) return decoded;
  }

  return String(raw);
}

/** The shared query: the intersection polygon, server-side "intersects", no geometry back. */
function buildContextQuery(layer: FeatureLayer, geometry: EsriPolygon, outFields: string[]) {
  const query = layer.createQuery();
  query.geometry = geometry;
  query.spatialRelationship = "intersects";
  query.returnGeometry = false;
  query.outFields = outFields;
  return query;
}

/**
 * Distinct matches for a name-bearing layer. Several features of one layer can overlap
 * the intersection (a parcel straddling two districts, or one district stored as
 * several polygons), so results are de-duplicated by decoded name.
 */
async function queryMatches(
  layerId: number,
  nameField: string,
  codeField: string | null,
  geometry: EsriPolygon,
): Promise<ContextMatch[]> {
  const layer = await loadContextLayer(layerId);
  const outFields = codeField && codeField !== nameField ? [nameField, codeField] : [nameField];

  const featureSet = await layer.queryFeatures(buildContextQuery(layer, geometry, outFields));

  const byName = new Map<string, ContextMatch>();

  for (const feature of featureSet.features ?? []) {
    const attributes = feature.attributes ?? {};
    const name = decodeFieldValue(layer, nameField, attributes[nameField]);
    if (!name) continue;

    if (!byName.has(name)) {
      byName.set(name, {
        name,
        code: (codeField ? attributes[codeField] : attributes[nameField]) ?? null,
      });
    }
  }

  return [...byName.values()];
}

/** Boundary layers only need a yes/no, so ask the server for a COUNT, not features. */
async function queryIntersectsAny(layerId: number, geometry: EsriPolygon): Promise<boolean> {
  const layer = await loadContextLayer(layerId);
  const count = await layer.queryFeatureCount(buildContextQuery(layer, geometry, []));
  return count > 0;
}

/** Runs one layer's query, degrading to a fallback (and a `failed` entry) on error —
 *  one unavailable sublayer must not blank out the whole read-out. */
async function safely<T>(
  label: string,
  fallback: T,
  failed: string[],
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    console.error(`[CAD ops] spatial context query failed for ${label}:`, err);
    failed.push(label);
    return fallback;
  }
}

/**
 * THE entry point: queries all five BusinessMap sublayers against the intersection polygon.
 *
 * `geometry` must be `IntersectResult.insideGeometry` — the CAD ∩ regulation-boundary
 * polygon in WGS84. The server reprojects it to the layers' WKID 32637 from the
 * geometry's own spatial reference, so the caller projects nothing.
 */
export async function querySpatialContext(geometry: EsriPolygon): Promise<SpatialContext> {
  // The operators return geometries carrying the input SR, but a polygon rebuilt from
  // GeoJSON elsewhere could arrive untagged — an untagged geometry would be read as
  // 32637 metres and silently match nothing.
  const queryGeometry = geometry.spatialReference
    ? geometry
    : (Object.assign(geometry.clone(), {
        spatialReference: new SpatialReference({ wkid: 4326 }),
      }) as EsriPolygon);

  const failed: string[] = [];
  const labels = COPY.intersect.context;

  const [neighborhoods, municipalities, landUses, intersectsHaram, intersectsUrbanBoundary] =
    await Promise.all([
      safely(labels.neighborhood, [] as ContextMatch[], failed, () =>
        queryMatches(
          CONTEXT_LAYERS.NEIGHBORHOODS,
          CONTEXT_FIELDS.neighborhoodName,
          CONTEXT_FIELDS.neighborhoodCode,
          queryGeometry,
        ),
      ),
      safely(labels.municipality, [] as ContextMatch[], failed, () =>
        queryMatches(
          CONTEXT_LAYERS.MUNICIPALITIES,
          CONTEXT_FIELDS.municipalityName,
          CONTEXT_FIELDS.municipalityCode,
          queryGeometry,
        ),
      ),
      safely(labels.landUse, [] as ContextMatch[], failed, () =>
        queryMatches(CONTEXT_LAYERS.LAND_USES, CONTEXT_FIELDS.landUseName, null, queryGeometry),
      ),
      safely(labels.haram, false, failed, () =>
        queryIntersectsAny(CONTEXT_LAYERS.HARAM_BOUNDARY, queryGeometry),
      ),
      safely(labels.urban, false, failed, () =>
        queryIntersectsAny(CONTEXT_LAYERS.URBAN_BOUNDARY, queryGeometry),
      ),
    ]);

  return {
    neighborhoods,
    municipalities,
    landUses,
    intersectsHaram,
    intersectsUrbanBoundary,
    failed,
  };
}
