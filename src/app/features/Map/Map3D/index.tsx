"use client";

import "@arcgis/map-components/dist/components/arcgis-scene";
import "@arcgis/map-components/dist/components/arcgis-zoom";
import "@arcgis/map-components/dist/components/arcgis-navigation-toggle";
import "@arcgis/map-components/dist/components/arcgis-compass";
import { useState } from "react";
import { mapId } from "../constants";
import {
  BasemapPicker,
  MapControlRail,
  MobileIconGroups,
  ToolPanelHost,
} from "../MapChrome";
import CadOperations from "../MapTools/SubTools/Widgets/CadOperations";
import MapLoadingOverlay from "../MapLoadingOverlay";
import MapTools from "../MapTools";
import ProfileMenu from "../ProfileMenu";
import { createExplorerScene } from "../scene";
import { getMapElement } from "../utils";
import type { ViewState } from "../utils/viewTransition";

// The 3D shell: an <arcgis-scene> over the same chrome as 2D. Only one shell is mounted at a time
// (see MapShell), so the `makkah-map` id stays unique; it opens at the viewpoint captured from 2D.
export default function Map3D({ initialViewState }: { initialViewState: ViewState | null }) {
  // Fresh scene per mount (ArcGIS destroys the scene's map on unmount).
  const [source] = useState(createExplorerScene);
  // The scene (WebScene + imagery) loads slowly — keep the overlay up until the view is ready.
  const [ready, setReady] = useState(false);

  return (
    <>
      <arcgis-scene
        id={mapId}
        style={{ height: "100vh", width: "100%" }}
        map={source.map}
        viewingMode={source.viewingMode}
        viewpoint={initialViewState?.viewpoint}
        onarcgisViewReadyChange={() => setReady(getMapElement()?.ready ?? false)}
      >
        <MapControlRail>
          {/* 3D-only: switches the left-drag between pan ("grab") and rotate ("3D move"). */}
          <arcgis-navigation-toggle />
          <arcgis-compass />
        </MapControlRail>
      </arcgis-scene>

      {/* Rendered outside <arcgis-scene> so the dock escapes the map's stacking context and can
          paint above overlay panels — matches the 2D shell (see Map/index.tsx). */}
      <MapTools />
      <MobileIconGroups />

      <BasemapPicker />

      <ProfileMenu />

      <ToolPanelHost />

      {/* Right-docked geoprocessing rail — see the 2D shell for the rationale. */}
      <CadOperations />

      {!ready && <MapLoadingOverlay label="جارٍ تحميل العرض ثلاثي الأبعاد…" />}
    </>
  );
}
