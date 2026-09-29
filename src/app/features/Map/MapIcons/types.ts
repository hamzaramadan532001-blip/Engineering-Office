import type { ReactNode } from "react";

export type MapIconId = "3d" | "category" | "home" | "locate" | "theme";

export type MapIconItem = {
  id: MapIconId;
  /** Arabic accessible name — these are icon-only buttons, so screen readers need it. */
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** Renders the button in its active (brand-green) state — e.g. the 3D toggle while in 3D. */
  active?: boolean;
};
