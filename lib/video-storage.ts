import { AwsClient } from "aws4fetch";
import { VIDEO_MEDIA_KEY } from "./listing-video";

// Listing video files in R2 over the S3 API (same R2_* settings as the photos, lib/external-r2.ts):
// - the raw upload in the private bucket (exxel-estate-private) under video-uploads/<owner>/<id>,
//   written as a multipart upload, one part per browser chunk, so no bucket CORS rule is needed and
//   the server never holds the whole file;
// - the processed MP4 and poster in the photo bucket (exxel-estate-images) under videos/<id>/,
//   served by /api/media/[...key] with HTTP Range support.
export type VideoStorageSettings = {
  R2_ENDPOINT?: string;
  R2_BUCKET_NAME?: string;
  R2_PRIVATE_BUCKET_NAME?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
};
export type UploadedPart = { part: number; etag: string; size: number };

export const RAW_VIDEO_KEY = /^video-uploads\/[A-Za-z0-9_-]{1,64}\/[a-f0-9-]{36}$/;
export const rawVideoKey = (ownerId: string, id: string) => `video-uploads/${ownerId}/${id}`;

const xmlText = (s: string) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const tag = (xml: string, name: string) => { const match = xml.match(new RegExp("<" + name + ">([\\s\\S]*?)</" + name + ">")); return match ? xmlText(match[1]) : null; };
const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export class VideoStorageError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}

export function videoStorage(settings: VideoStorageSettings) {
  const { R2_ENDPOINT: endpoint, R2_BUCKET_NAME: images, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = settings;
  const privateName = settings.R2_PRIVATE_BUCKET_NAME || "exxel-estate-private";
  if (!endpoint || !images || !accessKeyId || !secretAccessKey) return null;
  if (!/^https:\/\/[a-f0-9]+\.eu\.r2\.cloudflarestorage\.com$/.test(endpoint) || !/^[a-z0-9-]+$/.test(images) || !/^[a-z0-9-]+$/.test(privateName)) throw new Error("R2 EU configuration is invalid");
  const client = new AwsClient({ service: "s3", region: "auto", accessKeyId, secretAccessKey, retries: 2 });
  // A streamed body can be sent only once: no automatic retries (the browser retries the chunk).
  const once = new AwsClient({ service: "s3", region: "auto", accessKeyId, secretAccessKey, retries: 0 });
  const raw = (key: string, query = "") => {
    if (!RAW_VIDEO_KEY.test(key)) throw new Error("Invalid video upload key");
    return `${endpoint}/${privateName}/${key}${query}`;
  };
  const media = (key: string) => {
    if (!VIDEO_MEDIA_KEY.test(key)) throw new Error("Invalid video key");
    return `${endpoint}/${images}/${key}`;
  };
  const failed = async (response: Response, what: string) => { await response.body?.cancel().catch(() => {}); return new VideoStorageError(`${what} failed (${response.status})`, response.status); };
  const uploadQuery = (uploadId: string) => `uploadId=${encodeURIComponent(uploadId)}`;

  return {
    async createUpload(key: string, contentType: string) {
      const response = await client.fetch(raw(key, "?uploads"), { method: "POST", headers: { "Content-Type": contentType } });
      if (!response.ok) throw await failed(response, "Video upload start");
      const uploadId = tag(await response.text(), "UploadId");
      if (!uploadId) throw new VideoStorageError("Video upload start returned no upload id");
      return uploadId;
    },
    // Streams one part to R2 with an exact Content-Length; returns the part's ETag.
    async uploadPart(key: string, uploadId: string, part: number, body: ReadableStream<Uint8Array>, length: number) {
      const response = await once.fetch(raw(key, `?partNumber=${part}&${uploadQuery(uploadId)}`), {
        method: "PUT", body, headers: { "Content-Length": String(length) }, duplex: "half",
      } as RequestInit);
      if (!response.ok) throw await failed(response, "Video part upload");
      await response.body?.cancel().catch(() => {});
      return response.headers.get("etag") || "";
    },
    async listParts(key: string, uploadId: string) {
      const parts: UploadedPart[] = [];
      let marker = "";
      for (let page = 0; page < 20; page++) {
        const response = await client.fetch(raw(key, `?${uploadQuery(uploadId)}${marker ? `&part-number-marker=${marker}` : ""}`));
        if (response.status === 404) { await response.body?.cancel().catch(() => {}); return null; }
        if (!response.ok) throw await failed(response, "Video part listing");
        const xml = await response.text();
        for (const match of xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)) parts.push({ part: Number(tag(match[1], "PartNumber")), etag: tag(match[1], "ETag") || "", size: Number(tag(match[1], "Size")) });
        if (tag(xml, "IsTruncated") !== "true") break;
        marker = tag(xml, "NextPartNumberMarker") || "";
        if (!marker) break;
      }
      return parts.sort((a, b) => a.part - b.part);
    },
    async completeUpload(key: string, uploadId: string, parts: UploadedPart[]) {
      const body = `<CompleteMultipartUpload>${parts.map((p) => `<Part><PartNumber>${p.part}</PartNumber><ETag>${escapeXml(p.etag)}</ETag></Part>`).join("")}</CompleteMultipartUpload>`;
      const response = await client.fetch(raw(key, `?${uploadQuery(uploadId)}`), { method: "POST", headers: { "Content-Type": "application/xml" }, body });
      const text = await response.text();
      // S3 can answer 200 and still report an error in the body.
      if (!response.ok || text.includes("<Error>")) throw new VideoStorageError(`Video upload completion failed (${response.status})`, response.status);
    },
    async abortUpload(key: string, uploadId: string) {
      const response = await client.fetch(raw(key, `?${uploadQuery(uploadId)}`), { method: "DELETE" });
      await response.body?.cancel().catch(() => {});
      if (!response.ok && response.status !== 404) throw new VideoStorageError(`Video upload abort failed (${response.status})`, response.status);
    },
    async getRaw(key: string) {
      const response = await client.fetch(raw(key));
      if (!response.ok || !response.body) throw await failed(response, "Video download");
      return response;
    },
    async deleteRaw(key: string) {
      const response = await client.fetch(raw(key), { method: "DELETE" });
      await response.body?.cancel().catch(() => {});
      if (!response.ok && response.status !== 404) throw new VideoStorageError(`Video delete failed (${response.status})`, response.status);
    },
    async putMedia(key: string, body: ReadableStream<Uint8Array>, length: number, contentType: string) {
      const response = await once.fetch(media(key), {
        method: "PUT", body, headers: { "Content-Type": contentType, "Content-Length": String(length) }, duplex: "half",
      } as RequestInit);
      if (!response.ok) throw await failed(response, "Video file upload");
      await response.body?.cancel().catch(() => {});
    },
    // Passes a single "bytes=" range through to R2, which answers 206 with Content-Range.
    async getMedia(key: string, range?: string | null) {
      return client.fetch(media(key), { headers: range ? { Range: range } : {} });
    },
    async deleteMedia(key: string) {
      const response = await client.fetch(media(key), { method: "DELETE" });
      await response.body?.cancel().catch(() => {});
      if (!response.ok && response.status !== 404) throw new VideoStorageError(`Video file delete failed (${response.status})`, response.status);
    },
  };
}
export type VideoStorage = NonNullable<ReturnType<typeof videoStorage>>;
