"use client";

/**
 * THE styling for the three regulation layers of a request.
 *
 * One module, because the same three shapes are drawn by two different mechanisms and
 * must be indistinguishable:
 *
 *  - right after "تطبيق" on the intersect operation, the split is a transient client-side
 *    GeoJSONLayer (CadOperations/useOperationLayer);
 *  - on reopening the request later, the SAME split comes back as server FeatureLayers
 *    0 and 1 (features/Map/requestResultLayers.ts);
 *  - the admin dashboard's per-request map (app/admin/requestMap.ts) draws the same three.
 *
 * If each defined its own colours, a parcel would change appearance the moment the page
 * was reloaded. Both read from here instead, so it never does.
 *
 * Colours come from design tokens (CLAUDE.md: never hardcode hex). ArcGIS symbols cannot
 * read CSS variables, so `resolveToken` reads the computed value off `:root` at draw time —
 * the token stays the single source of truth and dark mode is picked up for free.
 */

import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import { resolveToken } from "@/lib/designTokens";
import { hexToRgba } from "./arcgisColor";

/** Outline width, in points, for the inside and outside parts. The whole point of the
 *  styling is that the two parts read as distinct areas at a glance, so the border is
 *  deliberately heavy rather than the 1px hairline the operation used before. */
export const REGULATION_OUTLINE_WIDTH = 2;

/** Fill opacity — low enough that the basemap and the parcel underneath stay readable,
 *  high enough that the colour is unmistakable. */
const FILL_OPACITY = 0.35;

/**
 * داخل خط التنظيم — the regulated part. Red FILL: on this form it means "this area falls
 * inside the regulation boundary and is therefore constrained", which is a finding the
 * reviewer must not miss, not a decorative choice.
 *
 * Its BORDER is blue, deliberately contrasting with the fill rather than matching it, so
 * the edge of the regulated area stays traceable where two red areas touch or where the
 * fill sits over dark imagery.
 */
const INSIDE_FILL_TOKEN = "--red-600";
const INSIDE_FILL_FALLBACK = "#D92D20";
const INSIDE_OUTLINE_TOKEN = "--blue-600";
const INSIDE_OUTLINE_FALLBACK = "#1570EF";

/**
 * خارج خط التنظيم — the unconstrained remainder. Brand-green fill, yellow border.
 *
 * `--gold-500` is the truest yellow in the token set; the `--yellow-*` scale runs amber
 * (its 400 step is #FDB022) and reads as orange against a basemap.
 */
const OUTSIDE_FILL_TOKEN = "--primary-sa-600";
const OUTSIDE_FILL_FALLBACK = "#1B8354";
const OUTSIDE_OUTLINE_TOKEN = "--gold-500";
const OUTSIDE_OUTLINE_FALLBACK = "#F5BD02";

/** The full CAD parcel envelope (layer 2). Drawn as an outline only, with NO fill, so it
 *  frames the two coloured parts instead of tinting them a third colour. */
const PARCEL_TOKEN = "--neutral-900";
const PARCEL_FALLBACK = "#111927";

type Rgb = [number, number, number];

function tokenRgb(token: string, fallback: string): Rgb {
  const color = hexToRgba(resolveToken(token, fallback), 100);
  return [color.r, color.g, color.b];
}

/** A filled polygon symbol with a heavy border, whose colour is independent of the fill. */
function filledSymbol(fillRgb: Rgb, outlineRgb: Rgb): SimpleFillSymbol {
  return new SimpleFillSymbol({
    color: [...fillRgb, FILL_OPACITY],
    outline: { color: [...outlineRgb, 1], width: REGULATION_OUTLINE_WIDTH },
  });
}

/** Red fill, 2px BLUE border. */
export function insideSymbol(): SimpleFillSymbol {
  return filledSymbol(
    tokenRgb(INSIDE_FILL_TOKEN, INSIDE_FILL_FALLBACK),
    tokenRgb(INSIDE_OUTLINE_TOKEN, INSIDE_OUTLINE_FALLBACK),
  );
}

/** Green fill, 2px YELLOW border. */
export function outsideSymbol(): SimpleFillSymbol {
  return filledSymbol(
    tokenRgb(OUTSIDE_FILL_TOKEN, OUTSIDE_FILL_FALLBACK),
    tokenRgb(OUTSIDE_OUTLINE_TOKEN, OUTSIDE_OUTLINE_FALLBACK),
  );
}

/** Outline-only symbol for the whole-parcel layer. */
export function parcelSymbol(): SimpleFillSymbol {
  const rgb = tokenRgb(PARCEL_TOKEN, PARCEL_FALLBACK);
  return new SimpleFillSymbol({
    color: [0, 0, 0, 0],
    style: "none",
    outline: { color: [...rgb, 1], width: REGULATION_OUTLINE_WIDTH },
  });
}

export function insideRenderer(): SimpleRenderer {
  return new SimpleRenderer({ symbol: insideSymbol() });
}

export function outsideRenderer(): SimpleRenderer {
  return new SimpleRenderer({ symbol: outsideSymbol() });
}

export function parcelRenderer(): SimpleRenderer {
  return new SimpleRenderer({ symbol: parcelSymbol() });
}

/**
 * Renderer for the transient split layer, which carries both parts in one collection
 * tagged by a `zone` attribute ("inside" / "outside") — see CadOperations/intersect.ts.
 * Same symbols as the server layers above, so the transient and the stored rendering of a
 * request are pixel-identical.
 */
export function intersectSplitRenderer(labels: {
  inside: string;
  outside: string;
}): UniqueValueRenderer {
  return new UniqueValueRenderer({
    field: "zone",
    // An untagged feature is treated as "outside": that is what a drawing with no
    // regulation data published for its extent resolves to.
    defaultSymbol: outsideSymbol(),
    uniqueValueInfos: [
      { value: "inside", label: labels.inside, symbol: insideSymbol() },
      { value: "outside", label: labels.outside, symbol: outsideSymbol() },
    ],
  });
}
