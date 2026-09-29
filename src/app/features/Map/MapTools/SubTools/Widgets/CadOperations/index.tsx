"use client";

import { Text } from "@makkah-municipality-gis/ui";
import { useState, useSyncExternalStore } from "react";
import { HiChevronDown, HiOutlineSquares2X2 } from "react-icons/hi2";
import { cadDrawingStore } from "../CadUploadTool/store";
import styles from "./CadOperations.module.scss";
import { COPY } from "./constants";
import IntersectOperation from "./IntersectOperation";

/**
 * The CAD operations panel. It holds ONE operation — the intersection with the regulation
 * line — so it is shown directly, always open, rather than behind an accordion header.
 */
export default function CadOperations() {
  const drawing = useSyncExternalStore(
    cadDrawingStore.subscribe,
    cadDrawingStore.getSnapshot,
    cadDrawingStore.getServerSnapshot,
  );

  const [panelOpen, setPanelOpen] = useState(false);

  // The whole rail only exists once something is actually drawn — no point
  // offering operations with nothing to operate on.
  if (!drawing) return null;

  return (
    <div className={styles.rail}>
      <button
        type="button"
        className={styles.railToggle}
        aria-expanded={panelOpen}
        aria-label={COPY.toggleAria}
        onClick={() => setPanelOpen((open) => !open)}
      >
        <HiOutlineSquares2X2 size={18} />
        <span className={styles.railToggleLabel}>{COPY.title}</span>
        <HiChevronDown
          size={16}
          className={`${styles.railChevron} ${panelOpen ? styles.railChevronOpen : ""}`}
        />
      </button>

      <div className={styles.panel} hidden={!panelOpen}>
        <div className={styles.activeFile}>
          <Text size="xs" c="dimmed">
            {COPY.activeFilePrefix}
          </Text>
          <Text size="xs" fw={600} className={styles.activeFileName}>
            {drawing.fileName}
          </Text>
        </div>

        <section className={styles.operation}>
          <div className={styles.operationHeader}>{COPY.intersect.title}</div>
          <div className={styles.operationBody}>
            <IntersectOperation drawing={drawing} />
          </div>
        </section>
      </div>
    </div>
  );
}