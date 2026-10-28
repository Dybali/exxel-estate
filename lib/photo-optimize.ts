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
