"use client";

/**
 * The coloured map layers for a request's regulation result.
 *
 * Adds the two SERVER layers — 1 (داخل الموقع) and 0 (خارج الموقع) — to the map, each
 * filtered to a single request through `definitionExpression`, and styled from
 * `regulationStyles.ts`. That filter is the whole safety property: the layers physically
 * cannot draw another request's rows, so request 1001's coloured split can never appear
 * while 1002 is open.
 *
 * Why server layers and not the transient GeoJSON the intersect produces: the transient one
 * is gone the moment the page reloads. These read from the service, so a request reopened
 * tomorrow still shows its coloured inside/outside split with no recomputation.
 *
 * Imperative rather than a React component on purpose — it is called both from
 * RequestCadSync (on request change) and from IntersectOperation (after a save, to pick up
 * the rows just written), and an imperative module needs no shared React state between two
 * unrelated trees.
 */

import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { regulationLayerUrl, REGULATION_LAYERS, TRANSACTION_ID_FIELD } from "@/lib/arcgis";
import { getMapElement } from "./utils";
import { insideRenderer, outsideRenderer } from "./regulationStyles";

/** Layer titles — also how a stale layer left by a hot reload is found and removed. */
const TITLES = {
  inside: "داخل خط التنظيم",
  outside: "خارج خط التنظيم",
} as const;

/** Title of the live regulation-lines layer (مضلع خطوط التنظيم, the red outline) that
 *  index.tsx adds to the map. Keep in sync with createAutoStyledLayer's title there. */
export const REGULATION_LINES_TITLE = "مضلع خطوط التنظيم";

/**
 * The index at which a request's own layers must be inserted so they draw ABOVE the red
 * regulation-lines layer. Inserting at 0 put them under it, so its 3px red outline
 * covered the borders of the parcel / inside / outside polygons.
 *
 * Falls back to the top of the stack when the regulation layer is not on the map.
 */
export function aboveRegulationLinesIndex(): number {
  const map = getMapElement()?.view?.map;
  if (!map) return 0;

  const regulation = map.layers.find((l) => l.title === REGULATION_LINES_TITLE);
  return regulation ? map.layers.indexOf(regulation) + 1 : map.layers.length;
}

type Managed = { inside: FeatureLayer; outside: FeatureLayer; requestId: number };

let managed: Managed | null = null;

/** TRANSACTION_ID is a string field; the id is a number, coerced so nothing else can
 *  reach the where-clause. */
function whereTransaction(requestId: number): string {
  return `${TRANSACTION_ID_FIELD} = '${Number(requestId)}'`;
}

/** Drops any layer carrying one of our titles, whoever added it (a hot reload can leave an
 *  orphan the module no longer holds a reference to). */
function removeByTitle(): void {
  const map = getMapElement()?.view?.map;
  if (!map) return;

  const titles = new Set<string>([TITLES.inside, TITLES.outside]);
  map.layers
    .filter((l) => titles.has(l.title ?? ""))
    .toArray()
    .forEach((l) => map.remove(l));
}

/** Removes the result layers from the map. */
export function hideRequestResultLayers(): void {
  removeByTitle();
  managed = null;
}

/**
 * Shows the two result layers for one request, replacing whatever was shown before.
 *
 * Safe to call when nothing is stored yet: the layers are added and simply draw nothing,
 * so an upload + intersect later needs no second call to make them appear.
 */
export async function showRequestResultLayers(requestId: number): Promise<void> {
  const map = getMapElement()?.view?.map;
  if (!map) return;

  // Always start from a clean slate — a previous request's layers must be off the map
  // before the new ones go on.
  hideRequestResultLayers();

  const where = whereTransaction(requestId);

  const inside = new FeatureLayer({
    url: regulationLayerUrl(REGULATION_LAYERS.BOUNDARY_INSIDE),
    title: TITLES.inside,
    definitionExpression: where,
    renderer: insideRenderer(),
    outFields: ["*"],
  });

  const outside = new FeatureLayer({
    url: regulationLayerUrl(REGULATION_LAYERS.BOUNDARY_OUTSIDE),
    title: TITLES.outside,
    definitionExpression: where,
    renderer: outsideRenderer(),
    outFields: ["*"],
  });

  try {
    await Promise.all([inside.load(), outside.load()]);
  } catch (error) {
    console.error("[requests] failed to load the regulation result layers:", error);
    return;
  }

  // Directly ABOVE the red regulation-lines layer (so its outline never covers these
  // borders) but still UNDER the CAD drawing, which is added last and stays on top.
  map.addMany([outside, inside], aboveRegulationLinesIndex());

  managed = { inside, outside, requestId };
}

/**
 * Re-reads both layers from the service.
 *
 * Called right after the intersect is persisted: the layers were already on the map (added
 * when the request was opened) but their features predate the save, so without this the
 * newly stored split would not appear until the request was reopened.
 */
export async function refreshRequestResultLayers(requestId: number): Promise<void> {
  if (!managed || managed.requestId !== requestId) {
    // Not currently showing this request — adding them now is the correct repair.
    await showRequestResultLayers(requestId);
    return;
  }

  managed.inside.refresh();
  managed.outside.refresh();
}