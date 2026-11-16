// Server-side photo watermark slot. This file is what the Cloudflare (vinext) build sees: no image library, so
// the browser draws the watermark (lib/photo-optimize.ts). The Node build for the Mittwald container aliases
// "@/lib/photo-watermark" to lib/photo-watermark-node.ts (next.config.ts), where every listing photo is
// watermarked on the server, so no upload path can skip it.
export type WatermarkedPhoto = { bytes: Uint8Array<ArrayBuffer>; type: string; variants: { width: number; bytes: Uint8Array<ArrayBuffer> }[] };
export const serverWatermark: ((bytes: Uint8Array, type: string, variantWidths: readonly number[]) => Promise<WatermarkedPhoto>) | null = null;
