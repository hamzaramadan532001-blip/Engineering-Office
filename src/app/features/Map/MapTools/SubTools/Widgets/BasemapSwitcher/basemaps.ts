import Basemap from "@arcgis/core/Basemap";
import TileLayer from "@arcgis/core/layers/TileLayer";
import type EsriMap from "@arcgis/core/Map";
import { BASEMAP_HYBRID_URL, BASEMAP_V2_URL } from "@/app/features/Map/arcgis.config";
import {
  BASE_LAYER_TITLE,
  BASEMAP_MODES,
  type BasemapMode,
  REFERENCE_BLEND_MODE,
  REFERENCE_LAYER_TITLE,
  SATELLITE_SOURCE,
} from "./constants";



/** A mode's ready-to-assign Basemap plus the layers whose load decides success/failure. */
export interface ModeBasemap {
  basemap: Basemap;
  layers: TileLayer[];
}

const trimUrl = (url: string | null | undefined) => (url ?? "").replace(/\/+$/, "");

const modeLabel = (mode: BasemapMode) => BASEMAP_MODES.find((m) => m.id === mode)?.label ?? mode;

/** The first base layer's service URL, or "" when the basemap is not tile-service backed. */
function baseLayerUrl(map: EsriMap): string {
  const first = map.basemap?.baseLayers?.getItemAt(0);
  return first instanceof TileLayer ? trimUrl(first.url) : "";
}

function hasReferenceLayer(map: EsriMap): boolean {
  return map.basemap?.referenceLayers?.some((l) => l.title === REFERENCE_LAYER_TITLE) ?? false;
}

/** Build a mode's Basemap from scratch, or null when no compatible satellite capture exists. */
export function buildBasemap(mode: BasemapMode): ModeBasemap | null {
  if (mode === "base") {
    const base = new TileLayer({ url: BASEMAP_V2_URL, title: BASE_LAYER_TITLE });
    return { basemap: new Basemap({ title: modeLabel(mode), baseLayers: [base] }), layers: [base] };
  }
  if (!SATELLITE_SOURCE) return null;

  const base = new TileLayer({ url: SATELLITE_SOURCE.url, title: SATELLITE_SOURCE.title });
  if (mode === "satellite") {
    return { basemap: new Basemap({ title: modeLabel(mode), baseLayers: [base] }), layers: [base] };
  }

  const reference = new TileLayer({
    url: BASEMAP_HYBRID_URL,
    title: REFERENCE_LAYER_TITLE,
    blendMode: REFERENCE_BLEND_MODE,
  });
  return {
    basemap: new Basemap({
      title: modeLabel(mode),
      baseLayers: [base],
      referenceLayers: [reference],
    }),
    layers: [base, reference],
  };
}

/** The mode the live map is showing, or null for any basemap this widget did not compose. */
export function readMode(map: EsriMap): BasemapMode | null {
  const url = baseLayerUrl(map);
  const withReference = hasReferenceLayer(map);
  if (url && url === trimUrl(BASEMAP_V2_URL)) return withReference ? null : "base";
  if (SATELLITE_SOURCE && url === trimUrl(SATELLITE_SOURCE.url)) {
    return withReference ? "hybrid" : "satellite";
  }
  return null;
}

/** A cheap value that changes whenever the map's basemap composition changes. */
export function basemapFingerprint(map: EsriMap): string {
  return `${baseLayerUrl(map)}|${map.basemap?.referenceLayers?.length ?? 0}`;
}
