// Server-side watermark for the Node build (Mittwald container). Only reached through the "@/lib/photo-watermark"
// alias in next.config.ts; the Cloudflare build sees lib/photo-watermark.ts. The browser sends the photo without a
// watermark when the server says it adds one (GET /api/media); the server resizes it (longest edge 2560), draws
// both marks (lib/photo-watermark-svg.ts) and makes the WebP copies itself, so every stored copy carries the mark.
import sharp from "sharp";
import { watermarkSvg } from "./photo-watermark-svg";
import type { WatermarkedPhoto } from "./photo-watermark";

const MAX_EDGE = 2560;
async function marked(input: Uint8Array, maxEdge: number) {
  const base = sharp(input, { failOn: "none" }).rotate().resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true });
  const { data, info } = await base.toBuffer({ resolveWithObject: true });
  return sharp(data).composite([{ input: Buffer.from(watermarkSvg(info.width, info.height)), top: 0, left: 0 }]);
}
const bytesOf = (buffer: Buffer) => new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) as Uint8Array<ArrayBuffer>;

export async function serverWatermark(bytes: Uint8Array, type: string, variantWidths: readonly number[]): Promise<WatermarkedPhoto> {
  const { width = 0, height = 0 } = await sharp(bytes, { failOn: "none" }).metadata();
  const edge = Math.max(width, height);
  const main = await marked(bytes, MAX_EDGE);
  // Same format as uploaded (EXIF is not kept: sharp drops metadata unless asked).
  // PNG listing photos are stored as JPEG: a lossless 2560px PNG photo was several MB (live-site sweep 2026-11-24).
  const outType = type === "image/webp" ? "image/webp" : "image/jpeg";
  const out = outType === "image/webp" ? await main.webp({ quality: 80 }).toBuffer() : await main.flatten({ background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const variants = [];
  for (const target of variantWidths) if (edge > target * 1.25) variants.push({ width: target, bytes: bytesOf(await (await marked(bytes, target)).webp({ quality: 82 }).toBuffer()) });
  return { bytes: bytesOf(out), type: outType, variants };
}
