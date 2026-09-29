"use client";

/**
 * "الخريطة" on the admin card — the request's drawing on a map, in a modal.
 *
 * Presentation only: the map is built and torn down by `createRequestMap` (requestMap.ts);
 * this component gives it a container while the modal is open and reports its state.
 */

import { Loader, Modal, Text } from "@makkah-municipality-gis/ui";
import { useEffect, useRef, useState } from "react";
import styles from "./admin.module.scss";
import { createRequestMap } from "./requestMap";

export type RequestMapModalProps = {
  /** The request to show. `null` closes the modal. */
  requestId: number | null;
  /** Shown in the title — the request's description or number. */
  label?: string;
  onClose: () => void;
};

type MapState = "loading" | "ready" | "empty" | "error";

export default function RequestMapModal({ requestId, label, onClose }: RequestMapModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<MapState>("loading");

  useEffect(() => {
    if (requestId === null) return;

    let destroyed = false;
    let destroy: (() => void) | null = null;
    setState("loading");

    // The modal's body mounts a frame after `opened` flips, so wait for the container.
    const frame = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      createRequestMap(container, requestId)
        .then((handle) => {
          if (destroyed) {
            handle.destroy();
            return;
          }
          destroy = handle.destroy;
          setState(handle.hasDrawing ? "ready" : "empty");
        })
        .catch((error) => {
          console.error("[admin] the request map failed to load:", error);
          if (!destroyed) setState("error");
        });
    });

    return () => {
      destroyed = true;
      cancelAnimationFrame(frame);
      destroy?.();
    };
  }, [requestId]);

  return (
    <Modal
      opened={requestId !== null}
      onClose={onClose}
      title={label ? `خريطة الطلب — ${label}` : "خريطة الطلب"}
      size="xl"
      centered
    >
      <div className={styles.requestMapFrame}>
        <div ref={containerRef} className={styles.requestMap} />

        {state === "loading" && (
          <div className={styles.requestMapOverlay}>
            <Loader size={20} color="green" />
            <span>جارٍ تحميل الخريطة...</span>
          </div>
        )}
        {state === "empty" && (
          <div className={styles.requestMapOverlay}>
            <Text size="sm">لم يرفع المكتب الهندسي رسمة كاد لهذا الطلب بعد.</Text>
          </div>
        )}
        {state === "error" && (
          <div className={styles.requestMapOverlay}>
            <Text size="sm">تعذّر تحميل خريطة الطلب.</Text>
          </div>
        )}
      </div>

      <div className={styles.requestMapLegend}>
        <span>
          <i className={styles.legendParcel} /> رسمة الكاد
        </span>
        <span>
          <i className={styles.legendInside} /> داخل خط التنظيم
        </span>
        <span>
          <i className={styles.legendOutside} /> خارج خط التنظيم
        </span>
      </div>
    </Modal>
  );
}
