"use client";

import type Basemap from "@arcgis/core/Basemap";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import type EsriMap from "@arcgis/core/Map";
import { useMemo, useSyncExternalStore } from "react";
import { isMapView } from "@/app/features/Map/types";
import { getMapElement } from "@/app/features/Map/utils";
import { basemapFingerprint, buildBasemap, type ModeBasemap, readMode } from "./basemaps";
import { type BasemapMode, LOAD_ERROR_TEXT, NO_SATELLITE_TEXT } from "./constants";

/** The store's React-facing value: the live mode plus the actions the panel calls. */
export interface BasemapSwitcherView {
  /** The active mode, or null when the basemap is something else (gallery / Imagery pick). */
  mode: BasemapMode | null;
  /** A mode was requested and its layers are still loading. */
  loading: boolean;
  /** Arabic copy for a failed switch — null while healthy. */
  errorText: string | null;
  /** Apply a mode to the map. No-op in 3D (see the SceneView note in `select`). */
  select: (mode: BasemapMode) => void;
  /** Re-apply the last requested mode after a failure. */
  retry: () => void;
}

type Handle = { remove: () => void };

const EMPTY: BasemapSwitcherView = {
  mode: null,
  loading: false,
  errorText: null,
  select: () => {},
  retry: () => {},
};

/**
 * The map owns the basemap, so the mode is derived from `baseLayers` + `referenceLayers` on
 * every change: the choice survives reopening the panel, and a basemap set elsewhere (gallery,
 * Imagery panel) reads back as "no mode".
 */
function createBasemapSwitcherStore() {
  let snapshot: BasemapSwitcherView = EMPTY;
  let notify: (() => void) | null = null;
  const handles: Handle[] = [];
  // One Basemap per mode, reused across switches. A failed load drops its entry so `retry`
  // rebuilds the layers instead of re-awaiting the same rejected promise.
  const basemaps = new Map<BasemapMode, ModeBasemap>();

  let requested: BasemapMode | null = null;
  let assigned: Basemap | null = null;
  let loading = false;
  let errorText: string | null = null;

  const getMap = (): EsriMap | null => getMapElement()?.view?.map ?? null;

  function basemapFor(mode: BasemapMode): ModeBasemap | null {
    const cached = basemaps.get(mode);
    if (cached) return cached;
    const built = buildBasemap(mode);
    if (built) basemaps.set(mode, built);
    return built;
  }

  function select(mode: BasemapMode) {
    const map = getMap();
    // 3D is deliberately inert: SceneView rejects these WKID 32637 caches
    // (tiling-scheme-unsupported), so the panel disables the control and the gallery takes over.
    if (!map || !isMapView(getMapElement()?.view)) return;

    const entry = basemapFor(mode);
    requested = mode;
    if (!entry) {
      loading = false;
      errorText = NO_SATELLITE_TEXT;
      rebuild();
      return;
    }

    loading = true;
    errorText = null;
    // Assign a whole Basemap instead of editing the live one in place: the Esri gallery hands
    // the map ITS OWN Basemap objects, and mutating those would corrupt the gallery's entries.
    assigned = entry.basemap;
    map.basemap = entry.basemap;
    rebuild();

    Promise.all(entry.layers.map((layer) => layer.load())).then(
      () => {
        if (requested !== mode) return;
        loading = false;
        errorText = null;
        rebuild();
      },
      () => {
        basemaps.delete(mode);
        if (requested !== mode) return;
        loading = false;
        errorText = LOAD_ERROR_TEXT;
        rebuild();
      },
    );
  }

  function retry() {
    if (requested) select(requested);
  }

  function recompute() {
    const map = getMap();
    // The gallery (or the Imagery panel) replaced our basemap — drop the pending/failed state
    // so a stale error cannot outlive the choice it belonged to.
    if (map && assigned && map.basemap !== assigned) {
      assigned = null;
      requested = null;
      loading = false;
      errorText = null;
    }
    snapshot = { mode: map ? readMode(map) : null, loading, errorText, select, retry };
  }

  function rebuild() {
    recompute();
    notify?.();
  }

  function subscribe(onChange: () => void) {
    notify = onChange;
    recompute();
    const map = getMap();
    if (!map) {
      return () => {
        notify = null;
      };
    }

    // Watches the whole chain (basemap → baseLayers → referenceLayers), so a basemap swapped in
    // by the gallery or the Imagery panel re-derives the mode too.
    handles.push(reactiveUtils.watch(() => basemapFingerprint(map), rebuild));

    return () => {
      for (const h of handles) h.remove();
      handles.length = 0;
      notify = null;
    };
  }

  return { subscribe, getSnapshot: () => snapshot };
}

/** React hook: the live basemap mode + the switch actions, kept in sync with the map. */
export function useBasemapSwitcher(): BasemapSwitcherView {
  const store = useMemo(() => createBasemapSwitcherStore(), []);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY);
}
