"use client";
import "@arcgis/map-components/dist/components/arcgis-map";
import "@arcgis/map-components/dist/components/arcgis-zoom";
import Basemap from "@arcgis/core/Basemap";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import esriId from "@arcgis/core/identity/IdentityManager";
import TileLayer from "@arcgis/core/layers/TileLayer";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";

import EsriMap from "@arcgis/core/Map";
import { useState } from "react";
import { ARCGIS_PORTAL_URL, EXECUTIVE_DASHBOARD_URL, MUNICIPAL_ASSETS_URL } from "@/lib/arcgis";
import { getArcgisToken, getBusinessMapToken } from "@/lib/runtimeConfig";
import { BASEMAP_V2_URL, BUSINESS_MAP_URL } from "./arcgis.config";
import { createBusinessMapLayer } from "./businessMap";
import { MAP_CENTER, MAP_SCALE, mapId } from "./constants";
import {
  BasemapPicker,
  MapControlRail,
  MobileHeader,
  MobileIconGroups,
  ToolPanelHost,
} from "./MapChrome";
import CadOperations from "./MapTools/SubTools/Widgets/CadOperations";
import RequestCadSync from "./RequestCadSync";
import MapLoadingOverlay from "./MapLoadingOverlay";
import MapTools from "./MapTools";
import ProfileMenu from "./ProfileMenu";
import { getMapElement } from "./utils";
import { toNorthUp2DViewpoint, type ViewState } from "./utils/viewTransition";

const ARCGIS_TOKEN = getArcgisToken();
const BUSINESS_MAP_TOKEN = getBusinessMapToken();

function restServiceRoot(serviceUrl: string): string {
  const marker = "/rest/services";
  const i = serviceUrl.indexOf(marker);
  return i === -1 ? serviceUrl : serviceUrl.slice(0, i + marker.length);
}

if (ARCGIS_TOKEN) {
  try {
    esriId.registerToken({ server: ARCGIS_PORTAL_URL, token: ARCGIS_TOKEN, ssl: true });
    esriId.registerToken({
      server: restServiceRoot(MUNICIPAL_ASSETS_URL),
      token: ARCGIS_TOKEN,
      ssl: true,
    });
  } catch (tokenErr) {
    console.warn("ArcGIS token registration warning:", tokenErr);
  }
}
if (BUSINESS_MAP_TOKEN) {
  try {
    esriId.registerToken({
      server: "https://maps.holymakkah.gov.sa/arcgis",
      token: BUSINESS_MAP_TOKEN,
      ssl: true,
    });
    esriId.registerToken({
      server: restServiceRoot(BUSINESS_MAP_URL),
      token: BUSINESS_MAP_TOKEN,
      ssl: true,
    });
    esriId.registerToken({
      server: restServiceRoot(EXECUTIVE_DASHBOARD_URL),
      token: BUSINESS_MAP_TOKEN,
      ssl: true,
    });
  } catch (tokenErr) {
    console.warn("BusinessMap token registration warning:", tokenErr);
  }
}

const MAP_SPATIAL_REFERENCE = new SpatialReference({ wkid: 32637 });

/**
 * Renderer صريح بيتحدد تلقائيًا حسب نوع الجيومتري الفعلي للطبقة (polygon / polyline / point)،
 * عشان نضمن ظهور خط/تعبئة واضح بدل الاعتماد على drawingInfo السيرفر. اللون قابل للتخصيص
 * عشان نقدر نميّز كذا طبقة اتضافت بنفس الطريقة عن بعض.
 */
function buildRendererFor(
  geometryType: string,
  color: [number, number, number, number] = [255, 0, 0, 1]
): SimpleRenderer {
  if (geometryType === "polyline") {
    return new SimpleRenderer({
      symbol: new SimpleLineSymbol({ color, width: 3 }),
    });
  }
  if (geometryType === "point" || geometryType === "multipoint") {
    return new SimpleRenderer({
      symbol: new SimpleMarkerSymbol({
        color,
        size: 8,
        outline: { color: [255, 255, 255, 1], width: 1 },
      }),
    });
  }
  // الافتراضي: polygon
  const [r, g, b] = color;
  return new SimpleRenderer({
    symbol: new SimpleFillSymbol({
      color: [r, g, b, 0.15],
      outline: new SimpleLineSymbol({ color: [r, g, b, 1], width: 3 }),
    }),
  });
}

/**
 * طبقة مش معروف عنها نوع الجيومتري ولا الألوان الرسمية مقدمًا — بنكشف كل حاجة
 * منها وقت الرن ونطبّق لون مميز + نطبع تشخيص كامل (geometryType, minScale/maxScale,
 * extent, queryFeatureCount) عشان نعرف بسرعة لو فيه مشكلة تحميل/scale/بيانات.
 */
function createAutoStyledLayer(
  url: string,
  title: string,
  color: [number, number, number, number]
): FeatureLayer {
  const layer = new FeatureLayer({
    url,
    title,
    visible: true,
    outFields: ["*"],
  });

  layer.when(
    async () => {
      layer.renderer = buildRendererFor(layer.geometryType, color);

      const ext = layer.fullExtent;
      console.log(`[${title}] loaded — geometryType:`, layer.geometryType);
      console.log(`[${title}] minScale/maxScale:`, layer.minScale, layer.maxScale);
      console.log(`[${title}] extent:`, {
        xmin: ext?.xmin,
        ymin: ext?.ymin,
        xmax: ext?.xmax,
        ymax: ext?.ymax,
        wkid: ext?.spatialReference?.wkid,
      });

      try {
        const count = await layer.queryFeatureCount();
        console.log(`[${title}] queryFeatureCount:`, count);
      } catch (queryErr) {
        console.error(`[${title}] queryFeatureCount FAILED:`, queryErr);
      }
    },
    (err) => {
      console.error(`[${title}] failed to load:`, err);
    }
  );

  return layer;
}

function createExplorerMap(regulationLayer: FeatureLayer): EsriMap {
  return new EsriMap({
    basemap: new Basemap({
      baseLayers: [
        new TileLayer({
          url: BASEMAP_V2_URL,
          title: "خريطة الأساس",
        }),
      ],
    }),
    layers: [createBusinessMapLayer(), regulationLayer],
  });
}

export default function Map2D({ initialViewState }: { initialViewState: ViewState | null }) {
  const [regulationLayer] = useState(() =>
    createAutoStyledLayer(
      "https://maps.holymakkah.gov.sa/arcgis/rest/services/SDI/MMSDI_MD_BusinessMapgisViewerPRO/MapServer/6",
      "مضلع خطوط التنظيم",
      [255, 0, 0, 1]
    )
  );
  const [appMap] = useState(() => createExplorerMap(regulationLayer));
  const [restoreViewpoint] = useState(() => toNorthUp2DViewpoint(initialViewState));
  const [ready, setReady] = useState(false);

  return (
    <>
      <arcgis-map
        id={mapId}
        style={{ height: "100vh", width: "100%" }}
        spatialReference={MAP_SPATIAL_REFERENCE}
        map={appMap}
        center={MAP_CENTER}
        scale={MAP_SCALE}
        viewpoint={restoreViewpoint ?? undefined}
        onarcgisViewReadyChange={() => setReady(getMapElement()?.ready ?? false)}
      >
        <MapControlRail />
      </arcgis-map>

      <MapTools />
      <MobileIconGroups />
      <MobileHeader />
      <BasemapPicker />
      <ProfileMenu />
      <ToolPanelHost />
      <RequestCadSync />
      <CadOperations />

      {!ready && <MapLoadingOverlay />}
    </>
  );
}

