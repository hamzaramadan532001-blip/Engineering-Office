import { useEffect, useState } from "react";

/** Gap between the top of the docked toolbar and the bottom of a stacked panel above it. */
const GAP = 8;

/**
 * Distance (px) from the bottom of the viewport up to the top of the fixed
 * `[data-slot-bottom-center]` tool dock, plus a small gap — i.e. the `bottom`
 * offset a mobile panel needs so it sits flush above the dock instead of
 * floating near the top of the screen (Figma "Home Mobile" tool panels).
 *
 * Measured from the live DOM rather than a hardcoded constant because the
 * dock's own fixed positioning/height comes from the shared UI package
 * (`@makkah-municipality-gis/ui`'s `MapBox` `data-slot-bottom-center`
 * styling), which isn't something this app's code controls directly.
 */
export function useMobileDockOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const dock = document.querySelector<HTMLElement>("[data-slot-bottom-center]");
    if (!dock) return;

    const measure = () => {
      const rect = dock.getBoundingClientRect();
      setOffset(Math.max(0, window.innerHeight - rect.top + GAP));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(dock);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  return offset;
}
