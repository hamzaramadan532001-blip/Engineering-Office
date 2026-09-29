import { useMap, VIEW_MODES } from "../MapProvidor";
import { getMapElement } from "../utils";
import { captureViewState } from "../utils/viewTransition";

/**
 * Returns the current view mode and a toggle callback that captures the
 * current viewpoint before switching, so the destination view can restore it.
 */
export function useViewModeToggle(): {
  is3D: boolean;
  toggle: () => void;
} {
  const {
    state: { viewMode },
    dispatch,
  } = useMap();

  const is3D = viewMode === VIEW_MODES.Map3D;

  const toggle = () => {
    const next = is3D ? VIEW_MODES.Map2D : VIEW_MODES.Map3D;
    // Capture the *current* element's viewpoint before React unmounts it.
    dispatch({ type: "setLastViewState", payload: captureViewState(getMapElement()) });
    dispatch({ type: "setViewMode", payload: next });
  };

  return { is3D, toggle };
}
