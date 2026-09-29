import { RASTER_FOLDER_URL } from "@/app/features/Map/arcgis.config";

/**
 * المصورات — dated imagery catalogue (IMG-01).
 *
 * The `Raster` folder holds 41 separate cached MapServers, one per capture, with NO
 * ImageServer mosaic and NO server `timeInfo` (dossier §6/§9.2). The catalogue — dates,
 * sensor kind and resolution — must therefore be parsed from each service NAME. This file
 * is the single source of truth for that list and the parser; the widget store turns the
 * selected item into a TileLayer.
 */

/** Aerial (جوي) vs satellite (فضائي) capture. */
export type ImageryKind = "aerial" | "satellite";

/**
 * A service statically known to never draw anything, independent of any runtime load error:
 * - `unrenderable` — the cache's spatial reference doesn't match the app's 32637 view (the
 *   tiles are served fine, they just can't be projected/drawn on this view).
 * - `no-city-data` — the cache spatial reference matches, but every tile over Makkah city is a
 *   blank/empty PNG — the cache itself has no imagery there (server-side gap).
 */
export type ImageryAvailabilityStatus = "unrenderable" | "no-city-data";

export interface ImageryAvailability {
  status: ImageryAvailabilityStatus;
  /** Arabic reason shown on the row/stop instead of letting the user toggle a dead layer on. */
  reasonAr: string;
}

export interface ImageryItem {
  /** Stable id — the ArcGIS service name (unique). */
  id: string;
  /** ArcGIS service name, shown as the row subtitle. */
  serviceName: string;
  /** Full MapServer URL, consumed as a cached TileLayer. */
  url: string;
  /** Arabic display title, e.g. "المصور الفضائي 2023 أكتوبر - 30 سم". */
  title: string;
  kind: ImageryKind;
  /** Capture year parsed from the name. */
  year: number;
  /** 1–12 when the name encodes a capture month, else null. */
  month: number | null;
  /** Ground resolution in centimetres when encoded in the name, else null. */
  resolutionCm: number | null;
  /**
   * Set only for services in `SERVICE_AVAILABILITY` — statically known to never render on this
   * view. Absent (undefined) means "no known issue", not "verified working": most of the 41
   * services have never been probed. Consumers must treat this as opt-in-broken, not opt-in-ok.
   */
  availability?: ImageryAvailability;
}

const SR_MISMATCH_REASON_AR = "نظام الإحداثيات لهذا المصور غير متوافق مع الخريطة";
const NO_CITY_DATA_REASON_AR = "بيانات هذا المصور غير متوفرة حاليًا من الخادم";

/**
 * Verified per-service rendering issues (QA issues #4/#5). Sourced from the live-service
 * diagnosis run 2026-07-19 — see "## Issue 4/5 service diagnosis" in
 * `docs/rebuild/qa-report-2026-07-18-fix-plan.md` for the full probe results (all 41 Raster/*
 * services are fused-cache TileLayers; `TileLayer` is the correct class everywhere — these four
 * are broken for reasons `TileLayer` can't route around). This table is a static, hand-verified
 * fact sheet, not a runtime check: **re-verify every entry when the server team republishes or
 * rebuilds one of these caches**, and remove it once fixed server-side.
 */
export const SERVICE_AVAILABILITY: Record<string, ImageryAvailability> = {
  // Cache SR is a custom WKT (KSA-GRF17_UTM_zone_37N, no wkid) — never draws on the 32637 view.
  ArialImage2024_WGS84_7cmV5: { status: "unrenderable", reasonAr: SR_MISMATCH_REASON_AR },
  // Cache SR is wkid 20437 (Ain el Abd) — never draws on the 32637 view.
  MakkaAerial2007_AinElAbd: { status: "unrenderable", reasonAr: SR_MISMATCH_REASON_AR },
  // Cache SR matches (32637), but every probed tile over the city is a blank 798-byte PNG.
  MakkaSatellite2011_WGS84: { status: "no-city-data", reasonAr: NO_CITY_DATA_REASON_AR },
  SatImage2009_WGS84_50cm: { status: "no-city-data", reasonAr: NO_CITY_DATA_REASON_AR },
};

/** Shared Arabic copy for a *runtime* TileLayer load failure (as opposed to the statically
 * known-broken services above) — used by the Imagery, TimeSlider and CompareLayers stores so a
 * failed `.when()` never leaves a layer silently "on" with nothing drawn. */
export const IMAGERY_LOAD_ERROR_TEXT = "تعذر تحميل هذا المصور من الخادم";

/**
 * The 41 `Raster/*` MapServer service names (dossier §6). Reference data — kept verbatim so
 * the subtitle matches the live service and the parser derives the Arabic title from it.
 */
const RASTER_SERVICES = [
  "ArialImage2015_WGS84_20cm",
  "ArialImage2024_WGS84_7cmV2",
  "ArialImage2024_WGS84_7cmV5",
  "ArialMomra2015WGS10CM",
  "ArialMomra2015WGS30CM",
  "BahraSatellite2012_WGS84",
  "MakkaAerial2007_AinElAbd",
  "MakkaAerial2007_WGS84",
  "MakkaSatellite2005_WGS84",
  "MakkaSatellite2006_WGS84",
  "MakkaSatellite2008_Geoeye_WGS84",
  "MakkaSatellite2010_WGS84",
  "MakkaSatellite2011_WGS84",
  "MakkaSatellite2012_WGS",
  "MakkaSatellite2014_WGS84",
  "MakkaSatellite2015_WGS84",
  "MakkaSatellite2016_Spot_WGS84",
  "MakkaSatellite2017WGS84_150cm",
  "MakkaSatellite2017WGS84_50cm",
  "MakkaSatellite2018_WGS84_WV31CM",
  "MakkaSatellite2019Spot_WGS84",
  "MakkaSatelliteImageSpot2018WGS84_150CM",
  "MakkaSatelliteImageSpot_Jun2020_WGS84_150CM_2",
  "MakkaSatellitePlaid_Oct2019_50CM_WGS84",
  "MakkaSatellitePlaied_Des2020_WGS84_50CM",
  "MakkaSatellitePlaied_Jun2020_WGS84_50CM",
  "MakkaSatellitePlaied_March_2020_WGS84_50CM",
  "MakkaSatellitePlaiedJun2019WGS84_50cm",
  "MakkaSatelliteSpot_Des2020_WGS84_150CM",
  "MakkaSatelliteSpot_Jun2019WGS84_150CM",
  "MakkaSatelliteSpot_March_2020_WGS84_150CM",
  "MakkaSatelliteSpot_Oct2019_150CM_WGS84",
  "MakkaSatelliteWorledview_APRIL2022_WGS84_50CM",
  "MakkaSatelliteWorledview_August2019_WGS84_40CM",
  "MakkaSatelliteWorledview_JAN2022_WGS84_50CM",
  "MakkaSatelliteWorledview_Mars2023_WGS84_50CM",
  "MakkaSatelliteWorledview_Oct2023_WGS84_30CM",
  "MakkaSatelliteWorledviewApril2023WGS84_50CM",
  "MakkaSatelliteWorledviewMars2025_WGS84_30CM",
  "SatImage2009_WGS84_50cm",
  "SatImage2015_WGS84_250cm",
] as const;

/** Month tokens that appear in service names → ({1–12}, Arabic name). Longest-first matters. */
const MONTHS: ReadonlyArray<readonly [RegExp, number, string]> = [
  [/august/i, 8, "أغسطس"],
  [/april/i, 4, "أبريل"],
  [/march/i, 3, "مارس"],
  [/mars/i, 3, "مارس"],
  [/june/i, 6, "يونيو"],
  [/jan/i, 1, "يناير"],
  [/feb/i, 2, "فبراير"],
  [/mar/i, 3, "مارس"],
  [/apr/i, 4, "أبريل"],
  [/jun/i, 6, "يونيو"],
  [/jul/i, 7, "يوليو"],
  [/aug/i, 8, "أغسطس"],
  [/sep/i, 9, "سبتمبر"],
  [/oct/i, 10, "أكتوبر"],
  [/nov/i, 11, "نوفمبر"],
  [/des/i, 12, "ديسمبر"],
  [/dec/i, 12, "ديسمبر"],
];

/** A month counts only when it directly precedes a date token (digit or underscore). */
function parseMonth(name: string): { month: number; ar: string } | null {
  for (const [re, num, ar] of MONTHS) {
    const m = name.match(new RegExp(`${re.source}(?=[\\d_])`, "i"));
    if (m) return { month: num, ar };
  }
  return null;
}

function parseYear(name: string): number | null {
  const m = name.match(/(?:19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

function parseResolutionCm(name: string): number | null {
  const m = name.match(/(\d{1,3})\s*cm/i);
  return m ? Number(m[1]) : null;
}

function parseKind(name: string): ImageryKind {
  return /arial|aerial|momra/i.test(name) ? "aerial" : "satellite";
}

function buildTitle(kind: ImageryKind, year: number, monthAr: string | null, cm: number | null) {
  const kindAr = kind === "aerial" ? "المصور الجوي" : "المصور الفضائي";
  let title = `${kindAr} ${year}`;
  if (monthAr) title += ` ${monthAr}`;
  if (cm) title += ` - ${cm} سم`;
  return title;
}

/**
 * Known name markers that can disambiguate a title collision (QA issue #3 — `buildTitle()`
 * only encodes kind/year/month/resolution, so distinct services occasionally collapse to the
 * same label). Small, generic dictionary: a marker's Arabic label is appended in parentheses
 * only when that marker is what actually distinguishes the colliding pair — see
 * `disambiguateTitles()`. Longest/most-specific pattern first is not required since markers
 * are matched independently per item.
 */
const VARIANT_MARKERS: ReadonlyArray<{ id: string; pattern: RegExp; label: string }> = [
  { id: "AinElAbd", pattern: /AinElAbd/i, label: "عين العبد" },
  { id: "Bahra", pattern: /Bahra/i, label: "بحرة" },
  { id: "Makka", pattern: /Makka/i, label: "مكة" },
  { id: "7cmV2", pattern: /7cmV2/i, label: "V2" },
  { id: "7cmV5", pattern: /7cmV5/i, label: "V5" },
];

/** Every known marker present in a service name (a name can match more than one). */
function matchedMarkerIds(serviceName: string): Set<string> {
  const ids = new Set<string>();
  for (const marker of VARIANT_MARKERS) {
    if (marker.pattern.test(serviceName)) ids.add(marker.id);
  }
  return ids;
}

/**
 * Disambiguate colliding titles (QA issue #3): when two or more items share the same
 * `buildTitle()` output — i.e. the same (kind, year, month, resolutionCm) — append a variant
 * label to each one, parsed from whichever known marker is unique to it *within that group*.
 * A marker shared by every member of the group (e.g. the "Makka" prefix on both 2007
 * captures) doesn't disambiguate anything and is ignored, so that item's title is left
 * unchanged. Groups of size 1 (the common case) are untouched — this never alters a title
 * that was already unique.
 */
function disambiguateTitles(items: ImageryItem[]): ImageryItem[] {
  const groups = new Map<string, ImageryItem[]>();
  for (const item of items) {
    const group = groups.get(item.title);
    if (group) group.push(item);
    else groups.set(item.title, [item]);
  }

  return items.map((item) => {
    const group = groups.get(item.title);
    if (!group || group.length < 2) return item;

    const ownMarkers = matchedMarkerIds(item.serviceName);
    const othersMarkers = new Set<string>();
    for (const sibling of group) {
      if (sibling === item) continue;
      for (const id of matchedMarkerIds(sibling.serviceName)) othersMarkers.add(id);
    }

    const uniqueMarker = VARIANT_MARKERS.find(
      (marker) => ownMarkers.has(marker.id) && !othersMarkers.has(marker.id),
    );
    if (!uniqueMarker) return item;

    return { ...item, title: `${item.title} (${uniqueMarker.label})` };
  });
}

/**
 * Parse the raster service names into a dated catalogue, sorted newest-first (so the most
 * recent capture sits at the top — RTL reading order, per legacy U03). Items with an
 * unparseable year are dropped (none in the live list, but the parser stays defensive).
 */
export function buildImageryCatalogue(): ImageryItem[] {
  const items = RASTER_SERVICES.map((serviceName): ImageryItem | null => {
    const year = parseYear(serviceName);
    if (year === null) return null;
    const kind = parseKind(serviceName);
    const month = parseMonth(serviceName);
    const resolutionCm = parseResolutionCm(serviceName);
    return {
      id: serviceName,
      serviceName,
      url: `${RASTER_FOLDER_URL}/${serviceName}/MapServer`,
      title: buildTitle(kind, year, month?.ar ?? null, resolutionCm),
      kind,
      year,
      month: month?.month ?? null,
      resolutionCm,
      availability: SERVICE_AVAILABILITY[serviceName],
    };
  }).filter((item): item is ImageryItem => item !== null);

  return disambiguateTitles(items).sort(
    (a, b) => b.year - a.year || (b.month ?? 0) - (a.month ?? 0),
  );
}
