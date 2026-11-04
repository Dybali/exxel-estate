import { postgresDriver } from "@/lib/postgres-driver";
import { env } from "./runtime";
import { databaseDriver } from "./pg-d1";
import { deleteVideoRow, staleVideos, type VideoDatabase, type VideoRow, videoById } from "./listing-video-store";
import { videoStorage, type VideoStorage, type VideoStorageSettings } from "./video-storage";
import { videoWorkerState } from "./video-worker-state";

// Server glue for listing videos (docs/listing-videos.md). Videos exist only in the Node build for
// the Mittwald container with its own PostgreSQL (the listing_videos table comes from
// postgres/migrations/019). On Cloudflare the TCP driver slot is null, so everything here reports
// "not available" and never touches the table.
type Settings = VideoStorageSettings & { DATABASE_URL?: string; DATABASE_DRIVER?: string };

export function videoFeatureEnabled(settings: Settings = env as Settings) {
  return Boolean(postgresDriver && settings.DATABASE_URL && databaseDriver(settings.DATABASE_URL, settings.DATABASE_DRIVER, true) === "postgres");
}
export function videoStorageFromEnv(settings: Settings = env as Settings): VideoStorage | null {
  try { return videoStorage(settings); } catch { return null; }
}
// Uploads are accepted only when the worker is running in this process (ffmpeg found, not disabled).
export function videoUploadsReady(settings: Settings = env as Settings) {
  return videoFeatureEnabled(settings) && videoWorkerState().running && Boolean(videoStorageFromEnv(settings));
}

// Deletes every stored file of a video, then its row. If storage fails the row is detached from its
// listing and kept, so the daily cleanup tries again.
export async function removeVideo(db: VideoDatabase, video: VideoRow, storage: VideoStorage | null) {
  try {
    if (!storage) throw new Error("Video storage is not configured");
    if (video.status === "uploading" && video.upload_id) await storage.abortUpload(video.raw_key, video.upload_id);
    await storage.deleteRaw(video.raw_key);
    for (const key of [video.mp4_key, video.poster_key]) if (key) await storage.deleteMedia(key);
    await deleteVideoRow(db, video.id);
    return true;
  } catch (cause) {
    console.error("[video] delete failed", video.id, String((cause as Error)?.message || cause));
    await db.prepare("UPDATE listing_videos SET listing_id=NULL WHERE id=?").bind(video.id).run().catch(() => {});
    return false;
  }
}

export async function removeVideoById(db: VideoDatabase, id: string, storage = videoStorageFromEnv()) {
  if (!id) return false;
  const video = await videoById(db, id);
  return video ? removeVideo(db, video, storage) : true;
}

// Takes a removed video out of a listing's presentation (failed videos found by the cleanup).
// Compare-and-set on the stored JSON, so a concurrent edit by the owner is never overwritten.
async function detachFromListing(db: VideoDatabase, listingId: string, videoId: string) {
  const listing = await db.prepare("SELECT presentation FROM listings WHERE id=?").bind(listingId).first<{ presentation: string | null }>();
  if (!listing?.presentation) return;
  const shown = JSON.parse(String(listing.presentation)) as Record<string, unknown>;
  if (shown.videoId !== videoId) return;
  delete shown.videoId;
  await db.prepare("UPDATE listings SET presentation=? WHERE id=? AND presentation=?").bind(JSON.stringify(shown), listingId, listing.presentation).run();
}

// Daily job: removes uploads never attached to a listing and failed jobs (both older than 2 days).
export async function cleanupVideos(db: VideoDatabase, storage: VideoStorage | null, at = new Date()) {
  let removed = 0, failed = 0;
  for (const video of await staleVideos(db, at)) {
    if (video.listing_id) await detachFromListing(db, video.listing_id, video.id).catch(() => {});
    if (await removeVideo(db, video, storage)) removed++; else failed++;
  }
  return { removed, failed };
}
