"use client";

import { Button, Loader, SegmentedControl, Tooltip } from "@makkah-municipality-gis/ui";
import styles from "./BasemapSwitcher.module.scss";
import {
  BASEMAP_MODES,
  type BasemapMode,
  CUSTOM_BASEMAP_TEXT,
  LOADING_TEXT,
  RETRY_TEXT,
  SWITCHER_TITLE,
  UNAVAILABLE_3D_TEXT,
} from "./constants";
import { useBasemapSwitcher } from "./store";

/**
 * The three-way basemap switcher (BM-05) at the top of the basemap picker. Presentation only —
 * every map mutation lives in the store. Disabled in 3D (SceneView rejects the WKID 32637
 * caches); the Esri gallery below stays as the 3D-safe way to change basemaps.
 */
export default function BasemapSwitcher({ is3D }: { is3D: boolean }) {
  const { mode, loading, errorText, select, retry } = useBasemapSwitcher();

  const options = BASEMAP_MODES.map((option) => ({
    value: option.id,
    label: (
      <Tooltip label={option.hint} position="top" withArrow>
        <span className={styles.segmentLabel}>{option.label}</span>
      </Tooltip>
    ),
  }));

  return (
    <section className={styles.switcher} dir="rtl">
      <span className={styles.title}>{SWITCHER_TITLE}</span>

      <SegmentedControl
        fullWidth
        size="xs"
        data={options}
        value={mode ?? ""}
        onChange={(value) => select(value as BasemapMode)}
        disabled={is3D}
        aria-label={SWITCHER_TITLE}
      />

      {is3D && <p className={styles.note}>{UNAVAILABLE_3D_TEXT}</p>}

      {!is3D && loading && (
        <p className={styles.note}>
          <Loader size="xs" />
          {LOADING_TEXT}
        </p>
      )}

      {!is3D && !loading && errorText && (
        <div className={styles.error} role="alert">
          <span>{errorText}</span>
          <Button size="compact-xs" variant="light" onClick={retry}>
            {RETRY_TEXT}
          </Button>
        </div>
      )}

      {!is3D && !loading && !errorText && mode === null && (
        <p className={styles.note}>{CUSTOM_BASEMAP_TEXT}</p>
      )}
    </section>
  );
}
