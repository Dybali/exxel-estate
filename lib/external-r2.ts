import { env } from "./runtime";
import { AwsClient } from "aws4fetch";

type R2Settings = Cloudflare.Env & {
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
  if (!/^listings\/[a-f0-9-]+\/[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) throw new Error("Invalid R2 object key");
  return `${endpoint}/${key}`;
}

export function externalR2Ready() { return config() !== null; }
export function externalR2BucketName() { return config()?.bucket || null; }

export async function putExternalImage(key: string, bytes: Uint8Array, contentType: string, checksum: string) {
  const storage = config();
  if (!storage) throw new Error("External R2 is not configured");
  const response = await storage.client.fetch(objectUrl(storage.endpoint, key), {
    method: "PUT", headers: { "Content-Type": contentType, "x-amz-meta-sha256": checksum }, body: bytes as unknown as BodyInit,
  });
  if (!response.ok) throw new Error(`R2 upload failed (${response.status})`);
}

export async function headExternalImage(key: string) {
  const storage = config();
  if (!storage) return null;
  const response = await storage.client.fetch(objectUrl(storage.endpoint, key), { method: "HEAD" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`R2 metadata failed (${response.status})`);
  return { contentType: response.headers.get("content-type") || "image/jpeg", size: Number(response.headers.get("content-length") || 0), checksum: response.headers.get("x-amz-meta-sha256") };
}

export async function deleteExternalImage(key: string) {
  const storage = config();
  if (!storage) return;
  const response = await storage.client.fetch(objectUrl(storage.endpoint, key), { method: "DELETE" });
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
