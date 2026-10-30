// Listing videos hosted on Cloudflare Stream (shared by server and browser code).
export const MAX_VIDEO_BYTES = 2_000_000_000;
export const MAX_VIDEO_SECONDS = 600;
// tus chunks: Stream wants at least 5 MiB and multiples of 256 KiB except for the last one.
export const TUS_CHUNK_BYTES = 50 * 1024 * 1024;

export const validStreamUid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
export const streamEmbed = (uid: string) => `https://iframe.videodelivery.net/${uid}?preload=metadata&poster=${encodeURIComponent(streamThumbnail(uid))}`;
export const streamThumbnail = (uid: string) => `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=2s&height=600`;
export const tusMetadata = (entries: Record<string, string>) => Object.entries(entries).map(([key, value]) => `${key} ${btoa(value)}`).join(",");
