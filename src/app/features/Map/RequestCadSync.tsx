"use client";



import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { HiOutlineClipboardDocumentCheck, HiOutlineXMark } from "react-icons/hi2";

import { activeRequestStore } from "@/lib/activeRequest/store";
import { resolveToken } from "@/lib/designTokens";

import { useMap } from "./MapProvidor";
import { MAP_CENTER, MAP_SCALE } from "./constants";
import { getMapElement } from "./utils";

import {
  CAD_FILL_COLOR_TOKEN,
  CAD_LINE_COLOR_TOKEN,
  DEFAULT_LINE_WIDTH,
} from "./MapTools/SubTools/Widgets/CadUploadTool/constants";

import {
  clearCurrentCad,
  drawCadOnMap,
  removeCadLayer,
  type CadSymbolOptions,
} from "./MapTools/SubTools/Widgets/CadUploadTool/drawCad";

import {
  loadRequestCad,
  requestCadLayerTitle,
} from "./MapTools/SubTools/Widgets/CadUploadTool/requestCad";
import { hideRequestResultLayers, showRequestResultLayers } from "./requestResultLayers";

import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";

import styles from "./RequestCadSync.module.scss";

const COPY = {
  activePrefix: "الطلب الحالي:",
  loading: "جاري تحميل ملف الكاد المرتبط بالطلب...",
  loaded: "تم تحميل ملف الكاد المرتبط بهذا الطلب.",
  empty: "لا يوجد ملف كاد مرتبط بهذا الطلب — يمكنك رفع ملف جديد.",
  failed: "تعذّر تحميل ملف الكاد المرتبط بالطلب.",
  close: "إنهاء العمل على الطلب",
} as const;

/**
 * Default CAD appearance.
 * Same appearance used by the normal CAD upload workflow.
 */
function defaultSymbolOptions(): CadSymbolOptions {
  return {
    lineColor: resolveToken(CAD_LINE_COLOR_TOKEN, "#0B5FFF"),
    fillColor: resolveToken(CAD_FILL_COLOR_TOKEN, "#F59E0B"),
    lineWidth: DEFAULT_LINE_WIDTH,
    lineStyle: "dash",
    fillPattern: "transparent",
  };
}

type SyncState = "idle" | "loading" | "loaded" | "empty" | "failed";

/**
 * Return the map to the normal/default map view.
 *
 * IMPORTANT:
 * This does NOT use the CAD extent.
 * It simply restores the same center/scale used when the map initially opens.
 */
function resetMapToDefaultView(): void {
  const mapElement = getMapElement();

  if (!mapElement) {
    return;
  }

  void mapElement.goTo({
    center: MAP_CENTER,
    scale: MAP_SCALE,
  });
}

export default function RequestCadSync() {
  const activeRequest = useSyncExternalStore(
    activeRequestStore.subscribe,
    activeRequestStore.getSnapshot,
    activeRequestStore.getServerSnapshot,
  );

  const { dispatch } = useMap();

  const [state, setState] = useState<SyncState>("idle");

  /**
   * Layer loaded by this component.
   */
  const layerRef = useRef<GeoJSONLayer | null>(null);

  /**
   * Blob URL belonging to the loaded CAD.
   */
  const blobUrlRef = useRef<string | null>(null);

  /**
   * Request currently shown on the map.
   */
  const shownRequestRef = useRef<number | null>(null);

  /**
   * Remove the current CAD from the map and release its blob URL.
   */
  const dropLoadedLayer = useCallback(() => {
    // Clear ANY CAD currently on the map.
    // This is important when switching from request A -> request B.
    clearCurrentCad();

    layerRef.current = null;

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const requestId = activeRequest?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    /**
     * Always clear the previous CAD before processing a new request.
     *
     * Example:
     *
     * Request A -> CAD A
     * Request B -> CAD A is removed first
     *             -> then CAD B is loaded if it exists
     */
    if (shownRequestRef.current !== null || requestId !== null) {
      dropLoadedLayer();
    }

    shownRequestRef.current = requestId;

    /**
     * No active request.
     *
     * Do not change the normal map state unnecessarily.
     */
    if (requestId === null) {
      setState("idle");
      return;
    }

    setState("loading");

    void (async () => {
      try {
        const stored = await loadRequestCad(requestId);

        if (cancelled) {
          return;
        }

        /**
         * ============================================================
         * REQUEST HAS NO CAD
         * ============================================================
         *
         * This is the important new behavior:
         *
         * 1. CAD upload tool is closed.
         * 2. Map returns to its normal/default view.
         * 3. No CAD zoom/fit is performed.
         */
        if (!stored) {
          dispatch({
            type: "closeSubTool",
            payload: "add-cad",
          });

          resetMapToDefaultView();

          setState("empty");

          return;
        }

        /**
         * ============================================================
         * REQUEST HAS CAD
         * ============================================================
         *
         * Keep the existing CAD behavior.
         */
        const { layer, blobUrl } = await drawCadOnMap({
          title: requestCadLayerTitle(requestId),
          sourceCollection: stored.collection,
          sourceWkid: stored.wkid,
          options: defaultSymbolOptions(),
        });

        /**
         * User switched request while CAD was loading.
         * Remove the stale CAD immediately.
         */
        if (cancelled) {
          removeCadLayer(layer);
          URL.revokeObjectURL(blobUrl);

          return;
        }

        layerRef.current = layer;
        blobUrlRef.current = blobUrl;

        setState("loaded");
      } catch (error) {
        console.error(
          "[requests] failed to load the CAD for this request:",
          error,
        );

        if (!cancelled) {
          setState("failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestId, dropLoadedLayer, dispatch]);

  /**
   * When the component/map is removed completely,
   * don't leave request CAD behind.
   */
  useEffect(() => {
    return () => {
      dropLoadedLayer();
    };
  }, [dropLoadedLayer]);

  if (!activeRequest) {
    return null;
  }

  const statusText =
    state === "loading"
      ? COPY.loading
      : state === "loaded"
        ? COPY.loaded
        : state === "empty"
          ? COPY.empty
          : state === "failed"
            ? COPY.failed
            : "";

  return (
    <div className={styles.banner} role="status">
      <span className={styles.icon}>
        <HiOutlineClipboardDocumentCheck />
      </span>

      <div className={styles.text}>
        <span className={styles.title}>
          {COPY.activePrefix} <strong>{activeRequest.id}</strong>
          {activeRequest.description
            ? ` — ${activeRequest.description}`
            : ""}
        </span>

        {statusText && (
          <span
            className={`${styles.status} ${
              state === "failed" ? styles.statusError : ""
            }`}
          >
            {statusText}
          </span>
        )}
      </div>

      <button
        type="button"
        className={styles.close}
        aria-label={COPY.close}
        title={COPY.close}
        onClick={() => activeRequestStore.clear()}
      >
        <HiOutlineXMark />
      </button>
    </div>
  );
}