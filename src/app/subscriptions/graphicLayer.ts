import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import { getMapView } from "@/app/features/Map/utils";

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export const createSubscription = (layerId: string) => {
  let cacheId = generateId();
  let onStoreChange: (() => void) | null = null;
  const map = getMapView()?.map;

  // If the map element is not mounted yet, return a no-op store so callers don't crash.
  if (!map) {
    return {
      subscribe: (_callback: () => void) => () => {},
      getSnapshot: () => cacheId,
      notify: () => {},
    };
  }

  // Reuse the existing layer if one with this id is already on the map,
  // instead of creating a new (empty) one and losing any drawn graphics.
  const existing = map.findLayerById(layerId) as GraphicsLayer | undefined;
  const layer = existing ?? new GraphicsLayer({ id: layerId });

  if (!existing) {
    map.add(layer);
  }

  function notify() {
    cacheId = generateId();
    onStoreChange?.();
  }
  function subscribe(callback: () => void) {
    onStoreChange = callback;
    const handle = layer.graphics.on("change", notify);
    return () => {
      // Only detach the change listener on cleanup — do NOT remove the
      // layer from the map, or the drawn graphics get discarded whenever
      // the tool panel closes.
      handle.remove();
      onStoreChange = null;
    };
  }
  function getSnapshot() {
    return cacheId;
  }
  return { subscribe, getSnapshot, notify };
};

export type GraphicsLayerCacheId = ReturnType<ReturnType<typeof createSubscription>["getSnapshot"]>;
