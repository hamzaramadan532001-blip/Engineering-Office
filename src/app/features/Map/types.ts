import type MapView from "@arcgis/core/views/MapView";
import type SceneView from "@arcgis/core/views/SceneView";

/**
 * Union of the two map web-component element types. Most code that only needs
 * `.view.map` or `.goTo()` can treat this opaquely; use the type guards below
 * when view-specific behavior is required.
 */
export type ArcGISMapElement = HTMLArcgisMapElement | HTMLArcgisSceneElement;

export type ArcGISView = MapView | SceneView;

/** True when the view is a 3D SceneView. */
export function isSceneView(view: ArcGISView | null | undefined): view is SceneView {
  return view?.type === "3d";
}

/** True when the view is a 2D MapView. */
export function isMapView(view: ArcGISView | null | undefined): view is MapView {
  return view?.type === "2d";
}
