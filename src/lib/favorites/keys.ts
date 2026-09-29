/** The favoritable surfaces. The prefix namespaces ids so the two lists never collide. */
export type FavoriteKind = "layer" | "imagery";

/** Build the namespaced favorite id for an item (e.g. `layer:الطرق`, `imagery:cap-2019`). */
export const favoriteId = (kind: FavoriteKind, id: string): string => `${kind}:${id}`;
