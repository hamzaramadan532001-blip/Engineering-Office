"use client";

/**
 * CAD drawing store — a module-level singleton holding whatever CAD file is
 * currently drawn on the map, in WGS84.
 *
 * Why a store and not props: the upload tool (`CadUploadTool`) is a draggable
 * floating panel mounted by `ToolPanelHost`, while the operations panel
 * (`CadOperations`) is docked to the right edge of the map and mounted by
 * `Map2D`/`Map3D`. They are siblings with no common owner below the page, so
 * the drawing is published here instead of threaded through props.
 *
 * Follows the same `{ subscribe, getSnapshot, getServerSnapshot }` shape as
 * `lib/favorites/store.ts`, so React reads it through `useSyncExternalStore`.
 */

import type { GeoJSONFeatureCollection } from "./geometry";

/**
 * The CAD file's coordinates as the file itself carries them — the raw easting/northing
 * the GP task returned, BEFORE `reprojectToWGS84` touched them.
 *
 * Kept because `geoJSON` below is lossy for reporting purposes: reprojecting to WGS84 for
 * the map and then back to metres for the survey report is a round trip, and a round trip
 * does not reproduce the file's own digits. The شرقيات/شماليات table on the report has to
 * show exactly what the "قراءة الملف" table shows, so the report snaps back to these.
 */
export type CadSourceCoordinates = {
  /** Untouched collection in the file's own projected CRS. */
  geoJSON: GeoJSONFeatureCollection;
  /** That CRS's WKID (today always 32637 — see CadUploadTool/constants.ts). */
  wkid: number;
};

export type CadDrawing = {
  /** Original file name — also the map layer's title. */
  fileName: string;
  /** The drawn entities, already reprojected to WGS84 (4326). */
  geoJSON: GeoJSONFeatureCollection;
  /**
   * The same entities in the file's own CRS, when one was applied. `undefined` when the
   * file was already WGS84 (no reprojection happened, so `geoJSON` is already exact).
   */
  source?: CadSourceCoordinates;
  /** Bumped on every redraw so operations can tell "same file, new draw" apart. */
  drawId: number;
};

const listeners = new Set<() => void>();
let state: CadDrawing | null = null;
let nextDrawId = 1;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Called by CadUploadTool once a CAD file is successfully drawn on the map. */
function publish(
  fileName: string,
  geoJSON: GeoJSONFeatureCollection,
  source?: CadSourceCoordinates,
) {
  state = { fileName, geoJSON, source, drawId: nextDrawId++ };
  emit();
}

/** Called when the user clears the CAD file — operations panels react by
 *  removing any derived layers they added. */
function clear() {
  if (state === null) return;
  state = null;
  emit();
}

export const cadDrawingStore = {
  subscribe,
  getSnapshot: (): CadDrawing | null => state,
  getServerSnapshot: (): CadDrawing | null => null,
  publish,
  clear,
};
