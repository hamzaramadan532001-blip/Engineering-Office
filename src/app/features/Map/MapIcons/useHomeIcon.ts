import { useCallback } from "react";
import { MAP_CENTER, MAP_SCALE } from "../constants";
import { getMapElement } from "../utils";

/** Returns the view to the default Makkah extent (the same center/scale the map opens with). */
export function useHomeIcon() {
  const goHome = useCallback(() => {
    const mapElement = getMapElement();
    if (!mapElement) return;

    mapElement
      .goTo({ center: MAP_CENTER, scale: MAP_SCALE }, { animate: true, duration: 1000 })
      .catch((err) => {
        console.warn("goHome error:", err);
      });
  }, []);

  return { goHome };
}
