import type { IconType } from "react-icons";
import { HiDocumentArrowUp } from "react-icons/hi2";

/**
 * Capability names, NOT app constants: every value is a row in the production
 * FUNCTIONS table (FUNCTIONNAME), so access changes ship as data, not deploys.
 * Confirm each against that table at rollout — these match the seeded set.
 */
export const MAP_FUNCTIONS = {
  cadLayer: "CADLayer",
  locator: "Locator",
} as const;

/** One entry of the widget bar. */
export interface WidgetEntry {
  readonly id: string;
  readonly label: string;
  readonly Icon: IconType;
  /** Hidden unless the session holds this function (PERM-21). Ungated when omitted. */
  readonly requiredFunction?: string;
}

export const widgets = [
  {
    id: "add-cad",
    label: "إضافة CAD",
    Icon: HiDocumentArrowUp,
    requiredFunction: MAP_FUNCTIONS.cadLayer,
  },
] as const satisfies readonly WidgetEntry[];

export type Widgets = (typeof widgets)[number]["id"];

/**
 * The same list under the uniform entry type, so the renderer can read the optional
 * `requiredFunction` without narrowing each literal member.
 */
export const WIDGET_ENTRIES: readonly (WidgetEntry & { readonly id: Widgets })[] = widgets;

/**
 * Shared sizing for the floating widget Cards. The Dragable wrapper is a shrink-to-fit
 * absolute box (react-rnd, `width: "auto"`), so a percentage width has nothing definite
 * to resolve against — use a fixed width clamped to the viewport for small screens.
 */
export const WIDGET_PANEL_WIDTH = 400;
export const WIDGET_PANEL_MAX_WIDTH = "calc(100vw - 8px)";
