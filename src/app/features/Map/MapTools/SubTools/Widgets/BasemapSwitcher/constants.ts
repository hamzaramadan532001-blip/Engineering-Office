import { buildImageryCatalogue, type ImageryItem } from "../Imagery/catalogue";

/**
 * Reference data for the three-way basemap switcher (BM-05, legacy U02). Service URLs stay
 * in `Map/arcgis.config.ts`; the satellite capture comes from the imagery catalogue.
 */

export type BasemapMode = "base" | "satellite" | "hybrid";

export interface BasemapModeOption {
  id: BasemapMode;
  /** Arabic label shown on the segment. */
  label: string;
  /** Arabic tooltip describing what the mode draws. */
  hint: string;
}

/** The three modes, in Figma/legacy order (base first — it is the default). */
export const BASEMAP_MODES: readonly BasemapModeOption[] = [
  { id: "base", label: "أساس", hint: "خريطة الأساس البلدية" },
  { id: "satellite", label: "قمر صناعي", hint: "أحدث مصور فضائي متاح" },
  { id: "hybrid", label: "هجين", hint: "المصور الفضائي مع الشوارع والمسميات" },
] as const;

/**
 * The satellite base: newest capture that is not statically known-broken. The Imagery
 * panel remains the way to pick any other capture.
 */
export const SATELLITE_SOURCE: ImageryItem | null =
  buildImageryCatalogue().find((item) => !item.availability) ?? null;

/**
 * The hybrid overlay is an opaque cached map, so multiply-blend it: light background pixels
 * leave the imagery untouched while roads and labels darken through.
 */
export const REFERENCE_BLEND_MODE = "multiply";

/** Titles carried by the layers this widget puts on the map (also how they are recognised). */
export const BASE_LAYER_TITLE = "خريطة الأساس";
export const REFERENCE_LAYER_TITLE = "الشوارع والمسميات";

export const SWITCHER_TITLE = "نوع عرض الخريطة";
export const LOADING_TEXT = "جارٍ تحميل خريطة الأساس…";
export const LOAD_ERROR_TEXT = "تعذر تحميل خريطة الأساس المحددة";
export const NO_SATELLITE_TEXT = "لا يتوفر مصور فضائي متوافق مع الخريطة";
export const CUSTOM_BASEMAP_TEXT = "خريطة أساس مخصصة من المعرض";
export const UNAVAILABLE_3D_TEXT = "غير متاح في العرض ثلاثي الأبعاد — اختر من المعرض أدناه";
export const RETRY_TEXT = "إعادة المحاولة";
