"use client";

import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import type Renderer from "@arcgis/core/renderers/Renderer";
import { useCallback, useEffect, useRef, useState } from "react";
import { getMapElement } from "@/app/features/Map/utils";
import { aboveRegulationLinesIndex } from "@/app/features/Map/requestResultLayers";
import { toGeoJSONBlobUrl, type GeoJSONFeatureCollection } from "../CadUploadTool/geometry";
import { COPY, OPERATION_LAYER_PREFIX } from "./constants";

/**
 * Owns the map layer produced by ONE operation.
 *
 * Every operation in this panel has the same lifecycle — replace any previous
 * output, add a GeoJSONLayer, optionally zoom to it, and tear it down when the
 * user removes it or the underlying CAD drawing goes away — so that lives here
 * once instead of being reimplemented per operation.
 *
 * The blob URL is revoked on teardown; GeoJSONLayer reads it during `load()`,
 * so revoking any earlier is unsafe.
 */
export function useOperationLayer(operationId: string, drawId: number | undefined) {
  const layerRef = useRef<GeoJSONLayer | null>(null);
  const urlRef = useRef<string | null>(null);
  const [hasOutput, setHasOutput] = useState(false);

  const layerTitle = `${OPERATION_LAYER_PREFIX} — ${operationId}`;

  const removeLayer = useCallback(() => {
    const map = getMapElement()?.view?.map;

    // Match by title as well as by reference: a hot reload or a remount can
    // leave an orphaned layer on the map that this ref no longer points at.
    if (map) {
      const stale = map.layers.filter((l) => l.title === layerTitle).toArray();
      stale.forEach((l) => map.remove(l));
    }

    layerRef.current = null;

    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }

    setHasOutput(false);
  }, [layerTitle]);

  /** Drop the output whenever the CAD drawing is cleared or redrawn — a result
   *  computed from the previous drawing would otherwise linger on the map. */
  useEffect(() => {
    removeLayer();
    return removeLayer;
  }, [drawId, removeLayer]);

  const applyLayer = useCallback(
    async (collection: GeoJSONFeatureCollection, renderer: Renderer) => {
      const mapElement = getMapElement();
      if (!mapElement) throw new Error(COPY.errors.noMap);

      const view = mapElement.view;
      if (!view) throw new Error(COPY.errors.noView);

      const map = view.map;
      if (!map) throw new Error(COPY.errors.noLayer);

      removeLayer();

      const url = toGeoJSONBlobUrl(collection);
      urlRef.current = url;

      const layer = new GeoJSONLayer({ url, title: layerTitle, renderer });

      await layer.load();

      // Directly ABOVE the red regulation-lines layer, so its outline no longer covers the
      // borders of this output; the CAD drawing (added last) still stays on top.
      map.add(layer, aboveRegulationLinesIndex());
      layerRef.current = layer;
      setHasOutput(true);

      try {
        const extentResult = await layer.queryExtent();
        const zoomTarget = extentResult?.extent?.expand(1.2) ?? extentResult?.extent ?? null;
        if (zoomTarget) await view.goTo(zoomTarget);
      } catch (extentError) {
        console.warn("[CAD ops] Failed to zoom to operation extent:", extentError);
      }
    },
    [layerTitle, removeLayer],
  );

  return { applyLayer, removeLayer, hasOutput };
}