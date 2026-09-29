"use client";

import { useSyncExternalStore } from "react";
import { favoritesStore } from "./store";

/**
 * React seam onto the favorites singleton. Returns the live favorites set (for memo
 * deps / selectors), a per-id predicate, and the toggle action. All persistence and
 * change notification lives in the store, so components stay presentation-only.
 */
export function useFavorites() {
  const favorites = useSyncExternalStore(
    favoritesStore.subscribe,
    favoritesStore.getSnapshot,
    favoritesStore.getServerSnapshot,
  );
  return {
    favorites,
    isFavorite: (id: string) => Boolean(favorites[id]),
    toggleFavorite: favoritesStore.toggle,
  };
}
