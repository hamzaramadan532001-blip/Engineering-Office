"use client";

import { BiCategory } from "react-icons/bi";
import { LuLocateFixed, LuMoon, LuSun } from "react-icons/lu";
import { TbHome } from "react-icons/tb";
import { useTheme } from "@/app/theme/ThemeContext";
import { usePermissions } from "@/lib/permissions";
import styles from "../Map.module.scss";
import { useMap } from "../MapProvidor";
import { MAP_FUNCTIONS } from "../MapTools/SubTools/Widgets/constants";
import type { MapIconId, MapIconItem } from "./types";
import { useHomeIcon } from "./useHomeIcon";
import { useLocateIcon } from "./useLocateIcon";
import { useViewModeToggle } from "./useViewModeToggle";

/** Dashboard mode lays the icons out in a row, in this order. */
const DASHBOARD_ORDER: MapIconId[] = ["3d", "category", "locate", "home", "theme"];

type MapIconsProps = {
  isDashboard: boolean;
  /**
   * Render only these icon ids, in this order — used on phones to split the explorer
   * column into two smaller clusters (see `MobileIconGroups` in MapChrome.tsx) instead
   * of one tall column. Omit for the normal full column (desktop explorer / dashboard).
   */
  subset?: MapIconId[];
};

/** Map-icon → FUNCTIONS row. */
const ICON_FUNCTIONS: Partial<Record<MapIconId, string>> = {
  locate: MAP_FUNCTIONS.locator,
};

/**
 * The floating icon column next to the zoom control. Home and locate are wired;
 * 3D toggles between the 2D MapView and the 3D WebScene; theme toggles light/dark
 * mode for the whole app (not just this panel — see `app/theme/ThemeContext`).
 */
export default function MapIcons({ isDashboard, subset }: MapIconsProps) {
  const { goHome } = useHomeIcon();
  const { locate } = useLocateIcon();
  const { is3D, toggle: toggleViewMode } = useViewModeToggle();
  const { theme, toggleTheme } = useTheme();
  const {
    state: { basemapPickerOpen },
    dispatch,
  } = useMap();
  const { loading, can } = usePermissions();

  const isDark = theme === "dark";

  const icons: MapIconItem[] = [
    {
      id: "3d",
      // The button targets the *other* mode: shows "2D" (to switch back) while in 3D.
      label: is3D ? "عرض ثنائي الأبعاد" : "عرض ثلاثي الأبعاد",
      icon: <span className={styles.textIcon}>{is3D ? "2D" : "3D"}</span>,
      onClick: toggleViewMode,
      active: is3D,
    },
    {
      id: "category",
      label: "الخرائط الأساسية",
      icon: <BiCategory />,
      onClick: () => dispatch({ type: "toggleBasemapPicker" }),
      active: basemapPickerOpen,
    },
    {
      id: "home",
      label: "العودة إلى الموقع الافتراضي",
      icon: <TbHome />,
      onClick: goHome,
    },
    {
      id: "locate",
      label: "تحديد موقعي الحالي",
      icon: <LuLocateFixed />,
      onClick: locate,
    },
    {
      // Targets the *other* mode, same convention as the 3D button above:
      // shows the sun (switch to light) while dark is active, and vice versa.
      id: "theme",
      label: isDark ? "الوضع الفاتح" : "الوضع الداكن",
      icon: isDark ? <LuSun /> : <LuMoon />,
      onClick: toggleTheme,
      active: isDark,
    },
  ];

  // Fail closed: a gated icon is dropped while the grants load, and stays dropped
  // unless the session holds its function. Icons absent from the map are ungated.
  const granted = icons.filter((i) => {
    const required = ICON_FUNCTIONS[i.id];
    return !required || (!loading && can(required));
  });

  const ordered = isDashboard
    ? DASHBOARD_ORDER.flatMap((id) => granted.filter((i) => i.id === id))
    : subset
      ? subset.flatMap((id) => granted.filter((i) => i.id === id))
      : granted;

  // The full explorer column (no subset) is desktop-only — on phones it's replaced by the
  // two `MobileIconGroups` clusters below, each rendering this same component with a subset.
  const columnVariant = isDashboard
    ? styles.dashboardIconsRow
    : !subset
      ? styles.explorerIconsColumn
      : "";

  return (
    <div className={`${styles.customIconsColumn} ${columnVariant}`}>
      {ordered.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`${styles.mapIconButton} ${item.active ? styles.mapIconButtonActive : ""}`}
          aria-label={item.label}
          title={item.label}
          aria-pressed={item.active}
          onClick={item.onClick}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}
