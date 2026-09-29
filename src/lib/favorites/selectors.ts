import type { FavoritesState } from "./store";

/**
 * Stable favorites-first ordering: favorited items float to the top, each group
 * keeping its original relative order. Pure — unit-testable without a render. Returns
 * the SAME array reference when nothing is favorited, so memoized callers don't
 * re-render needlessly.
 */
export function sortFavoritesFirst<T>(
  items: T[],
  getId: (item: T) => string,
  favorites: FavoritesState,
): T[] {
  const favored: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (favorites[getId(item)]) favored.push(item);
    else rest.push(item);
  }
  return favored.length === 0 ? items : [...favored, ...rest];
}
