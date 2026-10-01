export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/** The app's sub-path (next.config `basePath`, e.g. "/gis-viewer-eng"), "" at the root.
 *  Next applies it to <Link>/router/redirect on its own, but NOT to `fetch` or image
 *  `src` — those go through `withBasePath`/`apiUrl`. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a root-relative app path (`/logo.png`, `/login`) with the basePath. */
export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}

export function apiUrl(path: string): string {
  return `${API_BASE}${withBasePath(path)}`;
}

/** The app's fetch for OUR endpoints (`/api/**`) — resolves the base URL, nothing else. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
