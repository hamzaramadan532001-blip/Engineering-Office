import type Point from "@arcgis/core/geometry/Point.js";
import Viewpoint from "@arcgis/core/Viewpoint.js";
import type { ArcGISMapElement } from "../types";

/**
 * A lightweight snapshot of the current map view, used to preserve the user's
 * viewpoint when switching between 2D (MapView) and 3D (SceneView).
 */
export interface ViewState {
  /** The full viewpoint (preferred — carries camera/rotation/scale). */
  viewpoint?: Viewpoint;
  /** Fallback center point when viewpoint is unavailable. */
  center?: Point;
  /** Fallback scale when viewpoint is unavailable. */
  scale?: number;
}

/** Capture the current view state from a map or scene element. */
export function captureViewState(element: ArcGISMapElement | null | undefined): ViewState | null {
  const view = element?.view;
  if (!view) return null;
  return {
    viewpoint: view.viewpoint,
    center: view.center,
    scale: view.scale,
  };
}

/**
 * Build a north-up 2D viewpoint from a captured view state. A 3D SceneView's viewpoint
 * carries the camera heading, which a MapView would otherwise adopt as its 2D `rotation` —
 * so when restoring into 2D we keep only the center and scale and force `rotation: 0`,
 * leaving the map pointing north regardless of how it was rotated in 3D. Returns null when
 * there is nothing to restore (e.g. first load), so the caller falls back to its defaults.
 */
export function toNorthUp2DViewpoint(state: ViewState | null | undefined): Viewpoint | null {
  if (!state) return null;
  const targetGeometry = state.center ?? state.viewpoint?.targetGeometry ?? null;
  const scale = state.scale ?? state.viewpoint?.scale ?? null;
  if (!targetGeometry || !scale) return null;
  return new Viewpoint({ targetGeometry, scale, rotation: 0 });
}
