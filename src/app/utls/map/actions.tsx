import type Graphic from "@arcgis/core/Graphic";
import type GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import { getMapView } from "@/app/features/Map/utils";

export async function goToGraphic(graphic: Graphic) {
  const view = getMapView();

  if (!view || !graphic.geometry) {
    return;
  }

  await view.goTo(graphic, {
    duration: 1000,
  });
}

export function toggleGraphicVisibility(graphic: Graphic) {
  graphic.visible = !graphic.visible;
}

export function deleteGraphic(graphicsLayer: GraphicsLayer, graphic: Graphic) {
  graphicsLayer.remove(graphic);
}
