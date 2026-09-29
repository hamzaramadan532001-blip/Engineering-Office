"use client";

/**
 * The one routine that puts a CAD collection on the map.
 *
 * It was inlined in `CadUploadTool.handleDraw`, which was fine while uploading was the
 * only way a CAD reached the map. It no longer is: reopening a request now loads its
 * stored parcel and draws it with no file and no panel involved. Both paths have to
 * produce the SAME layer, the same store publication and the same zoom, or the operations
 * panel and the survey report would behave differently depending on how the CAD arrived.
 *
 * Moved verbatim, so the upload path behaves exactly as before.
 */

import Color from "@arcgis/core/Color";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import { getMapElement } from "@/app/features/Map/utils";
import { COPY } from "./constants";
import {
  dominantGeometryType,
  hexToRgba,
  reprojectToWGS84,
  toGeoJSONBlobUrl,
  type GeoJSONFeatureCollection,
} from "./geometry";
import { cadDrawingStore } from "./store";
import type { FillPatternValue, LineStyleValue } from "./types";

export type CadSymbolOptions = {
  lineColor: string;
  fillColor: string;
  lineWidth: number;
  lineStyle: LineStyleValue;
  fillPattern: FillPatternValue;
};

export function buildRenderer(geometryType: string | undefined, opts: CadSymbolOptions) {
  const outline = {
    color: opts.lineColor,
    width: opts.lineWidth,
    style: opts.lineStyle,
  };

  if (geometryType === "Polygon") {
    let fillSymbol: SimpleFillSymbol;

    if (opts.fillPattern === "none") {
      // "بدون" → مفيش تعبئة خالص
      fillSymbol = new SimpleFillSymbol({
        color: new Color([0, 0, 0, 0]),
        style: "none",
        outline,
      });
    } else if (opts.fillPattern === "transparent") {
      // "شفاف" → نفس لون التعبئة بس شفافية 30% (خفيف)
      const baseColor = hexToRgba(opts.fillColor, 100);
      fillSymbol = new SimpleFillSymbol({
        color: new Color([baseColor.r, baseColor.g, baseColor.b, 0.3]),
        style: "diagonal-cross",
        outline,
      });
    } else {
      // "صلب" → تعبئة عادية
      fillSymbol = new SimpleFillSymbol({
        color: hexToRgba(opts.fillColor, 100),
        style: "solid",
        outline,
      });
    }

    return new SimpleRenderer({ symbol: fillSymbol });
  }

  if (geometryType === "Point" || geometryType === "MultiPoint") {
    return new SimpleRenderer({
      symbol: new SimpleMarkerSymbol({
        color: opts.lineColor,
        size: 8,
        outline: { color: "#fff", width: 1 },
      }),
    });
  }

  return new SimpleRenderer({
    symbol: new SimpleLineSymbol(outline),
  });
}

export type DrawCadParams = {
  /** Map layer title, and the name the operations panel + report show for this drawing. */
  title: string;
  /** The CAD in its own projected CRS (what "قراءة الملف" lists), NOT WGS84. */
  sourceCollection: GeoJSONFeatureCollection;
  /** That CRS's WKID. Omitted → `sourceCollection` is already WGS84 and is drawn as-is. */
  sourceWkid?: number;
  options: CadSymbolOptions;
  /** Other layer titles to remove alongside `title`. Used so a manual upload replaces the
   *  parcel that was auto-loaded for the open request, instead of stacking on top of it —
   *  one request must never show two CAD layers. */
  replaceTitles?: string[];
  /** Skip the camera move — used when something else already framed the view. */
  skipZoom?: boolean;
};

export type DrawCadResult = {
  layer: GeoJSONLayer;
  /** Revoke this when the layer is removed; GeoJSONLayer reads it during `load()`. */
  blobUrl: string;
};

/**
 * Reprojects, draws, publishes to `cadDrawingStore`, and zooms — the whole "a CAD is now
 * on the map" transition in one place.
 *
 * Throws with the panel's Arabic copy when the map is not ready, so both callers surface
 * the same message.
 */
export async function drawCadOnMap({
  title,
  sourceCollection,
  sourceWkid,
  options,
  replaceTitles,
  skipZoom,
}: DrawCadParams): Promise<DrawCadResult> {
  const mapElement = getMapElement();
  if (!mapElement) throw new Error(COPY.errors.noMap);

  const view = mapElement.view;
  if (!view) throw new Error(COPY.errors.noView);

  const map = view.map;
  if (!map) throw new Error(COPY.errors.noLayer);

  const wgs84Collection = sourceWkid
    ? await reprojectToWGS84(sourceCollection, sourceWkid)
    : sourceCollection;

  const blobUrl = toGeoJSONBlobUrl(wgs84Collection);

  // امسح أي layer قديم بنفس الاسم (أو بأي اسم بديل) قبل إضافة الجديد
  const titlesToDrop = new Set([title, ...(replaceTitles ?? [])]);
  const oldLayers = map.layers.filter((l) => titlesToDrop.has(l.title ?? "")).toArray();
  oldLayers.forEach((l) => map.remove(l));

  const layer = new GeoJSONLayer({
    url: blobUrl,
    title,
    renderer: buildRenderer(dominantGeometryType(sourceCollection), options),
  });

  try {
    await layer.load();
  } catch (loadError) {
    URL.revokeObjectURL(blobUrl);
    throw loadError;
  }

  map.add(layer);

  // اللوحة اليمين (العمليات) بتشتغل على الإحداثيات دي.
  // The un-reprojected collection is published too, so the survey report can print the
  // file's own شرقيات/شماليات instead of re-deriving them from WGS84 (see sourceSnap.ts).
  cadDrawingStore.publish(
    title,
    wgs84Collection,
    sourceWkid ? { geoJSON: sourceCollection, wkid: sourceWkid } : undefined,
  );

  if (!skipZoom) {
    try {
      const extentResult = await layer.queryExtent();
      const zoomTarget = extentResult?.extent?.expand(1.2) ?? extentResult?.extent ?? null;
      if (zoomTarget) await view.goTo(zoomTarget);
    } catch (extentError) {
      console.warn("[CAD] Failed to zoom to CAD extent:", extentError);
    }
  }

  return { layer, blobUrl };
}

/** Removes a CAD layer from the map and tells the operations panel there is no drawing. */
export function removeCadLayer(layer: GeoJSONLayer | null): void {
  if (layer) {
    const map = getMapElement()?.view?.map;
    if (map?.layers.includes(layer)) map.remove(layer);
  }
  cadDrawingStore.clear();
}

/**
 * Removes whatever CAD is currently on the map, whoever put it there.
 *
 * Needed when the open request changes: removing only the layer THIS session drew would
 * leave a manually uploaded CAD from the previous request sitting on the map under the new
 * request's banner. The store's `fileName` is always the drawn layer's title (every draw
 * goes through `drawCadOnMap`), so it identifies that layer whatever its origin.
 */
export function clearCurrentCad(): void {
  const current = cadDrawingStore.getSnapshot();
  const map = getMapElement()?.view?.map;

  if (current && map) {
    map.layers
      .filter((l) => l.title === current.fileName)
      .toArray()
      .forEach((l) => map.remove(l));
  }

  cadDrawingStore.clear();
}
