"use client";

/**
 * Favorites store — a tiny, framework-agnostic singleton that persists the set of
 * "favorited" item ids to localStorage and notifies subscribers when it changes.
 *
 * It exposes the same `{ subscribe, getSnapshot }` shape as the ArcGIS stores
 * (Imagery / graphicLayer), so React consumes it through `useSyncExternalStore`
 * (see useFavorites). Unlike those, it is a MODULE-LEVEL singleton — not created per
 * mount — so every widget that reads it shares one source of truth: favoriting an
 * item in the Layers list reflects in the Imagery list immediately, and vice-versa.
 * Ids are namespaced by kind (`layer:<key>`, `imagery:<id>` — see keys.ts) so the
 * two lists can never collide.
 */

/** The favorited ids, stored as an object for cheap JSON (de)serialization. */
export type FavoritesState = Record<string, true>;

/** localStorage key; versioned so the persisted shape can evolve without colliding. */
const STORAGE_KEY = "makkah-gis:favorites:v1";

/** Stable empty snapshot — the server value and the "nothing favorited" reference. */
const EMPTY: FavoritesState = {};

const listeners = new Set<() => void>();
let state: FavoritesState = read();
let storageBound = false;

/** Read + parse the persisted set, tolerating SSR (no window) and corrupt/old data. */
function read(): FavoritesState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as FavoritesState) : EMPTY;
  } catch {
    return EMPTY; // corrupt JSON / blocked storage — never throw during a render
  }
}

/** Persist the current set, swallowing quota / private-mode errors (UI must not break). */
function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded / storage disabled — keep in-memory state, skip persistence */
  }
}

function emit() {
  for (const listener of listeners) listener();
}

/** Cross-tab sync: adopt a write made in another tab and re-render. */
function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY) {
    state = read();
    emit();
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (!storageBound && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
    storageBound = true;
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && storageBound && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
      storageBound = false;
    }
  };
}

/**
 * Toggle one id on/off. Assigns a NEW object reference to `state` so
 * `useSyncExternalStore`'s snapshot comparison detects the change and re-renders.
 */
function toggle(id: string) {
  const next: FavoritesState = { ...state };
  if (next[id]) delete next[id];
  else next[id] = true;
  state = next;
  persist();
  emit();
}

export const favoritesStore = {
  subscribe,
  getSnapshot: (): FavoritesState => state,
  getServerSnapshot: (): FavoritesState => EMPTY,
  isFavorite: (id: string) => Boolean(state[id]),
  toggle,
};
