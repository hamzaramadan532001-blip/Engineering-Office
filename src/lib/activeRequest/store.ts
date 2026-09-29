"use client";

/**
 * Which request (طلب) the user is currently working on.
 *
 * This is the single piece of state that ties the two halves of the workflow together:
 * the Requests screen sets it when "عرض على الخريطة" is clicked, and the Map reads it to
 * decide whose CAD to load, and which request a newly uploaded CAD belongs to.
 *
 * It lives in `src/lib` rather than inside either feature because BOTH features need it
 * and neither may import the other's internals (CLAUDE.md). Same
 * `{ subscribe, getSnapshot, getServerSnapshot }` shape as `lib/favorites/store.ts` and
 * the CAD drawing store, so React reads it through `useSyncExternalStore`.
 *
 * Deliberately module-level and NOT persisted: "the request I am working on" is a
 * property of this browsing session, not of the user. A reload should land on the map
 * with nothing open rather than silently re-attach CAD uploads to a request the user has
 * forgotten they selected.
 */

export type ActiveRequest = {
  /** OBJECTID of the row in SDI.Transaction — what the Requests table shows as رقم الطلب,
   *  and what is written to TRANSACTION_ID on every linked layer. */
  id: number;
  /** Shown in the map's banner so the user can see which request is open. Optional: the
   *  id is the identity, the description is only ever a label. */
  description?: string;
};

const listeners = new Set<() => void>();
let state: ActiveRequest | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Opens a request. Re-selecting the SAME id is a no-op, so the map does not reload the
 *  CAD (and lose an unsaved view) just because the button was clicked twice. */
function setActive(request: ActiveRequest) {
  if (state?.id === request.id && state?.description === request.description) return;
  state = request;
  emit();
}

/** Leaves request context — the map goes back to behaving as a plain viewer. */
function clear() {
  if (state === null) return;
  state = null;
  emit();
}

export const activeRequestStore = {
  subscribe,
  getSnapshot: (): ActiveRequest | null => state,
  getServerSnapshot: (): ActiveRequest | null => null,
  setActive,
  clear,
};
