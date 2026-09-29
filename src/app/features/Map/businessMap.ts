"use client";

import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import MapImageLayer from "@arcgis/core/layers/MapImageLayer";
import type EsriMap from "@arcgis/core/Map";
import { normalizeArabicTitle } from "@/lib/arabic";
import { permissionsStore } from "@/lib/permissions/store";
import type { PermissionsSnapshot } from "@/lib/permissions/types";
import { BUSINESS_MAP_URL, getEnabledLayers } from "./arcgis.config";

/**
 * The BusinessMap operational-layer service (MMSDI_MD_BusinessMap) as a dynamic
 * MapImageLayer, plus the allow-list enforcement and title matching shared with the
 * Layers List store. Config (URLs, layer set) lives in arcgis.config.ts — this module
 * owns the ArcGIS-coupled glue.
 */

export { normalizeArabicTitle };

interface TitleSets {
  enabled: Set<string>;
  defaultVisible: Set<string>;
  identify: Set<string>;
}

let titleSets: TitleSets = { enabled: new Set(), defaultVisible: new Set(), identify: new Set() };
let titleSetsFrom: PermissionsSnapshot | null = null;

/**
 * Title lookups derived from the (permission-filtered) catalog. Rebuilt whenever the
 * session's grants change — they arrive after this module is imported.
 */
function getTitleSets(): TitleSets {
  const snapshot = permissionsStore.getSnapshot();
  if (snapshot === titleSetsFrom) return titleSets;
  const layers = getEnabledLayers();
  titleSets = {
    enabled: new Set(layers.map((l) => normalizeArabicTitle(l.label))),
    defaultVisible: new Set(
      layers.filter((l) => l.defaultVisible).map((l) => normalizeArabicTitle(l.label)),
    ),
    identify: new Set(
      layers.filter((l) => l.forIdentify).map((l) => normalizeArabicTitle(l.label)),
    ),
  };
  titleSetsFrom = snapshot;
  return titleSets;
}

/** True when a service sublayer title is in the allowed (enabled + granted) layer set. */
export function isAllowedLayerTitle(title: string | null | undefined): boolean {
  return !!title && getTitleSets().enabled.has(normalizeArabicTitle(title));
}

/** True when a sublayer title is in the identify-enabled set (the legacy `forIdentify` flag). */
export function isIdentifiableLayerTitle(title: string | null | undefined): boolean {
  return !!title && getTitleSets().identify.has(normalizeArabicTitle(title));
}

/**
 * Enforce the allowed set on every LEAF sublayer. `reset` puts each layer at its
 * configured default (load time); without it only denied layers are switched off,
 * so a grant change never undoes what the user toggled in the TOC.
 */
function applyAllowList(layer: MapImageLayer, reset: boolean): void {
  const { enabled, defaultVisible } = getTitleSets();
  layer.allSublayers.forEach((s) => {
    if (s.sublayers) return; // group folder — visibility is decided per leaf
    const title = normalizeArabicTitle(s.title ?? "");
    const allowed = enabled.has(title);
    if (reset) {
      s.visible = allowed && defaultVisible.has(title);
      return;
    }
    if (!allowed) s.visible = false;
  });
}

/**
 * Applies the configured defaults on the FIRST snapshot that actually carries grants,
 * and only hides after that. The service can load before the grants do; resetting then
 * would pin every layer hidden, and the later grant-change pass never re-shows one.
 */
function createAllowListEnforcer(layer: MapImageLayer): () => void {
  let defaultsApplied = false;
  return () => {
    const resolved = permissionsStore.getSnapshot().status !== "loading";
    applyAllowList(layer, resolved && !defaultsApplied);
    if (resolved) {
      defaultsApplied = true;
    }
  };
}

/**
 * Build the BusinessMap layer. Once the service metadata loads, the allow-list is
 * enforced on every LEAF sublayer, and re-enforced whenever the session's grants
 * change (a layer revoked mid-session stops drawing without a reload).
 */
export function createBusinessMapLayer(): MapImageLayer {
  const layer = new MapImageLayer({ url: BUSINESS_MAP_URL, title: "الطبقات الفاعلة" });
  layer
    .when(() => {
      const enforce = createAllowListEnforcer(layer);
      enforce();
      // Acquired here, released when ArcGIS destroys the layer (rule 16).
      const stop = permissionsStore.subscribe(() => {
        if (layer.destroyed) return stop();
        enforce();
      });
      reactiveUtils.once(() => layer.destroyed).then(stop, stop);
    })
    .catch((err: unknown) => {
      console.warn("BusinessMap layer failed to load:", err);
    });
  return layer;
}

/** Locate the BusinessMap layer wherever it was added (operational layers or basemap). */
export function findBusinessMapLayer(map: EsriMap): MapImageLayer | undefined {
  const pools = [map.layers, map.basemap?.baseLayers];
  for (const pool of pools) {
    const hit = pool?.find(
      (l) => l instanceof MapImageLayer && (l.url ?? "").startsWith(BUSINESS_MAP_URL),
    );
    if (hit) return hit as MapImageLayer;
  }
  return undefined;
}
