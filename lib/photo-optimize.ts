import { dHashFromGray } from "./listing-risk";
import { centerMarkLayout, WATERMARK_TEXT, watermarkLayout } from "./photo-watermark-svg";
export { WATERMARK_TEXT, watermarkLayout };
// Browser-side photo preparation before upload: resize, re-encode and watermark.
// Re-encoding also drops EXIF metadata such as GPS coordinates.
export const MAX_PHOTO_EDGE = 2560;

export function scaledSize(width: number, height: number, maxEdge = MAX_PHOTO_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}


async function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

// Smaller copies for cards and galleries (lib/listing-media.ts). Only made when the photo is clearly larger
// than the copy (a quarter over its width), so a small photo is not stored twice at nearly the same size.
export const VARIANT_WIDTHS = [640, 1280] as const;
export function variantWidthsFor(width: number, height: number) {
  const edge = Math.max(width, height);
  return VARIANT_WIDTHS.filter((size) => edge > size * 1.25);
}

function render(bitmap: ImageBitmap, maxEdge: number, watermark: boolean) {
  const { width, height } = scaledSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  // Every copy carries the watermark, laid out for its own size.
  if (watermark) {
    // Large, faint diagonal mark across the centre: cannot be cropped away (lib/photo-watermark-svg.ts).
    const center = centerMarkLayout(width, height);
    context.save();
    context.translate(center.x, center.y);
    context.rotate(center.angle * Math.PI / 180);
    context.font = `700 ${center.fontSize}px Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = Math.max(1, Math.round(center.fontSize / 40));
    context.strokeStyle = `rgba(0,0,0,${center.opacity / 2})`;
    context.strokeText(WATERMARK_TEXT, 0, 0);
    context.fillStyle = `rgba(255,255,255,${center.opacity})`;
    context.fillText(WATERMARK_TEXT, 0, 0);
    context.restore();
    const { fontSize, x, y } = watermarkLayout(width, height);
    context.font = `700 ${fontSize}px Arial, sans-serif`;
    context.textAlign = "right";
    context.textBaseline = "bottom";
    context.shadowColor = "rgba(0,0,0,.45)";
    context.shadowBlur = Math.round(fontSize / 4);
    context.fillStyle = "rgba(255,255,255,.72)";
    context.fillText(WATERMARK_TEXT, x, y);
  }
  return canvas;
}

export type PhotoVariant = { width: (typeof VARIANT_WIDTHS)[number]; file: Blob };
export type PreparedPhoto = { file: File; variants: PhotoVariant[] };
// Kept below the server limits (PHOTO_VARIANT_MAX_BYTES in lib/listing-media.ts); a larger copy is left out.
const VARIANT_MAX_BYTES: Record<PhotoVariant["width"], number> = { 640: 1_000_000, 1280: 3_000_000 };

export async function prepareListingPhoto(file: File, { watermark = true, variants = true } = {}): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const canvas = render(bitmap, MAX_PHOTO_EDGE, watermark);
    if (!canvas) return { file, variants: [] };
    // Safari before 17 cannot encode WebP and silently returns PNG; fall back to JPEG then.
    let blob = await encode(canvas, "image/webp", 0.84);
    if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", 0.86);
    if (!blob) return { file, variants: [] };
    const name = file.name.replace(/\.[^.]+$/, "") + (blob.type === "image/webp" ? ".webp" : ".jpg");
    const main = new File([blob], name, { type: blob.type, lastModified: file.lastModified });
    const copies: PhotoVariant[] = [];
    // Copies are WebP only: a browser that cannot encode WebP uploads the main photo alone, and pages
    // then load the main photo (the media route falls back to it).
    if (variants && blob.type === "image/webp") {
      for (const width of variantWidthsFor(canvas.width, canvas.height)) {
        const small = render(bitmap, width, watermark);
        const copy = small && await encode(small, "image/webp", 0.8);
        if (copy && copy.type === "image/webp" && copy.size <= VARIANT_MAX_BYTES[width]) copies.push({ width, file: copy });
      }
    }
    return { file: main, variants: copies };
  } finally {
    bitmap.close();
  }
}

export async function optimizeListingPhoto(file: File, { watermark = true } = {}): Promise<File> {
  return (await prepareListingPhoto(file, { watermark, variants: false })).file;
}

// Never fails: when the photo cannot be decoded in the browser the original is uploaded alone.
// The Mittwald server watermarks listing photos itself (GET /api/media → serverWatermark); then the browser sends
// the photo unmarked so it is not marked twice, and the server makes the copies.
let serverMarks: Promise<boolean> | null = null;
export function serverWatermarks() {
  serverMarks ??= fetch("/api/media", { cache: "no-store" }).then((r) => r.ok ? r.json() as Promise<{ serverWatermark?: boolean }> : {}).then((d) => Boolean((d as { serverWatermark?: boolean }).serverWatermark)).catch(() => false);
  return serverMarks;
}
export async function preparePhotoUpload(file: File, options: { watermark?: boolean; variants?: boolean } = {}): Promise<PreparedPhoto> {
  const wanted = options.watermark !== false;
  const server = wanted && await serverWatermarks();
  return prepareListingPhoto(file, { ...options, watermark: wanted && !server, variants: server ? false : options.variants }).catch(() => ({ file, variants: [] }));
}

// Adds the copies to the upload form next to "file" (fields variant640 / variant1280, app/api/media/route.ts).
export function appendPhotoVariants(form: FormData, variants: PhotoVariant[]) {
  for (const variant of variants) form.append(`variant${variant.width}`, variant.file, `w${variant.width}.webp`);
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
