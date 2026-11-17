// Image resize slot. This file is what the Cloudflare (vinext) build sees: no image library, so photos
// uploaded before the small copies existed are sent at full size there. The Node build for the Mittwald
// container aliases "@/lib/image-resize" to lib/image-resize-node.ts (next.config.ts), where the media route
// makes the missing 640/1280 px WebP copy on first request and stores it, so cards stop loading multi-MB originals.
export const resizeToWebp: ((bytes: Uint8Array, width: number) => Promise<Uint8Array<ArrayBuffer>>) | null = null;
