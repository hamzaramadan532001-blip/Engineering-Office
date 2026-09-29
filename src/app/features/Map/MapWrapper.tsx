"use client";

import dynamic from "next/dynamic";
import { PermissionsProvider } from "@/lib/permissions";
import MapLoadingOverlay from "./MapLoadingOverlay";
import { MapProvider } from "./MapProvidor";

const MapShell = dynamic(() => import("./MapShell"), {
  ssr: false,
  loading: () => <MapLoadingOverlay />,
});

export default function MapWrapper() {
  return (
    // Permissions wrap the map: widgets and the layer catalog gate on them (PERM-21).
    <PermissionsProvider>
      <MapProvider>
        <MapShell />
      </MapProvider>
    </PermissionsProvider>
  );
}
