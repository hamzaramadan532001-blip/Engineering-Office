import { mapId } from "../constants";
import type { ArcGISMapElement, ArcGISView } from "../types";

export const getMapElement = (): ArcGISMapElement | null =>
  document.getElementById(mapId) as ArcGISMapElement | null;

/** Returns the current ArcGIS view (2D or 3D), or null if the map element is not mounted. */
export function getMapView(): ArcGISView | null {
  return getMapElement()?.view ?? null;
}

const handleZoomIn = (_: React.MouseEvent<HTMLButtonElement>) => {
  const mapElement = getMapElement();
  if (!mapElement) return;
  mapElement.zoom += 1;
};

const handleZoomOut = () => {
  const mapElement = getMapElement();
  if (!mapElement) return;
  mapElement.zoom -= 1;
};

const goToMyLocation = () => {
  const mapElement = getMapElement();
  if (!mapElement) return;

  if (!navigator.geolocation) {
    console.error("Geolocation is not supported by your browser");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;

      if (!mapElement) return;

      mapElement.goTo({
        center: [longitude, latitude],
        zoom: 17,
      });
    },
    (error) => {
      console.error("Error getting location:", error);
    },
  );
};

export { goToMyLocation, handleZoomIn, handleZoomOut };
