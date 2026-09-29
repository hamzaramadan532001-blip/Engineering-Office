"use client";

import Basemap from "@arcgis/core/Basemap";
import OpenStreetMapLayer from "@arcgis/core/layers/OpenStreetMapLayer";
import TileLayer from "@arcgis/core/layers/TileLayer";
import EsriMap from "@arcgis/core/Map";
import WebScene from "@arcgis/core/WebScene";
import LocalBasemapsSource from "@arcgis/core/widgets/BasemapGallery/support/LocalBasemapsSource";
import {
  BASEMAP_V2_URL,
  GALLERY_IMAGERY,
  SCENE_BASEMAP,
  SCENE_PORTAL_URL,
  SCENE_WEBSCENE_ITEM_ID,
} from "./arcgis.config";

export interface SceneSource {
  map: WebScene | EsriMap;
  viewingMode?: "global" | "local";
}

const isServiceUrl = (v: string) => /^https?:\/\//i.test(v);
const isPortalItemId = (v: string) => /^[0-9a-f]{32}$/i.test(v);

/**
 * Basemap setting value → Basemap: a Portal item id, "osm", a service URL, or an Esri style id.
 * "none" → null: no basemap (no scene override / no picker entry).
 */
function resolveBasemap(value: string): Basemap | null {
  if (value === "none") return null;
  if (!value || value === "osm") return new Basemap({ baseLayers: [new OpenStreetMapLayer()] });
  if (isServiceUrl(value)) return new Basemap({ baseLayers: [new TileLayer({ url: value })] });
  if (isPortalItemId(value))
    return new Basemap({ portalItem: { id: value, portal: { url: SCENE_PORTAL_URL } } });
  return Basemap.fromId(value) ?? null;
}

/**
 * Build the map for `<arcgis-scene>`: the municipal WebScene with our basemap overlaid (its own
 * renders white under our static token), or a plain basemap scene if no WebScene is set.
 * Fresh instance per call — ArcGIS destroys the scene's map on unmount.
 */
export function createExplorerScene(): SceneSource {
  const basemap = SCENE_BASEMAP ? resolveBasemap(SCENE_BASEMAP) : null;

  if (SCENE_WEBSCENE_ITEM_ID) {
    const webScene = new WebScene({
      portalItem: { id: SCENE_WEBSCENE_ITEM_ID, portal: { url: SCENE_PORTAL_URL } },
    });
    // Apply after the item loads, else the authored (white) basemap overwrites it.
    if (basemap) {
      webScene
        .when(() => {
          webScene.basemap = basemap;
        })
        .catch((err: unknown) => console.warn("3D basemap override failed:", err));
    }
    return { map: webScene };
  }

  return { map: new EsriMap({ basemap: basemap ?? resolveBasemap("osm") }), viewingMode: "global" };
}

/**
 * Curated basemaps for the in-app picker (the portal gallery group is empty under our static
 * token, so we list them explicitly). View-aware so each view always lists its own default —
 * giving the user a way back to it. Fresh instances per call (basemaps bind to the view, which is
 * destroyed on the 2D↔3D switch).
 */
// Picker thumbnails for the locally-built basemaps (Makkah-centred tile captures checked
// into /public; the imagery entry gets its thumbnail from its Portal item).
const MUNICIPAL_THUMBNAIL = "/basemap-thumbnails/municipal.png";
const OSM_THUMBNAIL = "/basemap-thumbnails/osm.png";

export function createBasemapGallerySource(is3D: boolean): LocalBasemapsSource {
  // The picker's imagery entry has its own config (GALLERY_IMAGERY, "none" → hidden) —
  // deliberately NOT SCENE_BASEMAP, so the 3D scene-override choice never trims this list.
  const imagery = resolveBasemap(GALLERY_IMAGERY);

  if (imagery) {
    // Wait for the basemap's portal item/metadata to load,
    // THEN override the title so it doesn't get wiped out.
    imagery
      .when(() => {
        imagery.title = "المصور الفضائي";
      })
      .catch((err: unknown) => {
        console.warn("Failed to load imagery basemap for gallery:", err);
      });
  }
  const osm = new Basemap({
    baseLayers: [new OpenStreetMapLayer()],
    title: "خريطة الشارع",
    thumbnailUrl: OSM_THUMBNAIL,
  });

  // 3D (SceneView) can't use the 2D municipal basemap (WKID 32637 → tiling-scheme-unsupported).
  if (is3D) return new LocalBasemapsSource({ basemaps: imagery ? [imagery, osm] : [osm] });

  // 2D (MapView) is UTM 32637 — only the municipal cached basemap renders. List it first as the
  // default + the way back to it.
  const municipal = new Basemap({
    baseLayers: [new TileLayer({ url: BASEMAP_V2_URL, title: "خريطة الأساس" })],
    title: "الخريطة الأساسية",
    thumbnailUrl: MUNICIPAL_THUMBNAIL,
  });
  return new LocalBasemapsSource({
    basemaps: imagery ? [municipal, imagery, osm] : [municipal, osm],
  });
}
