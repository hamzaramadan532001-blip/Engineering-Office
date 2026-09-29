/**
 * Server-side half of the runtime config (see `runtimeConfig.ts`).
 *
 * Reads the ArcGIS tokens, service hosts, and 3D scene item ids from `process.env`
 * at request time and serialises them into an inline bootstrap script that sets
 * `window.__MAKKAH_RUNTIME_CONFIG__` before the app bundle runs. Self-hosted deploys
 * provide the values via the `makkah-gis.env` file (loaded into `process.env` by
 * `start.js`); anything left unset falls back, on the client, to the build-time
 * `NEXT_PUBLIC_*` token or the production default host/id in `runtimeConfig.ts`.
 *
 * `app/layout.tsx` must be `force-dynamic` so this runs per request on the running
 * server rather than being frozen into the static prerender at build time.
 *
 * Server-only: imported solely by `app/layout.tsx` (a server component). The host/id
 * vars are not secret, but the tokens are — and the non-public `process.env` it reads
 * is empty in a client bundle anyway, so nothing secret can leak even if misimported.
 */
import { RUNTIME_CONFIG_KEY, type RuntimeConfig } from "./runtimeConfig";

function readServerRuntimeConfig(): RuntimeConfig {
  // Unset URL/id vars are injected as "" and resolved to the production default on
  // the client (see runtimeConfig.ts) — QA only sets the keys that actually differ.
  return {
    arcgisToken: process.env.ARCGIS_TOKEN || process.env.NEXT_PUBLIC_ARCGIS_TOKEN || "",
    // BusinessMap token reuses the geoportal token when unset. The runtime ARCGIS_TOKEN
    // must beat any build-time-baked NEXT_PUBLIC_BUSINESS_MAP_TOKEN — otherwise a
    // self-hosted env that sets only ARCGIS_TOKEN (e.g. QA, where both services share
    // one host + token) would fall back to a stale baked production BusinessMap token.
    // `||` (not `??`) so an empty `BUSINESS_MAP_TOKEN=` line in the env file falls through.
    businessMapToken:
      process.env.BUSINESS_MAP_TOKEN ||
      process.env.ARCGIS_TOKEN ||
      process.env.NEXT_PUBLIC_BUSINESS_MAP_TOKEN ||
      process.env.NEXT_PUBLIC_ARCGIS_TOKEN ||
      "",
    portalUrl: process.env.ARCGIS_PORTAL_URL ?? "",
    municipalAssetsUrl: process.env.ARCGIS_MUNICIPAL_ASSETS_URL ?? "",
    complaintsUrl: process.env.ARCGIS_COMPLAINTS_URL ?? "",
    changeDetectionUrl: process.env.ARCGIS_CHANGE_DETECTION_URL ?? "",
    executiveDashboardUrl: process.env.ARCGIS_EXECUTIVE_DASHBOARD_URL ?? "",
    businessMapUrl: process.env.ARCGIS_BUSINESS_MAP_URL ?? "",
    regulationTransactionsUrl: process.env.ARCGIS_REGULATION_TRANSACTIONS_URL ?? "",
    basemapV1Url: process.env.ARCGIS_BASEMAP_V1_URL ?? "",
    basemapV2Url: process.env.ARCGIS_BASEMAP_V2_URL ?? "",
    basemapHybridUrl: process.env.ARCGIS_BASEMAP_HYBRID_URL ?? "",
    rasterFolderUrl: process.env.ARCGIS_RASTER_FOLDER_URL ?? "",
    printServiceUrl: process.env.ARCGIS_PRINT_SERVICE_URL ?? "",
    sceneWebSceneId: process.env.ARCGIS_SCENE_WEBSCENE_ID ?? "",
    sceneBasemapId: process.env.ARCGIS_SCENE_BASEMAP_ID ?? "",
    galleryImageryId: process.env.ARCGIS_GALLERY_IMAGERY_ID ?? "",
  };
}

/**
 * Returns the inline-script body that hydrates `window.__MAKKAH_RUNTIME_CONFIG__`.
 * `<` is escaped so a token can never break out of the surrounding `<script>`.
 */
export function serializeRuntimeConfig(): string {
  const json = JSON.stringify(readServerRuntimeConfig()).replace(/</g, "\\u003c");
  return `window.${RUNTIME_CONFIG_KEY}=${json};`;
}
