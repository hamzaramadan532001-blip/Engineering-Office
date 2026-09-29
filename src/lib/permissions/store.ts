"use client";

/**
 * Permission store — a module-level singleton holding the session's grants, in the
 * same `{subscribe, getSnapshot}` shape as the favorites/ArcGIS stores. It is a
 * singleton (not per-mount) because non-React code reads it synchronously too:
 * `features/Map/arcgis.config.getEnabledLayers()` filters the layer catalog through
 * it before any component renders.
 *
 * Every change publishes a NEW snapshot object, so non-React readers memoize their
 * derived caches on its identity. Lookups go through upper-cased, Arabic-normalized
 * Sets so `can`/`allowedLayer` are O(1) and case-insensitive. Everything denies until grants are READY —
 * fail closed is the point of the card, not an optimization.
 */

import { normalizeArabicTitle } from "@/lib/arabic";
import type {
  PermissionsErrorCode,
  PermissionsSnapshot,
  PermissionsStatus,
  UserPermissions,
} from "./types";

const EMPTY_SNAPSHOT: PermissionsSnapshot = {
  status: "loading",
  permissions: null,
  error: null,
  enforced: true,
};

const listeners = new Set<() => void>();

let snapshot: PermissionsSnapshot = EMPTY_SNAPSHOT;
let functionKeys: Set<string> = new Set();
let layerKeys: Set<string> = new Set();

/** The one lookup key shape: Arabic-normalized then upper-cased. */
function toKey(name: string): string {
  return normalizeArabicTitle(name).toUpperCase();
}

function emit() {
  for (const listener of listeners) listener();
}

function setSnapshot(next: PermissionsSnapshot) {
  snapshot = next;
  emit();
}

/** Adopt a resolved permission set. `enforced: false` means the server gates nothing. */
function setPermissions(permissions: UserPermissions, enforced: boolean) {
  functionKeys = new Set(permissions.functions.map((f) => toKey(f.functionName)));
  layerKeys = new Set(permissions.mapLayers.map((l) => toKey(l.mapServiceLayerName)));
  setSnapshot({ status: "ready", permissions, error: null, enforced });
}

/** A load failed — keep denying, and let the UI say so (rule 14). */
function setError(code: PermissionsErrorCode) {
  functionKeys = new Set();
  layerKeys = new Set();
  setSnapshot({ status: "error", permissions: null, error: code, enforced: true });
}

function setStatus(status: PermissionsStatus) {
  if (snapshot.status === status) return;
  setSnapshot({ ...snapshot, status });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when the named function is granted. False while loading or on error. */
function can(functionName: string): boolean {
  if (!snapshot.enforced) return true;
  if (snapshot.status !== "ready") return false;
  return functionKeys.has(toKey(functionName));
}

/** True when the named map layer is granted. False while loading or on error. */
function allowedLayer(layerName: string): boolean {
  if (!snapshot.enforced) return true;
  if (snapshot.status !== "ready") return false;
  return layerKeys.has(toKey(layerName));
}

/** Reset to the initial deny-all state. Test seam only. */
function reset() {
  functionKeys = new Set();
  layerKeys = new Set();
  setSnapshot({ ...EMPTY_SNAPSHOT });
}

export const permissionsStore = {
  subscribe,
  getSnapshot: (): PermissionsSnapshot => snapshot,
  getServerSnapshot: (): PermissionsSnapshot => EMPTY_SNAPSHOT,
  setPermissions,
  setError,
  setStatus,
  can,
  allowedLayer,
  reset,
};
