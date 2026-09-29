"use client";

import { createContext, type Dispatch, type ReactNode, useContext, useReducer } from "react";
import type { AvailableTools } from "./MapTools/SubTools/types";
import type { ViewState } from "./utils/viewTransition";

export const VIEW_MODES = {
  Map2D: "2d",
  Map3D: "3d",
} as const;

export type ViewMode = (typeof VIEW_MODES)[keyof typeof VIEW_MODES];

/** Extend this object as you add real map state. */
export type MapState = {
  selectedTool: AvailableTools[number] | null;
  subSelectedTool: string | null;
  /** Ids of the floating tool panels currently open (e.g. several Widgets at once). */
  openSubTools: string[];
  /** Current map display mode: 2D MapView or 3D SceneView. */
  viewMode: ViewMode;
  /** Viewpoint captured before the last 2D↔3D switch, used as the initial view. */
  lastViewState: ViewState | null;
  /** Whether the basemap picker (rail grid button) is open — shared by 2D + 3D. */
  basemapPickerOpen: boolean;
};

/** Add action types when you wire behavior. */
export type MapAction =
  | { type: "setSelectedTool"; payload: AvailableTools[number] | null }
  | { type: "setSubSelectedTool"; payload: string | null }
  | { type: "openSubTool"; payload: string }
  | { type: "closeSubTool"; payload: string }
  | { type: "toggleSubTool"; payload: string }
  | { type: "closeAllSubTools" }
  | { type: "setViewMode"; payload: ViewMode }
  | { type: "setLastViewState"; payload: ViewState | null }
  | { type: "toggleBasemapPicker" };

const initialState: MapState = {
  selectedTool: null,
  subSelectedTool: null,
  openSubTools: [],
  viewMode: VIEW_MODES.Map2D,
  lastViewState: null,
  basemapPickerOpen: false,
};

function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case "setSelectedTool":
      return { ...state, selectedTool: action.payload };
    case "setSubSelectedTool":
      return { ...state, subSelectedTool: action.payload };
    case "openSubTool":
      return state.openSubTools.includes(action.payload)
        ? state
        : { ...state, openSubTools: [...state.openSubTools, action.payload] };
    case "closeSubTool":
      return { ...state, openSubTools: state.openSubTools.filter((id) => id !== action.payload) };
    case "toggleSubTool":
      return state.openSubTools.includes(action.payload)
        ? { ...state, openSubTools: state.openSubTools.filter((id) => id !== action.payload) }
        : { ...state, openSubTools: [...state.openSubTools, action.payload] };
    case "closeAllSubTools":
      return { ...state, openSubTools: [] };
    case "setViewMode":
      return { ...state, viewMode: action.payload };
    case "setLastViewState":
      return { ...state, lastViewState: action.payload };
    case "toggleBasemapPicker":
      return { ...state, basemapPickerOpen: !state.basemapPickerOpen };
    default:
      return state;
  }
}

type MapContextValue = {
  state: MapState;
  dispatch: Dispatch<MapAction>;
};

const MapContext = createContext<MapContextValue | undefined>(undefined);

export function MapProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(mapReducer, initialState);

  return <MapContext.Provider value={{ state, dispatch }}>{children}</MapContext.Provider>;
}

export function useMap() {
  const ctx = useContext(MapContext);
  if (ctx === undefined) {
    throw new Error("useMap must be used within MapProvider");
  }
  return ctx;
}
