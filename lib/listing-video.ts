// Listing videos hosted by the site itself (docs/listing-videos.md): shared by the browser form and
// the server. The browser uploads the file in chunks to /api/media/video; each chunk becomes one
// part of an R2 multipart upload. ffmpeg on the Mittwald container then makes an MP4 and a poster.
export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 180;
// 16 MiB: above S3's 5 MiB minimum part size, small enough to retry cheaply after a network error.
export const VIDEO_CHUNK_BYTES = 16 * 1024 * 1024;
export const VIDEO_STATUSES = ["uploading", "queued", "processing", "ready", "failed"] as const;
export type VideoStatus = typeof VIDEO_STATUSES[number];

export const validVideoId = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);

// Public objects in the listing photo bucket, served through /api/media/<key>.
export const videoFileKey = (id: string) => `videos/${id}/video.mp4`;
export const videoPosterKey = (id: string) => `videos/${id}/poster.jpg`;
export const VIDEO_MEDIA_KEY = /^videos\/([a-f0-9-]{36})\/(video\.mp4|poster\.jpg)$/;
export const videoFileUrl = (id: string) => `/api/media/${videoFileKey(id)}`;
export const videoPosterUrl = (id: string) => `/api/media/${videoPosterKey(id)}`;

export const videoPartCount = (size: number) => Math.max(1, Math.ceil(size / VIDEO_CHUNK_BYTES));
// Exact byte length of a part: every part is VIDEO_CHUNK_BYTES except the last one.
export function videoPartLength(size: number, part: number) {
  const count = videoPartCount(size);
  if (!Number.isSafeInteger(part) || part < 1 || part > count) return 0;
  return part < count ? VIDEO_CHUNK_BYTES : size - (count - 1) * VIDEO_CHUNK_BYTES;
}

// Container formats accepted for upload, recognised by their first bytes (the browser's file type
// is only a hint). ffprobe checks the actual streams afterwards.
export function sniffVideo(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  // ISO base media (MP4, MOV, M4V, 3GP): a box size and then a box type.
  if (["ftyp", "moov", "mdat", "wide", "free", "skip", "pnot"].includes(ascii(4, 8))) return ascii(4, 8) === "ftyp" && ascii(8, 10) === "qt" ? "video/quicktime" : "video/mp4";
  // Matroska and WebM: EBML header.
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video/webm";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "AVI ") return "video/x-msvideo";
  return null;
}

// Reads the first bytes of an upload stream (for sniffVideo) and returns a stream that still yields
// every byte, so the body is forwarded to storage without being buffered.
export async function peekStream(stream: ReadableStream<Uint8Array>, count: number) {
  const reader = stream.getReader(), chunks: Uint8Array[] = [];
  let have = 0;
  while (have < count) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    have += value.length;
  }
  const head = new Uint8Array(have);
  chunks.reduce((offset, chunk) => { head.set(chunk, offset); return offset + chunk.length; }, 0);
  const rest = new ReadableStream<Uint8Array>({
    start(controller) { if (head.length) controller.enqueue(head); },
    async pull(controller) { const { done, value } = await reader.read(); if (done) controller.close(); else controller.enqueue(value); },
    cancel(reason) { return reader.cancel(reason); },
  });
  return { head: head.slice(0, count), stream: rest };
}

// Passes the stream through and fails it unless it carries exactly `expected` bytes; `state.wrong`
// tells the caller the upload failed because of the body, not because of storage.
export function exactLength(stream: ReadableStream<Uint8Array>, expected: number, state: { wrong: boolean }) {
  let seen = 0;
  return stream.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.length;
      if (seen > expected) { state.wrong = true; controller.error(new Error("body too long")); return; }
      controller.enqueue(chunk);
    },
    flush(controller) { if (seen !== expected) { state.wrong = true; controller.error(new Error("body too short")); } },
  }));
}
