"use client";

/**
 * Persists a request's CAD parcel, and reads it back — the link that makes
 * "request 1001 → CAD 1001" hold.
 *
 * Storage is the service's OWN design, not something invented here: layer 2
 * (معاملات تنظيمية) is a polygon layer whose every row carries a `TRANSACTION_ID`
 * pointing back at a row of SDI.Transaction, wired as a real ArcGIS relationship class
 * (`Transaction_Regulation_Polygon`, origin = layer 2). Writing the CAD there keys it to
 * exactly one request by construction — there is no shared bucket for two requests to
 * collide in, so 1001's parcel can never surface under 1002.
 *
 * Coordinates: layer 2 is WKID 32637 (UTM 37N) — the SAME CRS the CAD files arrive in.
 * So the parcel is stored in the file's own coordinates, with no reprojection either way.
 * That is deliberate: it keeps the numbers on the survey report identical to the file's
 * (see sourceSnap.ts) across a save/reload cycle, instead of degrading them a little each
 * time the parcel round-trips through WGS84.
 *
 * No React: `fetch`-equivalent + DTO shaping.
 */

import Graphic from "@arcgis/core/Graphic";
import EsriPolygon from "@arcgis/core/geometry/Polygon";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { regulationLayerUrl, REGULATION_LAYERS, TRANSACTION_ID_FIELD } from "@/lib/arcgis";
import type { GeoJSONFeatureCollection } from "./geometry";

/** The CRS layer 2 stores its geometry in — and the CRS CAD files arrive in. */
export const PARCEL_WKID = 32637;

/** Map-layer title for a request's stored parcel. Shared so the auto-loader and the upload
 *  panel name the same layer and can replace each other's, never stack. */
export function requestCadLayerTitle(requestId: number): string {
  return `كاد الطلب رقم ${requestId}`;
}

export type StoredCad = {
  /** The parcel in the layer's (and the file's) own CRS — ready for `reprojectToWGS84`. */
  collection: GeoJSONFeatureCollection;
  wkid: number;
  /** How many polygon rows were stored for this request. */
  featureCount: number;
};

/** One shared instance per layer: `load()` is the expensive part, querying is stateless. */
const layerCache = new Map<number, FeatureLayer>();

async function getLayer(layerId: number): Promise<FeatureLayer> {
  let layer = layerCache.get(layerId);
  if (!layer) {
    layer = new FeatureLayer({ url: regulationLayerUrl(layerId), outFields: ["*"] });
    layerCache.set(layerId, layer);
  }
  await layer.load();
  return layer;
}

async function getParcelLayer(): Promise<FeatureLayer> {
  return getLayer(REGULATION_LAYERS.TRANSACTION_PARCEL);
}

/** TRANSACTION_ID is a STRING field, so the id is compared as a quoted string. The id is a
 *  number from the OBJECTID of a request row, so it needs no escaping — but it is coerced
 *  through Number() first so a malformed value can never reach the where-clause. */
function whereTransaction(requestId: number): string {
  return `${TRANSACTION_ID_FIELD} = '${Number(requestId)}'`;
}

/**
 * Elevation written for a CAD vertex that has none.
 *
 * All three regulation layers are Z-ENABLED (`hasZ: true`) while the service has
 * "Enable Z Defaults" switched OFF and no `zDefault` — so the server fills in nothing and
 * rejects any vertex without a Z: "Geometry does not have z-values or has null values."
 * CAD parcels are 2D plans, so 0 is the honest value: a flat parcel at the datum, not a
 * made-up elevation. A CAD that DOES carry elevations keeps its own (see `toZRing`).
 */
const DEFAULT_Z = 0;

/** Rewrites a ring so every vertex is [x, y, z], keeping a real Z where the CAD had one. */
function toZRing(ring: number[][]): number[][] {
  return ring.map((point) => {
    const z = point[2];
    return [point[0], point[1], typeof z === "number" && Number.isFinite(z) ? z : DEFAULT_Z];
  });
}

/** A Z-enabled polygon for the layer. `hasZ` must be set on the geometry as well as the
 *  coordinates — without it ArcGIS serialises only x/y and the server rejects the edit. */
function toZPolygon(rings: number[][][], spatialReference: SpatialReference): EsriPolygon {
  return new EsriPolygon({ rings: rings.map(toZRing), hasZ: true, spatialReference });
}

/** Every polygon ring in the collection, as Esri polygons in the layer's CRS.
 *  Non-polygon CAD entities (lines, points, text) have no home in a polygon layer and are
 *  skipped — the caller reports the count difference to the user. */
function collectionToPolygons(
  collection: GeoJSONFeatureCollection,
  spatialReference: SpatialReference,
): EsriPolygon[] {
  const polygons: EsriPolygon[] = [];

  for (const feature of collection.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    if (geometry.type === "Polygon") {
      polygons.push(toZPolygon(geometry.coordinates as number[][][], spatialReference));
    } else if (geometry.type === "MultiPolygon") {
      // Each part becomes its own row: the layer stores one polygon per feature.
      for (const rings of geometry.coordinates as number[][][][]) {
        polygons.push(toZPolygon(rings, spatialReference));
      }
    }
  }

  return polygons;
}

/** Drops the Z ordinate the Z-enabled layer stores, back to the plain [x, y] the rest of
 *  the app works in. */
function stripZ(rings: number[][][]): number[][][] {
  return rings.map((ring) => ring.map((point) => [point[0], point[1]]));
}

/** Reads back whatever parcel rows are stored for this request. `null` = none stored yet,
 *  which is a normal state (a request whose CAD has not been uploaded), not an error. */
export async function loadRequestCad(requestId: number): Promise<StoredCad | null> {
  const layer = await getParcelLayer();

  const query = layer.createQuery();
  query.where = whereTransaction(requestId);
  query.returnGeometry = true;
  query.outFields = [TRANSACTION_ID_FIELD];
  // Ask for the layer's native CRS so the stored coordinates come back untouched.
  query.outSpatialReference = new SpatialReference({ wkid: PARCEL_WKID });

  const featureSet = await layer.queryFeatures(query);
  const features = featureSet.features ?? [];
  if (features.length === 0) return null;

  const collection: GeoJSONFeatureCollection = {
    type: "FeatureCollection",
    features: features.flatMap((feature, index) => {
      const geometry = feature.geometry as EsriPolygon | null;
      if (!geometry || geometry.type !== "polygon") return [];

      return [
        {
          type: "Feature" as const,
          id: index,
          properties: { [TRANSACTION_ID_FIELD]: String(requestId) },
          geometry: {
            type: "Polygon",
            // Stored rings come back as [x, y, z]. The whole client pipeline downstream —
            // the map layer, the intersect operators, the survey report — is 2D, and is
            // what the upload path feeds it, so the Z is dropped here rather than leaking
            // a third ordinate into geometry that never had one before.
            coordinates: stripZ(geometry.rings as unknown as number[][][]),
          },
        },
      ];
    }),
  };

  if (collection.features.length === 0) return null;

  return { collection, wkid: PARCEL_WKID, featureCount: collection.features.length };
}

export type SaveCadResult = {
  /** Rows written for this request. */
  saved: number;
  /** Rows deleted first — a re-upload REPLACES the request's parcel rather than adding
   *  a second parcel beside it, so one request never ends up with two CADs. */
  replaced: number;
  /** CAD entities that could not be stored because they are not polygons. */
  skippedNonPolygon: number;
};

/**
 * Stores this request's CAD parcel, replacing anything previously stored for it.
 *
 * @param collection the CAD in its OWN CRS (the un-reprojected collection), not WGS84.
 * @param wkid       that CRS. Must match the layer's (32637) — the parcel is written
 *                   as-is, so a different CRS would silently land in the wrong place.
 */
export async function saveRequestCad(
  requestId: number,
  collection: GeoJSONFeatureCollection,
  wkid: number,
): Promise<SaveCadResult> {
  if (wkid !== PARCEL_WKID) {
    throw new Error(
      `لا يمكن حفظ ملف الكاد: نظام إحداثيات الملف (${wkid}) لا يطابق نظام الطبقة (${PARCEL_WKID}).`,
    );
  }

  const layer = await getParcelLayer();

  if (!layer.capabilities?.operations?.supportsAdd) {
    throw new Error("الخدمة لا تسمح بحفظ ملف الكاد للطلب.");
  }

  const spatialReference = new SpatialReference({ wkid: PARCEL_WKID });
  const polygons = collectionToPolygons(collection, spatialReference);

  const totalGeometries = collection.features.filter((f) => f.geometry).length;
  const skippedNonPolygon = Math.max(0, totalGeometries - polygons.length);

  if (polygons.length === 0) {
    throw new Error(
      "لا يحتوي ملف الكاد على أي مضلعات (Polygons) قابلة للحفظ — طبقة المعاملات تقبل المضلعات فقط.",
    );
  }

  // Replace, don't append: query the request's existing rows and delete them in the same
  // edit as the new ones, so the layer is never left holding two parcels for one request.
  const existing = await layer.queryFeatures({
    where: whereTransaction(requestId),
    returnGeometry: false,
    outFields: [layer.objectIdField],
  });

  const deleteFeatures = existing.features ?? [];

  const addFeatures = polygons.map(
    (geometry) =>
      new Graphic({
        geometry,
        attributes: { [TRANSACTION_ID_FIELD]: String(requestId) },
      }),
  );

  const result = await layer.applyEdits({ addFeatures, deleteFeatures });

  const failed = (result.addFeatureResults ?? []).find((r) => r.error);
  if (failed?.error) {
    throw new Error(failed.error.message ?? "تعذّر حفظ ملف الكاد للطلب.");
  }

  return {
    saved: (result.addFeatureResults ?? []).filter((r) => !r.error).length,
    replaced: (result.deleteFeatureResults ?? []).filter((r) => !r.error).length,
    skippedNonPolygon,
  };
}

/** Removes this request's stored parcel — used when the user clears the CAD on the map. */
export async function deleteRequestCad(requestId: number): Promise<number> {
  const layer = await getParcelLayer();

  const existing = await layer.queryFeatures({
    where: whereTransaction(requestId),
    returnGeometry: false,
    outFields: [layer.objectIdField],
  });

  const deleteFeatures = existing.features ?? [];
  if (deleteFeatures.length === 0) return 0;

  const result = await layer.applyEdits({ deleteFeatures });
  return (result.deleteFeatureResults ?? []).filter((r) => !r.error).length;
}


/* ── The intersect result (داخل / خارج خط التنظيم) ─────────────────────────────
 *
 * Layers 1 and 0 are the designed homes for the two halves of the CAD ∩ regulation-boundary
 * split, keyed to the request by the same TRANSACTION_ID as the parcel. Persisting them is
 * what lets a reopened request show its coloured result without recomputing the intersect —
 * and layer 1 additionally stores the spatial read-out (البلدية / الحي / الاستخدام and the
 * two boundary flags) on the row itself, which is exactly the field set it publishes.
 */

/** Field names on layer 1 (الحد التنظيمي داخل الموقع) — read off the live service. */
export const INSIDE_FIELDS = {
  municipality: "MUNICIPALITY",
  district: "DISTRICT",
  landUse: "LAND_USE",
  siteComponents: "SITE_COMPONENTS",
  urbanBoundary: "URBAN_GROWTH_BOUNDARY",
  haramBoundary: "SANCTUARY_BOUNDARY",
} as const;

/** What layer 1 records alongside the inside geometry. All optional: a failed read-out
 *  must still let the geometry be stored. */
export type InsideAttributes = {
  municipality?: string;
  district?: string;
  landUse?: string;
  intersectsUrbanBoundary?: boolean;
  intersectsHaram?: boolean;
};

export type SaveIntersectResult = {
  insideSaved: number;
  outsideSaved: number;
  insideReplaced: number;
  outsideReplaced: number;
};

/** Deletes every row this request owns on one layer, and adds the given polygons. */
async function replaceForTransaction(
  layerId: number,
  requestId: number,
  rings: number[][][][],
  extraAttributes: Record<string, unknown>,
): Promise<{ saved: number; replaced: number }> {
  const layer = await getLayer(layerId);
  const spatialReference = new SpatialReference({ wkid: PARCEL_WKID });

  const existing = await layer.queryFeatures({
    where: whereTransaction(requestId),
    returnGeometry: false,
    outFields: [layer.objectIdField],
  });
  const deleteFeatures = existing.features ?? [];

  const addFeatures = rings.map(
    (polygonRings) =>
      new Graphic({
        geometry: toZPolygon(polygonRings, spatialReference),
        attributes: {
          [TRANSACTION_ID_FIELD]: String(requestId),
          ...extraAttributes,
        },
      }),
  );

  if (addFeatures.length === 0 && deleteFeatures.length === 0) {
    return { saved: 0, replaced: 0 };
  }

  const result = await layer.applyEdits({ addFeatures, deleteFeatures });

  const failed = (result.addFeatureResults ?? []).find((r) => r.error);
  if (failed?.error) {
    throw new Error(failed.error.message ?? "تعذّر حفظ نتيجة التقاطع مع خط التنظيم.");
  }

  return {
    saved: (result.addFeatureResults ?? []).filter((r) => !r.error).length,
    replaced: (result.deleteFeatureResults ?? []).filter((r) => !r.error).length,
  };
}

/**
 * Stores the split for a request: inside → layer 1, outside → layer 0.
 *
 * Both sides are replaced, never appended, so re-running the intersect on a request leaves
 * one inside row-set and one outside row-set rather than piling results up. A side with no
 * geometry (a drawing entirely inside, or entirely outside, the boundary) simply clears
 * that layer for this request — an empty result is a real answer and must be stored as one.
 *
 * `insideRings` / `outsideRings` are in the layers' CRS (32637); Z is added on write
 * because all three layers are Z-enabled with no server-side default.
 */
export async function saveRequestIntersect(
  requestId: number,
  insideRings: number[][][][],
  outsideRings: number[][][][],
  attributes: InsideAttributes = {},
): Promise<SaveIntersectResult> {
  const insideAttributes: Record<string, unknown> = {};

  if (attributes.municipality) insideAttributes[INSIDE_FIELDS.municipality] = attributes.municipality;
  if (attributes.district) insideAttributes[INSIDE_FIELDS.district] = attributes.district;
  if (attributes.landUse) insideAttributes[INSIDE_FIELDS.landUse] = attributes.landUse;
  // SmallInteger flags: the service models "يتقاطع" as 1 and "لا يتقاطع" as 0. Left unset
  // when the read-out could not answer, so an unknown is stored as NULL, not as a false.
  if (attributes.intersectsUrbanBoundary !== undefined) {
    insideAttributes[INSIDE_FIELDS.urbanBoundary] = attributes.intersectsUrbanBoundary ? 1 : 0;
  }
  if (attributes.intersectsHaram !== undefined) {
    insideAttributes[INSIDE_FIELDS.haramBoundary] = attributes.intersectsHaram ? 1 : 0;
  }

  const [inside, outside] = await Promise.all([
    replaceForTransaction(
      REGULATION_LAYERS.BOUNDARY_INSIDE,
      requestId,
      insideRings,
      insideAttributes,
    ),
    replaceForTransaction(REGULATION_LAYERS.BOUNDARY_OUTSIDE, requestId, outsideRings, {}),
  ]);

  return {
    insideSaved: inside.saved,
    outsideSaved: outside.saved,
    insideReplaced: inside.replaced,
    outsideReplaced: outside.replaced,
  };
}

/** Clears both result layers for a request — used when its CAD is removed. */
export async function deleteRequestIntersect(requestId: number): Promise<void> {
  await Promise.all([
    replaceForTransaction(REGULATION_LAYERS.BOUNDARY_INSIDE, requestId, [], {}),
    replaceForTransaction(REGULATION_LAYERS.BOUNDARY_OUTSIDE, requestId, [], {}),
  ]);
}

/* ── The survey report, stored on the request ────────────────────────────────── */

export type AttachReportResult = {
  /** The attachment id the service assigned. */
  attachmentId: number;
};

/**
 * Stores an exported survey-report PDF as an ATTACHMENT on the request's own row in
 * SDI.Transaction (layer 5) — the same table, and the same `addAttachment` call, the
 * Requests screen uses for the approvals PDF, so the report shows up in that request's
 * "المرفقات" list next to it with no extra wiring.
 *
 * Appended, never replaced: each export is a signed, dated document, and a re-export after
 * a correction should sit beside the earlier one rather than silently overwrite it. (The
 * service does not support `queryAttachments` either — see server/requestAttachments — so a
 * "replace" would have to delete by id blindly.)
 *
 * Throws on any failure; the caller decides how loudly to report it.
 */
export async function attachRequestReport(
  requestId: number,
  file: File,
): Promise<AttachReportResult> {
  const layer = await getLayer(REGULATION_LAYERS.TRANSACTIONS_TABLE);

  if (!layer.capabilities?.data?.supportsAttachment) {
    throw new Error("الخدمة لا تسمح بإرفاق الملفات.");
  }

  // Read the row back rather than hand-building a Graphic: `addAttachment` needs the
  // feature the service knows, and this also fails clearly if the request was deleted.
  const featureSet = await layer.queryFeatures({
    objectIds: [requestId],
    outFields: [layer.objectIdField],
    returnGeometry: false,
  });
  const feature = featureSet.features[0];
  if (!feature) throw new Error("تعذّر العثور على الطلب في الخدمة.");

  const form = new FormData();
  form.set("attachment", file);
  form.set("f", "json");

  const result = await layer.addAttachment(feature, form);
  if (result.error || result.objectId == null) {
    throw new Error(result.error?.message ?? "تعذّر حفظ التقرير كمرفق على الطلب.");
  }

  return { attachmentId: result.objectId };
}
