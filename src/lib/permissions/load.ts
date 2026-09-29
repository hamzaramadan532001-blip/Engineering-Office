/**
 * The permission-load procedure: one in-flight request at a time, written into the
 * store. Kept out of the provider so the component stays wiring only (rule 13), and
 * the abort controller it acquires is released in this module's own `finally` (rule 16).
 */
import { fetchSessionPermissions } from "./api";
import { permissionsStore } from "./store";

let inFlight: Promise<void> | null = null;
let controller: AbortController | null = null;

async function run(signal: AbortSignal): Promise<void> {
  const result = await fetchSessionPermissions(signal);
  // A cancelled load (provider unmounted) must not write anything.
  if (signal.aborted) return;
  if (result.ok) {
    permissionsStore.setPermissions(result.permissions, result.enforced);
    return;
  }
  permissionsStore.setError(result.code);
}

/**
 * Fetch the session's grants. Concurrent callers (focus + a 403 at once) share the
 * one request; a refresh keeps the current grants on screen instead of flashing back
 * to the loading state.
 */
export function loadPermissions(): Promise<void> {
  if (inFlight) return inFlight;

  const ctrl = new AbortController();
  controller = ctrl;
  if (permissionsStore.getSnapshot().permissions === null) {
    permissionsStore.setStatus("loading");
  }

  inFlight = run(ctrl.signal).finally(() => {
    inFlight = null;
    if (controller === ctrl) controller = null;
  });
  return inFlight;
}

/** Abort the in-flight load (provider unmount). */
export function cancelPermissionsLoad(): void {
  controller?.abort();
}
