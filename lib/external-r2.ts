import { env } from "./runtime";
import { AwsClient } from "aws4fetch";

type R2Settings = {
  R2_ENDPOINT?: string;
  R2_BUCKET_NAME?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
};

function config() {
  const settings = env as R2Settings;
  const { R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = settings;
  if (!R2_ENDPOINT || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
  if (!/^https:\/\/[a-f0-9]+\.eu\.r2\.cloudflarestorage\.com$/.test(R2_ENDPOINT) || !/^[a-z0-9-]+$/.test(R2_BUCKET_NAME)) throw new Error("R2 EU configuration is invalid");
  return { endpoint: `${R2_ENDPOINT}/${R2_BUCKET_NAME}`, bucket: R2_BUCKET_NAME,
    client: new AwsClient({ service: "s3", region: "auto", accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }) };
}

function objectUrl(endpoint: string, key: string) {
  // Main photos and their smaller WebP copies (lib/listing-media.ts photoVariantKey).
  if (!/^listings\/[a-f0-9-]+\/[a-f0-9-]+(\.(jpg|png|webp)|\.w(640|1280)\.webp)$/.test(key)) throw new Error("Invalid R2 object key");
  return `${endpoint}/${key}`;
}

export function externalR2Ready() { return config() !== null; }
export function externalR2BucketName() { return config()?.bucket || null; }

// photoHash: the dHash computed in the uploader's browser (lib/listing-risk.ts); kept as object metadata
// so the listing routes read it with the HEAD request they already make.
// A stalled storage request must not hold a request (or the hourly health job) for minutes. Downloads
// stream to the visitor and are left without a limit.
const R2_TIMEOUT_MS = 20_000;
export async function putExternalImage(key: string, bytes: Uint8Array, contentType: string, checksum: string, photoHash?: string | null) {
  const storage = config();
  if (!storage) throw new Error("External R2 is not configured");
  const response = await storage.client.fetch(objectUrl(storage.endpoint, key), {
    method: "PUT", headers: { "Content-Type": contentType, "x-amz-meta-sha256": checksum, ...(photoHash ? { "x-amz-meta-phash": photoHash } : {}) }, body: bytes as unknown as BodyInit, signal: AbortSignal.timeout(R2_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`R2 upload failed (${response.status})`);
}

export async function headExternalImage(key: string) {
  const storage = config();
  if (!storage) return null;
  const response = await storage.client.fetch(objectUrl(storage.endpoint, key), { method: "HEAD", signal: AbortSignal.timeout(R2_TIMEOUT_MS) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`R2 metadata failed (${response.status})`);
  return { contentType: response.headers.get("content-type") || "image/jpeg", size: Number(response.headers.get("content-length") || 0), checksum: response.headers.get("x-amz-meta-sha256"), photoHash: response.headers.get("x-amz-meta-phash") };
}

export async function deleteExternalImage(key: string) {
  const storage = config();
  if (!storage) return;
  const response = await storage.client.fetch(objectUrl(storage.endpoint, key), { method: "DELETE", signal: AbortSignal.timeout(R2_TIMEOUT_MS) });
  if (!response.ok && response.status !== 404) throw new Error(`R2 delete failed (${response.status})`);
}

export async function getExternalImage(key: string) {
  const storage = config();
  if (!storage) return null;
  const response = await storage.client.fetch(objectUrl(storage.endpoint, key));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`R2 download failed (${response.status})`);
  return { body: response.body, contentType: response.headers.get("content-type") || "image/jpeg" };
}
