import { env } from "cloudflare:workers";
import { MAX_VIDEO_SECONDS, tusMetadata, validStreamUid } from "./stream-video";

// Cloudflare Stream API. Needs the CLOUDFLARE_ACCOUNT_ID var and the STREAM_API_TOKEN secret
// (token permission: Stream Edit). See docs/listing-videos.md.
type StreamEnv = { CLOUDFLARE_ACCOUNT_ID?: string; STREAM_API_TOKEN?: string };
export class StreamError extends Error {}

function config() {
  const { CLOUDFLARE_ACCOUNT_ID: account, STREAM_API_TOKEN: token } = env as StreamEnv;
  return account && token && /^[a-f0-9]{32}$/.test(account) ? { base: `https://api.cloudflare.com/client/v4/accounts/${account}/stream`, token } : null;
}
export const streamReady = () => Boolean(config());

async function call(path: string, init: RequestInit = {}) {
  const settings = config();
  if (!settings) throw new StreamError("not_configured");
  return fetch(settings.base + path, { ...init, headers: { Authorization: `Bearer ${settings.token}`, ...init.headers } });
}

// One-time resumable (tus) upload URL the browser sends the file to directly; the uploader
// is recorded as the video's creator so only they can attach it to a listing.
export async function createVideoUpload(creator: string, size: number) {
  const response = await call("?direct_user=true", { method: "POST", headers: {
    "Tus-Resumable": "1.0.0", "Upload-Length": String(size), "Upload-Creator": creator,
    "Upload-Metadata": tusMetadata({ maxDurationSeconds: String(MAX_VIDEO_SECONDS), expiry: new Date(Date.now() + 6 * 3600_000).toISOString() }),
  } });
  const uploadUrl = response.headers.get("Location"), uid = response.headers.get("stream-media-id");
  if (!response.ok || !uploadUrl?.startsWith("https://") || !validStreamUid(uid)) throw new StreamError("upload_failed");
  return { uid, uploadUrl };
}

export async function streamVideoInfo(uid: string) {
  const response = await call(`/${uid}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new StreamError("lookup_failed");
  const { result } = await response.json() as { result: { creator?: string; readyToStream?: boolean; duration?: number; status?: { state?: string; errorReasonText?: string } } };
  return { creator: result.creator || "", ready: Boolean(result.readyToStream), state: result.status?.state || "", error: result.status?.errorReasonText || "", duration: result.duration || 0 };
}

// Uploads not attached to a listing are removed after 31 days (Stream needs at least 30).
export async function scheduleVideoDeletion(uid: string, at: Date | null) {
  const response = await call(`/${uid}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduledDeletion: at ? at.toISOString() : null }) });
  if (!response.ok) throw new StreamError("update_failed");
}
export const unattachedDeletionDate = () => new Date(Date.now() + 31 * 86400_000);

export async function deleteStreamVideo(uid: string) {
  try { await call(`/${uid}`, { method: "DELETE" }); } catch { /* best effort: an unattached video would only cost storage */ }
}

// Called when a listing is saved with a video: it must be the owner's upload; it then stays.
export async function claimStreamVideo(uid: string, ownerId: string) {
  const video = await streamVideoInfo(uid);
  if (!video || video.creator !== ownerId) return "Video bulunamadı. Videoyu yeniden yükleyin.";
  if (video.state === "error") return "Video işlenemedi. Başka bir video yükleyin.";
  await scheduleVideoDeletion(uid, null);
  return null;
}
