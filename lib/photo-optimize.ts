import { dHashFromGray } from "./listing-risk";
// Browser-side photo preparation before upload: resize, re-encode and watermark.
// Re-encoding also drops EXIF metadata such as GPS coordinates.
export const MAX_PHOTO_EDGE = 2560;
export const WATERMARK_TEXT = "estatemarket24";

export function scaledSize(width: number, height: number, maxEdge = MAX_PHOTO_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// Watermark size and margin follow the shorter edge so it reads the same on any aspect ratio.
export function watermarkLayout(width: number, height: number) {
  const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.035));
  const margin = Math.round(fontSize * 0.9);
  return { fontSize, x: width - margin, y: height - margin };
}

async function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function optimizeListingPhoto(file: File, { watermark = true } = {}): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    if (watermark) {
      const { fontSize, x, y } = watermarkLayout(width, height);
      context.font = `700 ${fontSize}px Arial, sans-serif`;
      context.textAlign = "right";
      context.textBaseline = "bottom";
      context.shadowColor = "rgba(0,0,0,.45)";
      context.shadowBlur = Math.round(fontSize / 4);
      context.fillStyle = "rgba(255,255,255,.72)";
      context.fillText(WATERMARK_TEXT, x, y);
    }
    // Safari before 17 cannot encode WebP and silently returns PNG; fall back to JPEG then.
    let blob = await encode(canvas, "image/webp", 0.84);
    if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", 0.86);
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + (blob.type === "image/webp" ? ".webp" : ".jpg");
    return new File([blob], name, { type: blob.type, lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

// Perceptual fingerprint (dHash, 16 hex digits) of the prepared photo for the duplicate check
// (lib/listing-risk.ts). Computed here because the Workers runtime cannot decode images; the
// admin backfill uses the same function on stored photos, so both sides hash identical bytes.
// Drawn first at 36×32 and averaged in 4×4 blocks so the result does not depend on how a browser
// samples a large downscale. Returns null when the image cannot be decoded.
export async function photoFingerprint(file: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 36;
      canvas.height = 32;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, 36, 32);
      const { data } = context.getImageData(0, 0, 36, 32), gray = new Array<number>(72).fill(0);
      for (let y = 0; y < 32; y++) for (let x = 0; x < 36; x++) {
        const i = (y * 36 + x) * 4;
        gray[(y >> 2) * 9 + (x >> 2)] += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      return dHashFromGray(gray);
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}
