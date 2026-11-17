// Storage keys of every file a listing uses: photos, 360° scenes and the floor plan.
export function listingMediaKeys(images: unknown, presentation: unknown) {
  const list = Array.isArray(images) ? images : [];
  const shown = (presentation && typeof presentation === "object" ? presentation : {}) as { panoramas?: { url?: unknown }[]; floorPlan?: unknown };
  const urls = [...list, ...(Array.isArray(shown.panoramas) ? shown.panoramas.map((scene) => scene?.url) : []), shown.floorPlan];
  return [...new Set(urls.filter((url): url is string => typeof url === "string" && url.startsWith("/api/media/listings/")).map((url) => url.slice("/api/media/".length)))];
}

// Removes files a listing no longer uses. Each key belongs to one listing only (property_images.object_key
// is unique), so nothing else can still point at them. Best effort: a failed delete only leaves storage behind.
// The smaller copies of each photo go too; most photos have none, so a missing variant or a failed
// variant delete is not counted.
export async function removeListingMedia(keys: string[], remove: (key: string) => Promise<unknown>) {
  const results = await Promise.allSettled(keys.map((key) => remove(key)));
  await Promise.allSettled(keys.flatMap(photoVariantKeys).map((key) => remove(key)));
  return results.filter((result) => result.status === "rejected").length;
}

// Smaller copies of listing photos. The browser makes them at upload time
// (lib/photo-optimize.ts; Workers cannot decode images) and sends them with the main photo in the same
// request. Each is stored next to the main object under a key derived from it, so the database and the
// listing's `images` array keep main keys only: listings/<uid>/<uuid>.<ext> → listings/<uid>/<uuid>.w640.webp.
export const PHOTO_VARIANT_WIDTHS = [640, 1280] as const;
export type PhotoVariantWidth = (typeof PHOTO_VARIANT_WIDTHS)[number];
// Upload limits per variant; a WebP of this size is far larger than the browser ever produces.
export const PHOTO_VARIANT_MAX_BYTES: Record<PhotoVariantWidth, number> = { 640: 1_000_000, 1280: 3_000_000 };
const MAIN_PHOTO_KEY = /^listings\/([a-f0-9-]+)\/([a-f0-9-]+)\.(jpg|png|webp)$/;
export const PHOTO_VARIANT_KEY = /^listings\/[a-f0-9-]+\/[a-f0-9-]+\.w(640|1280)\.webp$/;

export function photoVariantWidth(value: unknown): PhotoVariantWidth | null {
  const width = typeof value === "string" && /^\d{3,4}$/.test(value) ? Number(value) : typeof value === "number" ? value : NaN;
  return (PHOTO_VARIANT_WIDTHS as readonly number[]).includes(width) ? (width as PhotoVariantWidth) : null;
}

// Storage key of a variant, or null when the key is not a main listing photo key.
export function photoVariantKey(mainKey: string, width: number) {
  const match = MAIN_PHOTO_KEY.exec(mainKey), size = photoVariantWidth(width);
  return match && size ? `listings/${match[1]}/${match[2]}.w${size}.webp` : null;
}

export const photoVariantKeys = (mainKey: string) => PHOTO_VARIANT_WIDTHS.map((width) => photoVariantKey(mainKey, width)).filter((key): key is string => key !== null);

// Where an upload may store a variant: only next to a main key inside the uploader's own folder.
// The route generates the main key itself; this guard keeps a variant from ever landing on another member's photo.
export function variantUploadKey(mainKey: string, userId: string, width: number) {
  const match = MAIN_PHOTO_KEY.exec(mainKey);
  return match && match[1] === userId ? photoVariantKey(mainKey, width) : null;
}

// Pixel size of a WebP (VP8, VP8L or VP8X), or null when the header does not parse.
export function webpDimensions(bytes: Uint8Array) {
  if (bytes.length < 30) return null;
  const text = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (text(0, 4) !== "RIFF" || text(8, 4) !== "WEBP") return null;
  const chunk = text(12, 4), at = 20;
  if (chunk === "VP8X") return { width: 1 + (bytes[at + 4] | (bytes[at + 5] << 8) | (bytes[at + 6] << 16)), height: 1 + (bytes[at + 7] | (bytes[at + 8] << 8) | (bytes[at + 9] << 16)) };
  if (chunk === "VP8 ") {
    if (bytes[at + 3] !== 0x9d || bytes[at + 4] !== 0x01 || bytes[at + 5] !== 0x2a) return null;
    return { width: (bytes[at + 6] | (bytes[at + 7] << 8)) & 0x3fff, height: (bytes[at + 8] | (bytes[at + 9] << 8)) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (bytes[at] !== 0x2f) return null;
    const bits = bytes[at + 1] | (bytes[at + 2] << 8) | (bytes[at + 3] << 16) | (bytes[at + 4] << 24);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
  }
  return null;
}

// A variant must be a real WebP no larger than its slot: limited bytes, valid signature and header, and a
// long edge within the declared width. Returns false for anything else so the route refuses the upload.
export function validPhotoVariant(bytes: Uint8Array, type: string, width: PhotoVariantWidth) {
  if (type !== "image/webp" || bytes.length === 0 || bytes.length > PHOTO_VARIANT_MAX_BYTES[width]) return false;
  const size = webpDimensions(bytes);
  return Boolean(size && size.width > 0 && size.height > 0 && Math.max(size.width, size.height) <= width);
}

// Image addresses for pages. Only our own main listing photos have variants; anything else (outside URLs,
// demo images) is returned unchanged. The media route answers ?w= with the original when no variant was
// stored, which is the case for every photo uploaded before variants existed; on Mittwald it now makes the
// copy instead (lib/image-resize-node.ts). &c=2 gives the copies a new address, because browsers had cached
// those full-size originals under the old ?w= address for a year (2026-11-17).
const COPY_VERSION = "2";
const MAIN_PHOTO_URL = /^\/api\/media\/listings\/[a-f0-9-]+\/[a-f0-9-]+\.(jpg|png|webp)$/;
export const photoVariantUrl = (url: string, width: PhotoVariantWidth) => (MAIN_PHOTO_URL.test(url) ? `${url}?w=${width}&c=${COPY_VERSION}` : url);

// srcset with the variants and the original (stored at up to 2560px) as the large candidate.
export function photoSrcSet(url: string, widths: readonly PhotoVariantWidth[] = PHOTO_VARIANT_WIDTHS) {
  if (!MAIN_PHOTO_URL.test(url)) return undefined;
  return [...widths.map((width) => `${url}?w=${width}&c=${COPY_VERSION} ${width}w`), `${url} 2560w`].join(", ");
}
