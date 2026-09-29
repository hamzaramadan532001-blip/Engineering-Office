/**
 * Runtime ArcGIS config resolution (client side).
 *
 * Self-hosted (Windows Server) deploys set the ArcGIS tokens AND the per-environment
 * service URLs / 3D scene item ids at *runtime* via an env file (`makkah-gis.env`),
 * so they cannot be baked into the client bundle the way `NEXT_PUBLIC_*` values are.
 * The server reads them from `process.env` per request and injects them as
 * `window.__MAKKAH_RUNTIME_CONFIG__` (see `runtimeConfig.server.ts`, used by
 * `app/layout.tsx`). This module reads that global on the client.
 *
 * Full service URLs (not just hosts) are configurable on purpose: environments
 * differ by web-adaptor path (prod `/arcgis/rest/services` vs QA `/server/rest/services`),
 * by service name (`MunicipalAssetV1` vs `Dashboard/Dashboard`), AND by host
 * consolidation (QA serves the dashboard, BusinessMap, and portal from one host).
 * A host-only knob cannot express that — each URL is overridable independently.
 *
 * Resolution order, per value:
 *   1. window.__MAKKAH_RUNTIME_CONFIG__  — server-injected (the self-hosted path).
 *   2. tokens only: build-time NEXT_PUBLIC_* — dev/Vercel convenience.
 *   3. PRODUCTION_DEFAULTS — so an unset value keeps today's production behaviour and
 *      QA only has to override the few keys that actually differ in `makkah-gis.env`.
 *
 * Values are fixed for the lifetime of a page load (the env file is read once at
 * server start), so a plain synchronous read is enough — no reactive store needed.
 * It also means callers in React-free `api.ts` modules can read them directly.
 */

export interface RuntimeConfig {
  /** Geoportal token — portal, dashboard data, and the 3D WebScene. */
  arcgisToken: string;
  /** Secured BusinessMap server token — operational layers + Attestations. */
  businessMapToken: string;
  /** Portal URL — token registration + the 3D scene/basemap Portal items. */
  portalUrl: string;
  /** Development dashboard MapServer (sublayers queried by index). */
  municipalAssetsUrl: string;
  /** Complaints FeatureServer layer (مؤشرات البلاغات). */
  complaintsUrl: string;
  /** Change-detection MapServer (لوحة رصد التغيرات) — sublayers /5 + /6 queried by index. */
  changeDetectionUrl: string;
  /** Executive dashboard MapServer (اللوحة التنفيذية لوكالة التعمير) — 3 sublayers by index. */
  executiveDashboardUrl: string;
  /** Secured BusinessMap MapServer — operational layers (الطبقات الفاعلة) + Attestations. */
  businessMapUrl: string;
  /** Editable transactions FeatureServer (معاملات تنظيمية) — the requests table, the CAD
   *  parcel layer, and the two regulation-boundary result layers, all keyed by
   *  TRANSACTION_ID. See REGULATION_LAYERS in lib/arcgis.ts. */
  regulationTransactionsUrl: string;
  /** Active 2D/3D basemap MapServer (cached TileLayer). */
  basemapV1Url: string;
  /** Alternate basemap MapServer (kept for reference / perf comparison). */
  basemapV2Url: string;
  /** Cached street/label reference MapServer draped over imagery in hybrid mode (BM-05). */
  basemapHybridUrl: string;
  /** Raster imagery folder (المصورات) — dated capture MapServers live under it. */
  rasterFolderUrl: string;
  /** Municipal "Export Web Map Task" print GPServer (طباعة widget, TOOLS-01). */
  printServiceUrl: string;
  /** Portal item id of the 3D WebScene (the 2D/3D toggle source). */
  sceneWebSceneId: string;
  /** Portal item id of the basemap shown under the 3D scene. */
  sceneBasemapId: string;
  /** Portal item id of the imagery entry in the basemap picker ("none" hides it). */
  galleryImageryId: string;
}

/** The global the server injects and the client reads. */
export const RUNTIME_CONFIG_KEY = "__MAKKAH_RUNTIME_CONFIG__";

declare global {
  interface Window {
    __MAKKAH_RUNTIME_CONFIG__?: Partial<RuntimeConfig>;
  }
}

/**
 * Production values — the fallback when a key is unset, so a stock build (dev,
 * Vercel, or a self-hosted box with an empty env file) still points at production.
 * QA/other environments override only the keys that differ in `makkah-gis.env`.
 */
const PRODUCTION_DEFAULTS = {
  portalUrl: "https://geoportal.holymakkah.gov.sa/portal",
  municipalAssetsUrl:
    "https://geoportal.holymakkah.gov.sa/arcgis/rest/services/MunicipalAssetV1/MapServer",
  complaintsUrl:
    "https://geoportal.holymakkah.gov.sa/arcgis/rest/services/Complain_MIL1/FeatureServer/0",
  changeDetectionUrl:
    "https://geoportal.holymakkah.gov.sa/arcgis/rest/services/ChangeDetictionVer2_MIL1/MapServer",
  executiveDashboardUrl:
    "https://maps.holymakkah.gov.sa/arcgis/rest/services/SDI/BusinessMapgisViewerSdiV5/MapServer",
  businessMapUrl:
    "https://maps.holymakkah.gov.sa/arcgis/rest/services/SDI/MMSDI_MD_BusinessMap/MapServer",
  regulationTransactionsUrl:
    "https://maps.holymakkah.gov.sa/arcgis/rest/services/SDI/Regulation571EditTrans/FeatureServer",
  basemapV1Url:
    "https://sdi.holymakkah.gov.sa/arcgis/rest/services/Basemaps/BasemapV1Cach2/MapServer",
  basemapV2Url: "https://sdi.holymakkah.gov.sa/arcgis/rest/services/Basemaps/BasemapV2/MapServer",
  basemapHybridUrl:
    "https://sdi.holymakkah.gov.sa/arcgis/rest/services/Basemaps/BasemapHybridV1Cache1/MapServer",
  rasterFolderUrl: "https://sdi.holymakkah.gov.sa/arcgis/rest/services/Raster",
  // Utilities/PrintingTools GPServer, "Export Web Map Task" (verified live 2026-07-19 via
  // .../GPServer?f=json — NOT the "PrintingToolsNew" / "Export Web Map" names the task was
  // originally scoped against). The task name's literal space is URL-encoded as %20.
  // Host matters: BOTH hosts publish this service, but sdi's copy hangs indefinitely on
  // execute (>120s, no response), while geoportal's returns a PDF in ~20s — verified by
  // executing the task live against each host.
  printServiceUrl:
    "https://geoportal.holymakkah.gov.sa/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task",
  sceneWebSceneId: "774eff45bd34490ba403221be1213811",
  sceneBasemapId: "30699b07b44f47ef929b9e216594a7db",
  // The picker's imagery entry (صور جوية) — deliberately its OWN setting, decoupled
  // from sceneBasemapId: the 3D scene-override choice must never change what the
  // basemap picker lists. Geoportal "Imagery with Labels" item.
  galleryImageryId: "30699b07b44f47ef929b9e216594a7db",
} as const;

/** Build-time token fallback for dev + Vercel. `NEXT_PUBLIC_*` is inlined at build. */
const BUILD_TIME_TOKENS = {
  arcgisToken: process.env.NEXT_PUBLIC_ARCGIS_TOKEN ?? "",
  businessMapToken: process.env.NEXT_PUBLIC_BUSINESS_MAP_TOKEN ?? "",
};

/** Drop a trailing slash so `${url}/query` etc. never doubles up. */
function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Injected value if non-empty, else the production default — trailing slash trimmed. */
function pickUrl(injected: string | undefined, fallback: string): string {
  return trimSlash(injected || fallback);
}

function resolve(): RuntimeConfig {
  const injected = typeof window !== "undefined" ? window.__MAKKAH_RUNTIME_CONFIG__ : undefined;

  const arcgisToken = injected?.arcgisToken || BUILD_TIME_TOKENS.arcgisToken;
  // BusinessMap token falls back to the geoportal token (documented behaviour:
  // see .env.example "Falls back to the geoportal token when unset").
  const businessMapToken =
    injected?.businessMapToken || BUILD_TIME_TOKENS.businessMapToken || arcgisToken;

  return {
    arcgisToken,
    businessMapToken,
    portalUrl: pickUrl(injected?.portalUrl, PRODUCTION_DEFAULTS.portalUrl),
    municipalAssetsUrl: pickUrl(
      injected?.municipalAssetsUrl,
      PRODUCTION_DEFAULTS.municipalAssetsUrl,
    ),
    complaintsUrl: pickUrl(injected?.complaintsUrl, PRODUCTION_DEFAULTS.complaintsUrl),
    changeDetectionUrl: pickUrl(
      injected?.changeDetectionUrl,
      PRODUCTION_DEFAULTS.changeDetectionUrl,
    ),
    executiveDashboardUrl: pickUrl(
      injected?.executiveDashboardUrl,
      PRODUCTION_DEFAULTS.executiveDashboardUrl,
    ),
    businessMapUrl: pickUrl(injected?.businessMapUrl, PRODUCTION_DEFAULTS.businessMapUrl),
    regulationTransactionsUrl: pickUrl(
      injected?.regulationTransactionsUrl,
      PRODUCTION_DEFAULTS.regulationTransactionsUrl,
    ),
    basemapV1Url: pickUrl(injected?.basemapV1Url, PRODUCTION_DEFAULTS.basemapV1Url),
    basemapV2Url: pickUrl(injected?.basemapV2Url, PRODUCTION_DEFAULTS.basemapV2Url),
    basemapHybridUrl: pickUrl(injected?.basemapHybridUrl, PRODUCTION_DEFAULTS.basemapHybridUrl),
    rasterFolderUrl: pickUrl(injected?.rasterFolderUrl, PRODUCTION_DEFAULTS.rasterFolderUrl),
    printServiceUrl: pickUrl(injected?.printServiceUrl, PRODUCTION_DEFAULTS.printServiceUrl),
    sceneWebSceneId: injected?.sceneWebSceneId || PRODUCTION_DEFAULTS.sceneWebSceneId,
    sceneBasemapId: injected?.sceneBasemapId || PRODUCTION_DEFAULTS.sceneBasemapId,
    galleryImageryId: injected?.galleryImageryId || PRODUCTION_DEFAULTS.galleryImageryId,
  };
}

/** Geoportal token: portal, dashboard data, 3D WebScene + scene basemaps. */
export function getArcgisToken(): string {
  return resolve().arcgisToken;
}

/** Secured BusinessMap token (falls back to the geoportal token when unset). */
export function getBusinessMapToken(): string {
  return resolve().businessMapToken;
}

/** Portal URL — token registration + the 3D scene/basemap Portal items. */
export function getPortalUrl(): string {
  return resolve().portalUrl;
}

/** Development dashboard MapServer URL. */
export function getMunicipalAssetsUrl(): string {
  return resolve().municipalAssetsUrl;
}

/** Complaints FeatureServer layer URL (مؤشرات البلاغات). */
export function getComplaintsUrl(): string {
  return resolve().complaintsUrl;
}

/** Change-detection MapServer URL (لوحة رصد التغيرات — sublayers /5 + /6). */
export function getChangeDetectionUrl(): string {
  return resolve().changeDetectionUrl;
}

/** Executive dashboard MapServer URL (اللوحة التنفيذية لوكالة التعمير — BusinessMapgisViewerSdiV5). */
export function getExecutiveDashboardUrl(): string {
  return resolve().executiveDashboardUrl;
}

/** Secured BusinessMap MapServer URL — operational layers + Attestations. */
export function getBusinessMapUrl(): string {
  return resolve().businessMapUrl;
}

/** Editable transactions FeatureServer URL (Regulation571EditTrans). */
export function getRegulationTransactionsUrl(): string {
  return resolve().regulationTransactionsUrl;
}

/** Active basemap MapServer URL (BasemapV1Cach2). */
export function getBasemapV1Url(): string {
  return resolve().basemapV1Url;
}

/** Alternate basemap MapServer URL (BasemapV2 — reference). */
export function getBasemapV2Url(): string {
  return resolve().basemapV2Url;
}

/** Cached street/label reference MapServer URL — the hybrid overlay (BM-05). */
export function getBasemapHybridUrl(): string {
  return resolve().basemapHybridUrl;
}

/** Raster imagery folder URL (المصورات). */
export function getRasterFolderUrl(): string {
  return resolve().rasterFolderUrl;
}

/** Municipal print GPServer URL — the طباعة widget's "Export Web Map Task" (TOOLS-01). */
export function getPrintServiceUrl(): string {
  return resolve().printServiceUrl;
}

/** Portal item id of the 3D WebScene. */
export function getSceneWebSceneId(): string {
  return resolve().sceneWebSceneId;
}

/** Portal item id of the basemap shown under the 3D scene. */
export function getSceneBasemapId(): string {
  return resolve().sceneBasemapId;
}

/** Portal item id of the picker's imagery entry ("none" hides it). */
export function getGalleryImageryId(): string {
  return resolve().galleryImageryId;
}
