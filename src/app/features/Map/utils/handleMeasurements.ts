import * as geodeticAreaOperator from "@arcgis/core/geometry/operators/geodeticAreaOperator.js";
import * as geodeticLengthOperator from "@arcgis/core/geometry/operators/geodeticLengthOperator.js";
import type Polygon from "@arcgis/core/geometry/Polygon";
import Polyline from "@arcgis/core/geometry/Polyline";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import SketchViewModel from "@arcgis/core/widgets/Sketch/SketchViewModel";
import { resolveToken } from "@/lib/designTokens";
import { getMapView } from ".";

// Measurement symbols in brand green (TOOLS-06). Fallbacks mirror the tokens in
// packages/ui/src/styles/colors/_primitives.scss and are used only before they resolve.
const MEASURE_LINE_COLOR = resolveToken("--primary-sa-600", "#1B8354");
const MEASURE_FILL_COLOR = resolveToken("--alpha-green-20", "rgba(7, 148, 85, 0.2)");

export function handleMeasureDistance({
  layerId,
  getDistance,
  getGraphicsLayer,
  getSketchViewModel,
}: {
  layerId: string;
  getDistance?: (distance: number | null) => void;
  getGraphicsLayer?: (graphicsLayer: GraphicsLayer | null) => void;
  getSketchViewModel?: (sketchViewModel: SketchViewModel | null) => void;
}): GraphicsLayer | null {
  // imports

  clearPrevMeasurements(layerId);
  const view = getMapView();
  if (!view) return null;

  const graphicsLayer = new GraphicsLayer({ id: layerId });

  getGraphicsLayer?.(graphicsLayer);
  const sketchVM = new SketchViewModel({
    view: view,
    layer: graphicsLayer,

    updateOnGraphicClick: false,
    polylineSymbol: {
      type: "simple-line",
      color: MEASURE_LINE_COLOR,
      width: 2,
    },
  });

  sketchVM.on("create", (event) => {
    if (event.toolEventInfo?.type === "vertex-add") {
      if (event.graphic) {
        if (event.graphic.geometry?.type === "polyline") {
          const distance = measureDistance(event.graphic.geometry);

          getDistance?.(distance || 0);

          view.map?.add(graphicsLayer);
        }
      }
    }
  });
  sketchVM.create("polyline");
  getSketchViewModel?.(sketchVM || null);
  return graphicsLayer;
}

export const measureDistance = (polyline: Polyline) => {
  const length = geodeticLengthOperator.execute(polyline, {
    unit: "kilometers",
  });
  return length;
};

// area

export function handlePolygonMeasurement({
  layerId,
  getArea,
  getGraphicsLayer,
  getPerimeter,
  getLengths,
  getSketchViewModel,
}: {
  layerId: string;
  getArea?: (distance: number | null) => void;
  getGraphicsLayer?: (graphicsLayer: GraphicsLayer | null) => void;
  getPerimeter?: (perimeter: number | null) => void;
  getLengths?: (lengths: number[] | null) => void;
  getSketchViewModel?: (sketchViewModel: SketchViewModel | null) => void;
}): GraphicsLayer | null {
  clearPrevMeasurements(layerId);
  const view = getMapView();
  if (!view) return null;

  const graphicsLayer = new GraphicsLayer({ id: layerId });

  getGraphicsLayer?.(graphicsLayer);
  const sketchVM = new SketchViewModel({
    view: view,
    layer: graphicsLayer,

    updateOnGraphicClick: false,
    polygonSymbol: {
      type: "simple-fill",
      color: MEASURE_FILL_COLOR,
      outline: { color: MEASURE_LINE_COLOR, width: 2 },
    },
  });

  sketchVM.on("create", async (event) => {
    if (event.toolEventInfo?.type === "vertex-add") {
      if (event.graphic) {
        if (event.graphic.geometry?.type === "polygon") {
          const area = await measureArea(event.graphic.geometry);
          const perimeter = await measurePolygonPerimeter(event.graphic.geometry);
          const lengths = getPolygonVertexLengths(event.graphic.geometry);
          getPerimeter?.(perimeter || 0);
          getLengths?.(lengths || []);

          getArea?.(area || 0);

          view.map?.add(graphicsLayer);
        }
      }
    }
  });

  sketchVM.create("polygon");
  getSketchViewModel?.(sketchVM || null);
  return graphicsLayer;
}

const measureArea = async (polygon: Polygon) => {
  if (!geodeticAreaOperator.isLoaded()) {
    await geodeticAreaOperator.load();
  }
  const area = geodeticAreaOperator.execute(polygon, {
    unit: "square-kilometers",
  });
  return area;
};

const clearPrevMeasurements = (layerId: string) => {
  const map = getMapView()?.map;
  if (!map) return;
  const prevLayer = map.findLayerById(layerId);
  if (prevLayer) {
    map.remove(prevLayer);
  }
};

export function getPolygonVertexLengths(polygon: Polygon): number[] {
  return polygon.rings.flatMap((ring) => {
    const lengths: number[] = [];

    for (let i = 0; i < ring.length - 1; i++) {
      // Create a segment polyline for each vertex pair
      const segment = new Polyline({
        spatialReference: polygon.spatialReference,
        paths: [[ring[i], ring[i + 1]]],
      });

      // Use geodesicLength for accurate real-world distance (km)
      lengths.push(geodeticLengthOperator.execute(segment, { unit: "kilometers" }));
    }

    return lengths;
  });
}

export const measurePolygonPerimeter = async (polygon: Polygon) => {
  if (!geodeticLengthOperator.isLoaded()) {
    await geodeticLengthOperator.load();
  }

  // The operator calculates the total length of all rings (the perimeter)
  const perimeter = geodeticLengthOperator.execute(polygon, {
    unit: "kilometers",
  });

  return perimeter;
};
