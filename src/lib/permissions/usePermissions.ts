"use client";

import { useMemo, useSyncExternalStore } from "react";
import { permissionsStore } from "./store";

export interface PermissionsView {
  loading: boolean;
  isAdministrator: boolean;
  /** Case-insensitive; false while loading (fail closed). */
  can: (functionName: string) => boolean;
  /** Case-insensitive match on mapServiceLayerName; false while loading. */
  allowedLayer: (layerName: string) => boolean;
}

/**
 * React seam onto the permission store. It subscribes directly, so it answers — with
 * the store's deny-all snapshot — even outside a provider: a forgotten provider hides
 * UI instead of crashing or, worse, showing everything.
 */
export function usePermissions(): PermissionsView {
  const snapshot = useSyncExternalStore(
    permissionsStore.subscribe,
    permissionsStore.getSnapshot,
    permissionsStore.getServerSnapshot,
  );

  return useMemo(
    () => ({
      loading: snapshot.status === "loading",
      isAdministrator: snapshot.permissions?.isAdministrator ?? false,
      // The store's lookups are stable module functions; the snapshot is what changes.
      can: permissionsStore.can,
      allowedLayer: permissionsStore.allowedLayer,
    }),
    [snapshot],
  );
}
