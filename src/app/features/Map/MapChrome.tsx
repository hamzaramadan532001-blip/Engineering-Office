"use client";

import "@arcgis/map-components/dist/components/arcgis-basemap-gallery";
import esriConfig from "@arcgis/core/config";
import { MapBox } from "@makkah-municipality-gis/ui";
import Image from "next/image";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import Dragable from "@/app/components/dragable";
import { SCENE_PORTAL_URL } from "./arcgis.config";
import styles from "./Map.module.scss";
import MapIcons from "./MapIcons";
import { useMap, VIEW_MODES } from "./MapProvidor";
import BasemapSwitcher from "./MapTools/SubTools/Widgets/BasemapSwitcher";
import { createBasemapGallerySource } from "./scene";
import { useIsMobile } from "./useIsMobile";
import { useMobileDockOffset } from "./useMobileDockOffset";
import { getMapElement } from "./utils";
import CadUploadTool from "./MapTools/SubTools/Widgets/CadUploadTool";

esriConfig.portalUrl = SCENE_PORTAL_URL;



export function MobileHeader() {
  return (
    <div className={styles.mobileHeader}>
      <MapBox py={1} px="xs" className={styles.logoBox}>
        <Image
          src="/Holy Makkah Municipality Logo.png"
          alt="Holy Makkah Municipality"
          width={170}
          height={42}
          loading="eager"
          className={`${styles.logoImage} ${styles.logoImageLight}`}
        />
        <Image
          src="/Holy Makkah Municipality Logo Dark.png"
          alt="Holy Makkah Municipality"
          width={170}
          height={42}
          loading="eager"
          className={`${styles.logoImage} ${styles.logoImageDark}`}
        />
      </MapBox>
    </div>
  );
}

export function MobileIconGroups() {
  const zoomRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const zoom = zoomRef.current;

    if (!zoom) return;

    let observer: MutationObserver | null = null;

    const applyZoomSize = () => {
      const shadowRoot = zoom.shadowRoot;

      if (!shadowRoot) return;

      const zoomContainer = shadowRoot.querySelector(".arcgis-button") as HTMLElement | null;

      if (zoomContainer) {
        zoomContainer.style.setProperty("width", "48px", "important");

        zoomContainer.style.setProperty("display", "flex", "important");

        zoomContainer.style.setProperty("flex-direction", "column", "important");

        zoomContainer.style.setProperty("gap", "12px", "important");
      }

      const buttons = shadowRoot.querySelectorAll("calcite-button");

      buttons.forEach((button) => {
        const el = button as HTMLElement;

        // Calcite button width
        el.setAttribute("width", "full");
        el.setAttribute("scale", "l");

        // Force exact same size as the other mobile cards
        el.style.setProperty("width", "48px", "important");

        el.style.setProperty("height", "48px", "important");

        el.style.setProperty("min-width", "48px", "important");

        el.style.setProperty("min-height", "48px", "important");

        el.style.setProperty("max-width", "48px", "important");

        el.style.setProperty("max-height", "48px", "important");

        el.style.setProperty("padding", "0", "important");

        el.style.setProperty("margin", "0", "important");

        el.style.setProperty("box-sizing", "border-box");

        // Kill the blue focus ring on tap/click — on the host element itself...
        el.style.setProperty("outline", "none", "important");

        el.style.setProperty("box-shadow", "none", "important");

        // ...and on calcite-button's own internal <button>, since its focus
        // ring lives inside ITS shadow root, not on the host we're styling
        // above — outline:none on the host alone doesn't reach it.
        const innerShadow = el.shadowRoot;

        if (innerShadow) {
          const innerButton = innerShadow.querySelector("button") as HTMLElement | null;

          if (innerButton) {
            innerButton.style.setProperty("outline", "none", "important");

            innerButton.style.setProperty("box-shadow", "none", "important");
          }
        }
      });
    };

    const start = () => {
      applyZoomSize();

      observer = new MutationObserver(() => {
        applyZoomSize();
      });

      observer.observe(zoom, {
        childList: true,
        subtree: true,
      });
    };

    start();

    return () => {
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const zoom = zoomRef.current;
    const mapElement = getMapElement();

    if (!zoom || !mapElement) return;

    const bindView = () => {
      const view = (mapElement as unknown as { view?: unknown }).view;

      if (view) {
        // `view` isn't part of the arcgis-zoom JSX typings when used detached
        // from <arcgis-map>, but it's a real settable property on the element.
        (zoom as unknown as { view: unknown }).view = view;
      }
    };

    bindView();

    mapElement.addEventListener("arcgisViewReadyChange", bindView);

    return () => {
      mapElement.removeEventListener("arcgisViewReadyChange", bindView);
    };
  }, []);

  return (
    <>
      <div className={styles.mobileIconsTopLeft}>
        <MapIcons isDashboard={false} subset={["theme", "3d", "category"]} />
      </div>

      <div className={styles.mobileIconsTopRight}>
        <MapIcons isDashboard={false} subset={["home", "locate"]} />

        <arcgis-zoom
          ref={(node) => {
            zoomRef.current = node as unknown as HTMLElement;
          }}
          className={styles.mobileZoom}
          visual-scale="l"
        />
      </div>
    </>
  );
}

/** Slotted control rail: icon column + zoom, plus view-specific extras. */
export function MapControlRail({
  isDashboard = false,
  children,
}: {
  isDashboard?: boolean;
  children?: ReactNode;
}) {
  const icons = <MapIcons isDashboard={isDashboard} />;

  const zoom = (
    <arcgis-zoom
      style={{
        position: "relative",
        ...(isDashboard && { transform: "rotate(270deg)" }),
      }}
    />
  );

  return (
    <div
      slot={isDashboard ? "bottom-left" : "bottom-right"}
      className={`${styles.mapControlsWrapper} ${isDashboard ? styles.dashboardMode : ""}`}
    >
      {isDashboard ? (
        <>
          {icons}
          {zoom}
        </>
      ) : (
        <>
          {children}
          {zoom}
          {icons}
        </>
      )}
    </div>
  );
}

/** Maps each open tool id → its panel. */
export function ToolPanelHost() {
  const {
    state: { openSubTools },
    dispatch,
  } = useMap();

  const closePanel = useCallback(
    (toolId: string) =>
      dispatch({
        type: "closeSubTool",
        payload: toolId,
      }),
    [dispatch],
  );

  const toolPanels: Record<string, ReactNode> = {
    "add-cad": <CadUploadTool onClose={() => closePanel("add-cad")} />,
  };

  const isMobile = useIsMobile();
  const dockOffset = useMobileDockOffset();

  // Mobile: panels stack in normal flow, flush above the docked toolbar
  // (Figma "Home Mobile" tool panels) instead of floating near the top of
  // the screen as free-standing draggable windows like on desktop.
  if (isMobile) {
    return (
      <div className={styles.mobilePanelStack} style={{ bottom: dockOffset }}>
        {openSubTools.map((toolId) => {
          const panel = toolPanels[toolId];
          if (!panel) return null;
          return (
            <div key={toolId} className={styles.mobilePanelItem}>
              {panel}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {openSubTools.map((toolId, index) => {
        const panel = toolPanels[toolId];

        if (!panel) {
          return null;
        }

        return (
          <Dragable key={toolId} index={index}>
            {panel}
          </Dragable>
        );
      })}
    </>
  );
}

/**
 * Gallery mounted only while picker is open.
 */
function BasemapGalleryPanel({ is3D }: { is3D: boolean }) {
  const [source] = useState(() => createBasemapGallerySource(is3D));

  return <arcgis-basemap-gallery source={source} referenceElement={getMapElement() ?? undefined} />;
}

/**
 * Basemap picker.
 */
export function BasemapPicker() {
  const {
    state: { basemapPickerOpen, viewMode },
    dispatch,
  } = useMap();

  if (!basemapPickerOpen) {
    return null;
  }

  const is3D = viewMode === VIEW_MODES.Map3D;

  return (
    <div className={styles.basemapPicker}>
      <div className={styles.basemapPickerHeader}>
        <span>الخرائط الأساسية</span>

        <button
          type="button"
          aria-label="إغلاق"
          onClick={() =>
            dispatch({
              type: "toggleBasemapPicker",
            })
          }
        >
          ✕
        </button>
      </div>

      <BasemapSwitcher is3D={is3D} />

      <div className={styles.basemapPickerDivider} />

      <BasemapGalleryPanel is3D={is3D} />
    </div>
  );
}