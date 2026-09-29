"use client";

import { lazy, Suspense } from "react";
import MapLoadingOverlay from "./MapLoadingOverlay";
import { useMap, VIEW_MODES } from "./MapProvidor";

const Map2D = lazy(() => import("./index"));
const Map3D = lazy(() => import("./Map3D"));

/**
 * Switches between the 2D MapView and the 3D SceneView. The two shells are never mounted at the
 * same time, so the single `<arcgis-*>` element with id `makkah-map` stays unique. The overlay
 * covers the lazy-chunk load while switching; each shell keeps it up until its view is ready.
 */
export default function MapShell() {
  const {
    state: { viewMode, lastViewState },
  } = useMap();
  const is3D = viewMode === VIEW_MODES.Map3D;

  return (
    <Suspense
      fallback={<MapLoadingOverlay label={is3D ? "جارٍ تحميل العرض ثلاثي الأبعاد…" : undefined} />}
    >
      {is3D ? (
        <Map3D initialViewState={lastViewState} />
      ) : (
        <Map2D initialViewState={lastViewState} />
      )}
    </Suspense>
  );
}
