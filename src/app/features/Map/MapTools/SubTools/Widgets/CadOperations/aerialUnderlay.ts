"use client";

/**
 * The two aerial photos on the report — "مصور جوي يثبت وجود المبنى قبل تاريخ ٢٥ / ٣ / ١٤٤١ هـ"
 * (October 2019) and "مصور جوي حديث" (2024): each is the imagery as the BACKGROUND with the
 * CAD polygon drawn on top. Both use the SAME frame, so the two boxes show the same ground
 * and can be compared side by side.
 *
 * The photo comes from the service's own `export` operation (a map image of exactly the
 * extent we ask for), NOT from a screenshot of the live map, so the report never depends
 * on what the user happens to have on screen. The imagery and the CAD are both WKID 32637,
 * so the polygon is placed on the photo with a plain linear mapping — no reprojection.
 *
 * The image is returned as a data: URL on purpose. The sheet is rasterised by html2canvas,
 * which serialises the sketch's <svg> to an image; a remote URL (taints the canvas) or a
 * blob: URL (does not survive serialisation) would both leave the box blank in the PDF.
 *
 * No React.
 */

import esriRequest from "@arcgis/core/request";
import { RASTER_FOLDER_URL } from "@/app/features/Map/arcgis.config";
import type { GeoJSONFeatureCollection } from "../CadUploadTool/geometry";

/** A Raster/* MapServer that can fill one of the report's photo boxes. */
export type AerialSource = {
  /** Service name under the Raster folder. */
  service: string;
  /** Printed under the box title so the reader knows which capture the photo is. */
  label: string;
};

/** Proves the building existed before 25/3/1441 هـ (≈ Nov 2019). */
export const AERIAL_BEFORE: AerialSource = {
  service: "MakkaSatellitePlaid_Oct2019_50CM_WGS84",
  label: "المصدر: مصور فضائي أكتوبر ٢٠١٩ — ٥٠ سم",
};

/** The recent photo. Its Boundary / Footprint / Seamline sublayers are off by default on
 *  the server, so a plain export shows the imagery only. */
export const AERIAL_RECENT: AerialSource = {
  service: "ArialImage2024_WGS84_7cmV2",
  label: "المصدر: مصور جوي ٢٠٢٤ — ٧ سم",
};

/** The service's cache SR — and the CAD file's. */
const AERIAL_WKID = 32637;

/** Size of the requested image, and so the aspect ratio of the frame (4:3). */
const IMAGE = { width: 1000, height: 750 } as const;

/** The polygon fills at most this share of the frame, leaving the surroundings visible. */
const FILL_RATIO = 0.55;

/** A tiny parcel would otherwise be zoomed in past what a 50 cm image can support. */
const MIN_SPAN_METRES = 80;

export type AerialUnderlay = {
  /** The photo, base64-encoded. */
  dataUrl: string;
  /** Which capture this is — printed under the box title. */
  sourceLabel: string;
  /** SVG viewBox — equal to the image size, so `paths` are in image pixels. */
  width: number;
  height: number;
  /** One closed SVG path per polygon ring, already in image pixels. */
  paths: string[];
};

/** Every polygon ring of the CAD (x/y only), from a collection in the file's own CRS.
 *  Lines, points and text have no outline to frame a building, so they are skipped. */
export function collectPolygonRings(collection: GeoJSONFeatureCollection): number[][][] {
  const rings: number[][][] = [];

  const push = (polygon: number[][][]) => {
    for (const ring of polygon) {
      const clean = ring
        .map((p) => [p[0], p[1]])
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
      if (clean.length >= 3) rings.push(clean);
    }
  };

  for (const feature of collection.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    if (geometry.type === "Polygon") {
      push(geometry.coordinates as number[][][]);
    } else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates as number[][][][]) push(polygon);
    }
  }

  return rings;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the image."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetches the photo framing `rings` (metres, WKID 32637) and lays the rings over it.
 * Resolves `null` when there is nothing to frame; rejects if the service cannot be read,
 * so the caller decides whether the report goes out without the photo.
 */
export async function loadAerialUnderlay(
  rings: number[][][],
  source: AerialSource = AERIAL_BEFORE,
): Promise<AerialUnderlay | null> {
  if (rings.length === 0) return null;

  const all = rings.flat();
  const minX = Math.min(...all.map((p) => p[0]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxY = Math.max(...all.map((p) => p[1]));

  // A frame of the image's aspect ratio, centred on the polygon, big enough that the
  // polygon takes up at most FILL_RATIO of it in both directions.
  const aspect = IMAGE.width / IMAGE.height;
  const frameWidth = Math.max(
    (maxX - minX) / FILL_RATIO,
    ((maxY - minY) / FILL_RATIO) * aspect,
    MIN_SPAN_METRES,
  );
  const frameHeight = frameWidth / aspect;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const xmin = cx - frameWidth / 2;
  const xmax = cx + frameWidth / 2;
  const ymin = cy - frameHeight / 2;
  const ymax = cy + frameHeight / 2;

  // esriRequest (not a bare fetch) so the identity manager attaches the same token the
  // imagery widget's TileLayer uses.
  const response = await esriRequest(`${RASTER_FOLDER_URL}/${source.service}/MapServer/export`, {
    query: {
      bbox: `${xmin},${ymin},${xmax},${ymax}`,
      bboxSR: AERIAL_WKID,
      imageSR: AERIAL_WKID,
      size: `${IMAGE.width},${IMAGE.height}`,
      format: "jpg",
      f: "image",
    },
    responseType: "blob",
  });

  const blob = response.data as Blob;
  // A failed export can come back as a JSON error body with a 200 status.
  if (!blob.type.startsWith("image/")) {
    throw new Error("The imagery service did not return an image.");
  }

  const px = (x: number) => ((x - xmin) / frameWidth) * IMAGE.width;
  const py = (y: number) => IMAGE.height - ((y - ymin) / frameHeight) * IMAGE.height;

  const paths = rings.map(
    (ring) =>
      `${ring
        .map(([x, y], i) => `${i === 0 ? "M" : "L"}${px(x).toFixed(1)} ${py(y).toFixed(1)}`)
        .join(" ")} Z`,
  );

  return {
    dataUrl: await blobToDataUrl(blob),
    sourceLabel: source.label,
    width: IMAGE.width,
    height: IMAGE.height,
    paths,
  };
}

/** Both photos of the report. Either can be `null` on its own (nothing to frame, or that
 *  service could not be read) — one failing never takes the other down with it. */
export type ReportAerials = {
  before: AerialUnderlay | null;
  recent: AerialUnderlay | null;
};

/** Loads the October-2019 and the 2024 photo for the same polygon, in parallel. Never
 *  rejects: a photo that cannot be loaded is `null`, and the report's box stays blank. */
export async function loadReportAerials(rings: number[][][]): Promise<ReportAerials> {
  const [before, recent] = await Promise.allSettled([
    loadAerialUnderlay(rings, AERIAL_BEFORE),
    loadAerialUnderlay(rings, AERIAL_RECENT),
  ]);

  const take = (result: PromiseSettledResult<AerialUnderlay | null>, name: string) => {
    if (result.status === "fulfilled") return result.value;
    console.warn(`[CAD ops] aerial photo (${name}) for the report failed:`, result.reason);
    return null;
  };

  return { before: take(before, AERIAL_BEFORE.service), recent: take(recent, AERIAL_RECENT.service) };
}