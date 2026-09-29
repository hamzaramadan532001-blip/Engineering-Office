/**
 * ArcGIS service endpoints + operational-layer configuration for the map.
 *
 * Source of truth for service URLs and the curated Layers-List subset.
 * See docs/rebuild/research-dossier.md §6–§8 for the full live inventory and the
 * verified BasemapV2 runtime sublayer tree.
 */

import { ARCGIS_PORTAL_URL } from "@/lib/arcgis";
import { permissionsStore } from "@/lib/permissions/store";
import type { PermissionsSnapshot } from "@/lib/permissions/types";
import {
  getBasemapHybridUrl,
  getBasemapV1Url,
  getBasemapV2Url,
  getBusinessMapUrl,
  getGalleryImageryId,
  getPrintServiceUrl,
  getRasterFolderUrl,
  getSceneBasemapId,
  getSceneWebSceneId,
} from "@/lib/runtimeConfig";

// Each service URL is runtime-resolved (full URL, not just host) so one build targets
// QA vs production by env file alone. Environments differ by host, web-adaptor path
// (/arcgis vs /server), AND service name — see lib/runtimeConfig.ts for the env vars
// and the production-default fallbacks.

/**
 * The secured BusinessMap MapServer — the source for the Layers List (الطبقات الفاعلة)
 * and the Attestations queries. Token-protected: requests 401/499 without a token
 * registered for its server (see Map/index.tsx). Env: ARCGIS_BUSINESS_MAP_URL.
 */
export const BUSINESS_MAP_URL = getBusinessMapUrl();

/**
 * The active basemap (خريطة الأساس) — the BasemapV2 MapServer, now CACHED
 * (singleFusedMapCache:true), so it's consumed as a TileLayer, not a MapImageLayer. Its
 * tiling scheme is WKID 32637 (UTM Zone 37N), so applying it as the basemap puts the whole
 * MapView into UTM 37N (cached tiles can't be reprojected) — the same SR the imagery raster
 * tiles use, so they render aligned over it.
 * (Formerly a dynamic MapServer that also backed the Layers List; layers now come from
 * BUSINESS_MAP_URL, and the new cache makes V2 fast enough to serve as the basemap.)
 * Env: ARCGIS_BASEMAP_V2_URL.
 */
export const BASEMAP_V2_URL = getBasemapV2Url();

/**
 * PREVIOUS basemap — the CACHED (singleFusedMapCache) BasemapV1 MapServer. Same tiling
 * scheme as BasemapV2 (WKID 32637, 256² tiles, 13 LODs), so it's a drop-in alternative.
 * Superseded by BASEMAP_V2_URL as the active basemap; kept as a fallback / perf-comparison
 * toggle — see the basemap effect in Map/index.tsx and scene.ts.
 * Env: ARCGIS_BASEMAP_V1_URL.
 */
export const BASEMAP_V1_CACHED_URL = getBasemapV1Url();

/**
 * CACHED street/label reference map (`BasemapHybridV1Cache1`) — the hybrid mode's overlay.
 * Same tiling scheme as BASEMAP_V2_URL (WKID 32637, 256², 13 LODs) so it drapes pixel-aligned;
 * opaque, so the switcher store multiply-blends it. Env: ARCGIS_BASEMAP_HYBRID_URL.
 */
export const BASEMAP_HYBRID_URL = getBasemapHybridUrl();

/**
 * The `Raster` folder root — 41 CACHED dated aerial/satellite MapServers (dossier §6),
 * one per capture. Each is `singleFusedMapCache:true` (consume as a TileLayer) and tiled
 * in WKID 32637 (UTM 37N) — the SAME SR the MapView uses via BASEMAP_V2_URL, so
 * imagery tiles render over the basemap (the old 32637-vs-3857 projection blocker is gone).
 * Backs the المصورات (Imagery Catalogue) widget; service names are parsed into dated items.
 * Env: ARCGIS_RASTER_FOLDER_URL.
 */
export const RASTER_FOLDER_URL = getRasterFolderUrl();

/**
 * The municipality's own "Export Web Map Task" print GPServer — `Utilities/PrintingTools`
 * on the `sdi` host. Backs the طباعة (Print) widget so PDFs are produced by Holy Makkah
 * Municipality's own infrastructure instead of Esri's public sample service at
 * `utility.arcgisonline.com` (TOOLS-01). Verified live 2026-07-19 via `.../GPServer?f=json`:
 * the folder/service is `Utilities/PrintingTools` (not `PrintingToolsNew`) and the task is
 * `Export Web Map Task` (not `Export Web Map`) — its literal space is URL-encoded as `%20`.
 * Pass this URL straight to `@arcgis/core/rest/print.execute`. Env: ARCGIS_PRINT_SERVICE_URL.
 */
export const PRINT_SERVICE_URL = getPrintServiceUrl();

/* ── 3D scene (the 2D/3D toggle) — consumed by features/Map/scene.ts ───────── */

/**
 * The municipality's authored 3D WebScene on its own Portal (the 3D source).
 * Runtime-resolved (ARCGIS_SCENE_WEBSCENE_ID) — the item id differs per environment;
 * falls back to the production item. See lib/runtimeConfig.ts.
 */
export const SCENE_WEBSCENE_ITEM_ID = getSceneWebSceneId();

/**
 * Basemap overlaid under the scene — the Portal's "Imagery with Labels" item (the WebScene's own
 * basemap renders white under our static token; this loads with the geoportal token instead).
 * Also accepts "osm", a tile-service URL, or "none" (no override — the WebScene keeps its
 * authored basemap). Runtime-resolved (ARCGIS_SCENE_BASEMAP_ID) — see lib/runtimeConfig.ts.
 */
export const SCENE_BASEMAP = getSceneBasemapId();

/**
 * The imagery entry (صور جوية) listed in the basemap picker — its OWN setting, decoupled
 * from SCENE_BASEMAP so the 3D scene-override choice never changes the picker list
 * (setting SCENE_BASEMAP to "none" used to silently drop this entry). "none" hides it.
 * Runtime-resolved (ARCGIS_GALLERY_IMAGERY_ID) — see lib/runtimeConfig.ts.
 */
export const GALLERY_IMAGERY = getGalleryImageryId();

/** Portal backing the WebScene + basemap items (geoportal Portal — same token as 2D). */
export const SCENE_PORTAL_URL = ARCGIS_PORTAL_URL;

export interface LayerConfig {
  /** Stable machine id — used by the NEXT_PUBLIC_ENABLED_LAYERS allow-list override. */
  id: string;
  /** Arabic label — matched (normalized) against the service's sublayer titles. */
  label: string;
  labelEn: string;
  /**
   * Whether the layer is allowed in this deployment. Disabled layers are hidden on the
   * map and never listed in the TOC. Overridable per-environment via
   * NEXT_PUBLIC_ENABLED_LAYERS (comma-separated ids).
   */
  enabled: boolean;
  /** Drawn on the map before the user touches the Layers List (legacy default: all off). */
  defaultVisible: boolean;
  /** Gated by role/department (enforced later — ROLE epic). false = public/anonymous. */
  isSecure: boolean;
  /** Whether click/hover identify popups apply to this layer (legacy `forIdentify`). */
  forIdentify: boolean;
}

/**
 * The BusinessMap operational layers shown in the Layers List — the layer set from the
 * legacy explorer's TOC (alphabetical, all initially unchecked). Sublayer ids are not
 * pinned here: the service is matched by (normalized) Arabic title at runtime, which
 * survives id reshuffles across service republications.
 */
export const OPERATIONAL_LAYERS: LayerConfig[] = [
  {
    id: "districts",
    label: "الأحياء",
    labelEn: "Districts",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: true,
  },
  {
    id: "sub-municipalities",
    label: "البلديات",
    labelEn: "Sub-municipalities",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: true,
  },
  {
    id: "mountains",
    label: "الجبال",
    labelEn: "Mountains",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: false,
  },
  {
    id: "ring-roads",
    label: "الطرق الدائرية",
    labelEn: "Ring roads",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: false,
  },
  {
    id: "stations",
    label: "المحطات",
    labelEn: "Stations",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: true,
  },
  {
    id: "unplanned-areas",
    label: "المناطق العشوائية",
    labelEn: "Unplanned areas",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: true,
  },
  {
    id: "urban-boundary",
    label: "النطاق العمراني",
    labelEn: "Urban boundary",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: true,
  },
  {
    id: "development-boundary",
    label: "حد التنمية",
    labelEn: "Development boundary",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: true,
  },
  {
    id: "haram-boundary",
    label: "حد الحرم",
    labelEn: "Haram boundary",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: true,
  },
  {
    id: "centers-boundaries",
    label: "حدود المراكز",
    labelEn: "Centers boundaries",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: true,
  },
  {
    id: "mashaaer-protected-zone",
    label: "حمى المشاعر المقدسة",
    labelEn: "Holy Mashaaer protected zone",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: true,
  },
  {
    id: "wadi-ibrahim-basin",
    label: "حوض وادي إبراهيم",
    labelEn: "Wadi Ibrahim basin",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: true,
  },
  {
    id: "regulatory-parcels",
    label: "قطع الأراضي التنظيمية",
    labelEn: "Regulatory land parcels",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: true,
  },
  {
    id: "subdivision-plans",
    label: "مخططات الأراضي التقسيمية",
    labelEn: "Land subdivision plans",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: true,
  },
  {
    id: "bus-routes",
    label: "مسار الحافلات",
    labelEn: "Bus routes",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: false,
  },
  {
    id: "landmarks",
    label: "معالم تاريخية و سياحية",
    labelEn: "Historical & tourist landmarks",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: true,
  },
  {
    id: "ground-control-points",
    label: "نقاط الثوابت الارضية",
    labelEn: "Ground control points",
    enabled: true,
    defaultVisible: false,
    isSecure: false,
    forIdentify: false,
  },
];

/** Optional per-environment allow-list: NEXT_PUBLIC_ENABLED_LAYERS="districts,haram-boundary". */
const ENV_ENABLED_IDS = (process.env.NEXT_PUBLIC_ENABLED_LAYERS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** The deployment allow-list: the env override when present, otherwise `enabled: true`. */
function configuredLayers(): LayerConfig[] {
  if (ENV_ENABLED_IDS.length > 0) {
    return OPERATIONAL_LAYERS.filter((l) => ENV_ENABLED_IDS.includes(l.id));
  }
  return OPERATIONAL_LAYERS.filter((l) => l.enabled);
}

let grantedLayers: LayerConfig[] = [];
let grantedFrom: PermissionsSnapshot | null = null;

/**
 * THE layer-catalog entry point: the deployment allow-list intersected with the
 * session's granted map layers (PERM-21). Denied layers never reach the map, the TOC,
 * search or compare — and are empty (fail closed) until permissions resolve.
 * Matched on the Arabic label: that is how MAPSERVICES spells every layer (all 17
 * resolve by label in the production dump; none by `id` or `labelEn`).
 */
export function getEnabledLayers(): LayerConfig[] {
  // Memoized on the snapshot's identity — the store publishes a new one per change.
  const snapshot = permissionsStore.getSnapshot();
  if (snapshot === grantedFrom) return grantedLayers;
  grantedLayers = configuredLayers().filter((l) => permissionsStore.allowedLayer(l.label));
  grantedFrom = snapshot;
  return grantedLayers;
}
