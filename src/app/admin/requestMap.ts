"use client";

/**
 * The admin's read-only map of ONE request: the drawing the engineering office submitted,
 * over the municipality basemap, so a reviewer can see what they are deciding on.
 *
 * Three server layers, each filtered to the request through `definitionExpression` — the
 * same filter the office's map uses, so no other request's shapes can ever be drawn here:
 *   - 2 (معاملات تنظيمية) — the CAD parcel the office uploaded;
 *   - 1 / 0 (داخل / خارج خط التنظيم) — the regulation split, when the intersect was run.
 * Styled from src/lib/regulationStyles.ts, so the parcel reads exactly as it does for the
 * office.
 *
 * Imperative and React-free: RequestMapModal owns the lifecycle (create on open, destroy on
 * close) and only needs the handle back.
 */

import Basemap from "@arcgis/core/Basemap";
import esriId from "@arcgis/core/identity/IdentityManager";
import EsriMap from "@arcgis/core/Map";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import TileLayer from "@arcgis/core/layers/TileLayer";
import MapView from "@arcgis/core/views/MapView";
import { regulationLayerUrl, REGULATION_LAYERS, TRANSACTION_ID_FIELD } from "@/lib/arcgis";
import { insideRenderer, outsideRenderer, parcelRenderer } from "@/lib/regulationStyles";
import { getBasemapV2Url, getBusinessMapToken } from "@/lib/runtimeConfig";

/** The secured host the basemap is published on — the same registration the main map
 *  makes (features/Map/index.tsx), done here because /admin never loads that module. */
const MUNICIPALITY_ARCGIS_SERVER = "https://maps.holymakkah.gov.sa/arcgis";

let tokenRegistered = false;

function registerBasemapToken(): void {
  if (tokenRegistered) return;
  const token = getBusinessMapToken();
  if (!token) return;
  try {
    esriId.registerToken({ server: MUNICIPALITY_ARCGIS_SERVER, token, ssl: true });
    tokenRegistered = true;
  } catch (error) {
    console.warn("[admin] basemap token registration warning:", error);
  }
}

/** TRANSACTION_ID is a string field; the id is coerced to a number first, so nothing but
 *  digits can reach the where-clause. */
function whereTransaction(requestId: number): string {
  return `${TRANSACTION_ID_FIELD} = '${Number(requestId)}'`;
}

export type RequestMapHandle = {
  /** False when the office never stored a drawing for this request. */
  hasDrawing: boolean;
  destroy: () => void;
};

export async function createRequestMap(
  container: HTMLDivElement,
  requestId: number,
): Promise<RequestMapHandle> {
  registerBasemapToken();

  const layer = (id: number, title: string, renderer: FeatureLayer["renderer"]) =>
    new FeatureLayer({
      url: regulationLayerUrl(id),
      title,
      definitionExpression: whereTransaction(requestId),
      renderer,
      outFields: ["*"],
    });

  const outside = layer(REGULATION_LAYERS.BOUNDARY_OUTSIDE, "خارج خط التنظيم", outsideRenderer());
  const inside = layer(REGULATION_LAYERS.BOUNDARY_INSIDE, "داخل خط التنظيم", insideRenderer());
  // Drawn last, so the whole parcel's outline stays visible on top of the split.
  const parcel = layer(REGULATION_LAYERS.TRANSACTION_PARCEL, "رسمة الكاد", parcelRenderer());

  const view = new MapView({
    container,
    map: new EsriMap({
      basemap: new Basemap({
        baseLayers: [new TileLayer({ url: getBasemapV2Url(), title: "خريطة الأساس" })],
      }),
      layers: [outside, inside, parcel],
    }),
    ui: { components: ["zoom"] },
  });

  const destroy = () => view.destroy();

  try {
    await view.when();

    // Zoom to the drawing: the parcel if it exists, else whatever the split holds.
    let extent = null;
    for (const candidate of [parcel, inside, outside]) {
      const result = await candidate.queryExtent();
      if (result.count > 0 && result.extent) {
        extent = result.extent;
        break;
      }
    }

    if (extent) await view.goTo(extent.expand(1.4));

    return { hasDrawing: extent !== null, destroy };
  } catch (error) {
    destroy();
    throw error;
  }
}
