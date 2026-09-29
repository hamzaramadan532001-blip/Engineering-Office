import { useEffect, useState } from "react";

/** Matches the app's existing mobile breakpoint (see `@media (max-width: 640px)` in Map.module.scss / ProfileMenu.module.scss). */
const MOBILE_QUERY = "(max-width: 640px)";

/** True once the viewport is at or below the app's mobile breakpoint. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mql.matches);

    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
