"use client";

/**
 * Image → 640×640 letterboxed tensor (NCHW, float32 [0,1]) for YOLOv8.
 * Returns the letterbox parameters needed to map boxes back to the
 * original image coordinates.
 */

export const MODEL_SIZE = 640;

export interface LetterboxInfo {
  scale: number;
  padX: number;
  padY: number;
  originalWidth: number;
  originalHeight: number;
}

export interface PreprocessResult {
  data: Float32Array;
  letterbox: LetterboxInfo;
}

export function preprocessImage(image: HTMLImageElement): PreprocessResult {
  const ow = image.naturalWidth;
  const oh = image.naturalHeight;
  const scale = Math.min(MODEL_SIZE / ow, MODEL_SIZE / oh);
  const nw = Math.round(ow * scale);
  const nh = Math.round(oh * scale);
  const padX = Math.floor((MODEL_SIZE - nw) / 2);
  const padY = Math.floor((MODEL_SIZE - nh) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = MODEL_SIZE;
  canvas.height = MODEL_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.fillStyle = "#727272"; // YOLO letterbox gray
  ctx.fillRect(0, 0, MODEL_SIZE, MODEL_SIZE);
  ctx.drawImage(image, padX, padY, nw, nh);

  const { data: pixels } = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
  const size = MODEL_SIZE * MODEL_SIZE;
  const data = new Float32Array(3 * size);
  for (let i = 0; i < size; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    data[i] = (r ?? 0) / 255;
    data[size + i] = (g ?? 0) / 255;
    data[2 * size + i] = (b ?? 0) / 255;
  }

  return {
    data,
    letterbox: { scale, padX, padY, originalWidth: ow, originalHeight: oh },
  };
}

/**
 * OPSEC re-compression (§2.7.6): redraw through a canvas and re-encode as
 * JPEG. Canvas re-encoding produces a brand new bitstream — every EXIF
 * field, including embedded GPS coordinates, is destroyed.
 */
export async function recompressForUpload(
  image: HTMLImageElement,
  maxDim = 1280,
): Promise<Blob> {
  const scale = Math.min(1, maxDim / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))),
      "image/jpeg",
      0.85,
    );
  });
}

/** Real file type check via magic bytes — the extension is never trusted. */
export async function sniffImageType(
  file: File,
): Promise<"jpeg" | "png" | "webp" | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47
  )
    return "png";
  if (
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  )
    return "webp";
  return null;
}
