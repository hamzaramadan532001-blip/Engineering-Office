import type GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import SketchViewModel from "@arcgis/core/widgets/Sketch/SketchViewModel";
import type { CreateOptions } from "@arcgis/core/widgets/Sketch/types";
import { getMapView } from "@/app/features/Map/utils";
import { resolveToken } from "@/lib/designTokens";

export const DRAW_TOOL_LABELS: Record<DrawTool, string> = {
  point: "نقطة",
  polyline: "خط",
  polygon: "مضلع",
  circle: "دائرة",
  rectangle: "مستطيل",
};

export type DrawTool = "point" | "polyline" | "polygon" | "circle" | "rectangle";

/**
 * Shared draw symbol color — maps to --primary-sa-400 (#54C08A)
 * from packages/ui/src/styles/colors/_primitives.scss
 * Change it here once and it updates all draw tools automatically.
 */
export const DRAW_SYMBOL_COLOR = resolveToken("--primary-sa-400", "#54C08A");

/**
 * Shared polygon fill color — maps to --alpha-red-20 (rgba(217, 45, 32, 0.2))
 * from packages/ui/src/styles/colors/_primitives.scss.
 */
export const DRAW_POLYGON_FILL_COLOR = resolveToken("--alpha-red-20", "rgba(217, 45, 32, 0.2)");

let sketchVM: SketchViewModel | null = null;

function getOrCreateSketchVM(graphicsLayer: GraphicsLayer): SketchViewModel | null {
  const view = getMapView();
  if (!view) return null;

  if (!sketchVM) {
    sketchVM = new SketchViewModel({
      view,
      layer: graphicsLayer,
      updateOnGraphicClick: false,
      pointSymbol: { type: "simple-marker", color: DRAW_SYMBOL_COLOR, size: 8 },
      polylineSymbol: { type: "simple-line", color: DRAW_SYMBOL_COLOR, width: 2 },
      polygonSymbol: {
        type: "simple-fill",
        color: DRAW_POLYGON_FILL_COLOR,
        outline: { color: DRAW_SYMBOL_COLOR, width: 2 },
      },
    });

    sketchVM.on("create", (event) => {
      if (event.state !== "complete" || !event.graphic) return;

      const tool = event.tool as DrawTool;
      event.graphic.attributes = {
        id: crypto.randomUUID(),
        name: DRAW_TOOL_LABELS[tool] ?? tool,
        geometryType: event.graphic.geometry?.type,
        createdAt: new Date().toISOString(),
      };
    });
  } else {
    sketchVM.layer = graphicsLayer;
    sketchVM.view = view;
  }

  return sketchVM;
}

export const drawGraphic = (
  graphicsLayer: GraphicsLayer | undefined,
  tool: DrawTool,
  createOptions?: CreateOptions,
) => {
  if (!graphicsLayer) return;
  const vm = getOrCreateSketchVM(graphicsLayer);
  if (!vm) return;
  vm.cancel(); // stop previous draw before starting a new one
  vm.create(tool, createOptions);
};
export const drawPoint = (layer?: GraphicsLayer) => drawGraphic(layer, "point");
export const drawLine = (layer?: GraphicsLayer) => drawGraphic(layer, "polyline");
export const drawPolygon = (layer?: GraphicsLayer) => drawGraphic(layer, "polygon");
export const drawCircle = (layer?: GraphicsLayer) => drawGraphic(layer, "circle");
export const drawRectangle = (layer?: GraphicsLayer, createOptions?: CreateOptions) =>
  drawGraphic(layer, "rectangle", createOptions);

/**
 * Cancels the shared sketch session in progress, if any. Callers that own a draw session
 * against their own layer (e.g. Widgets/Print/store.ts) use this to discard an in-flight
 * rectangle instead of leaving an orphan create session running after they've moved on
 * (panel closed, selection cleared) — mirrors the internal `vm.cancel()` above.
 */
export const cancelDraw = () => {
  sketchVM?.cancel();
};
