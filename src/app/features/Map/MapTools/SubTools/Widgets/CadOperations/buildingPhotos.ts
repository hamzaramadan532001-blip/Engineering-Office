"use client";

/**
 * Turns a photo the office picked into what the report sheet can print: a JPEG data URL,
 * downscaled.
 *
 * A data URL because the sheet is rasterised (html2canvas) — inline data is the one image
 * source that survives that without a fetch, the same reason the QR code is one. Downscaled
 * because a phone photo is 4000+ px and several MB, the sheet's photo boxes are ~150 px wide,
 * and three full-size photos would make the snapshot slow and the form state heavy.
 *
 * No React.
 */

/** Longest side, in pixels, a photo is scaled down to. Plenty for a ~150 px box at the
 *  export's 2× snapshot scale, with room to spare for a printed page. */
const MAX_PHOTO_SIDE = 1400;
const JPEG_QUALITY = 0.85;

export class PhotoReadError extends Error {}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new PhotoReadError("image could not be decoded"));
    image.src = url;
  });
}

/** Reads an image file into a downscaled JPEG data URL. Rejects with `PhotoReadError` for
 *  anything that is not a decodable image. */
export async function readPhotoFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new PhotoReadError("not an image");

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new PhotoReadError("no 2d context");

    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
