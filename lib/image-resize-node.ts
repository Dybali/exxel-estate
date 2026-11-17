// Node build only (alias in next.config.ts): a WebP copy at most `width` pixels wide, EXIF orientation applied
// and metadata dropped. Used by app/api/media/[...key]/route.ts for photos that have no stored copy yet.
import sharp from "sharp";

export async function resizeToWebp(bytes: Uint8Array, width: number) {
  const out = await sharp(bytes, { failOn: "none" }).rotate().resize({ width, height: width, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength) as Uint8Array<ArrayBuffer>;
}
