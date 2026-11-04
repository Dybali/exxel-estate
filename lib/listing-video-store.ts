import type { VideoStatus } from "./listing-video";

// listing_videos rows (postgres/migrations/019_listing_videos.sql, drizzle/0026_listing_videos.sql).
// Plain SQL that runs unchanged on PostgreSQL (lib/pg-d1.ts) and SQLite (tests). No storage or
// driver imports: callers pass the database.
type Statement = {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};
export type VideoDatabase = { prepare(sql: string): Statement };

export type VideoRow = {
  id: string; owner_id: string; listing_id: string | null; status: VideoStatus; upload_id: string | null;
  raw_key: string; mp4_key: string | null; poster_key: string | null; content_type: string; size_bytes: number;
  duration_seconds: number | null; width: number | null; height: number | null; error: string | null;
  attempts: number; locked_until: string | null; created_at: string; updated_at: string;
};

// A job holds its lock this long; a container that died mid-job releases it when the time is up.
export const VIDEO_LOCK_MS = 30 * 60_000;
export const VIDEO_MAX_ATTEMPTS = 3;
// After a temporary failure (storage, network) the job waits this long before the next try.
export const VIDEO_RETRY_DELAY_MS = 5 * 60_000;
// Uploads not attached to a listing, and failed ones, are removed by the daily job after this.
export const VIDEO_UNATTACHED_MS = 2 * 86400_000;
// Unattached uploads one member may keep at a time (abandoned forms, retries).
export const VIDEO_OPEN_UPLOADS = 5;

const iso = (at: Date | number) => new Date(at).toISOString();
// postgres.js returns bigint/numeric columns as strings.
const row = (value: Record<string, unknown> | null) => value ? {
  ...value, id: String(value.id), owner_id: String(value.owner_id), listing_id: value.listing_id == null ? null : String(value.listing_id),
  size_bytes: Number(value.size_bytes), attempts: Number(value.attempts),
  duration_seconds: value.duration_seconds == null ? null : Number(value.duration_seconds),
  width: value.width == null ? null : Number(value.width), height: value.height == null ? null : Number(value.height),
} as VideoRow : null;

export async function createVideoRow(db: VideoDatabase, input: { id: string; ownerId: string; uploadId: string; rawKey: string; contentType: string; size: number }, at = new Date()) {
  await db.prepare("INSERT INTO listing_videos(id,owner_id,listing_id,status,upload_id,raw_key,content_type,size_bytes,attempts,created_at,updated_at) VALUES(?,?,NULL,'uploading',?,?,?,?,0,?,?)")
    .bind(input.id, input.ownerId, input.uploadId, input.rawKey, input.contentType, input.size, iso(at), iso(at)).run();
}

export async function videoById(db: VideoDatabase, id: string) {
  return row(await db.prepare("SELECT * FROM listing_videos WHERE id=?").bind(id).first());
}

export async function openUploadCount(db: VideoDatabase, ownerId: string) {
  const found = await db.prepare("SELECT COUNT(*) AS n FROM listing_videos WHERE owner_id=? AND listing_id IS NULL").bind(ownerId).first<{ n: unknown }>();
  return Number(found?.n || 0);
}

// The browser finished all parts and R2 assembled the file: the worker may take it.
export async function markVideoQueued(db: VideoDatabase, id: string, at = new Date()) {
  return Boolean(await db.prepare("UPDATE listing_videos SET status='queued',upload_id=NULL,locked_until=NULL,updated_at=? WHERE id=? AND status='uploading' RETURNING id").bind(iso(at), id).first());
}

// Takes the oldest waiting job, or one whose worker died (lock expired). One UPDATE, so two workers
// can never get the same row: in PostgreSQL the second UPDATE re-checks the condition after the first
// commits and matches nothing. Jobs that ran out of attempts are failed first.
export async function claimVideoJob(db: VideoDatabase, at = new Date()) {
  const now = iso(at);
  await db.prepare("UPDATE listing_videos SET status='failed',error=?,locked_until=NULL,updated_at=? WHERE status='processing' AND locked_until<? AND attempts>=?")
    .bind("Video işlenemedi. Başka bir video yükleyin.", now, now, VIDEO_MAX_ATTEMPTS).run();
  const ready = "((status='queued' AND (locked_until IS NULL OR locked_until<?)) OR (status='processing' AND locked_until<? AND attempts<?))";
  return row(await db.prepare(`UPDATE listing_videos SET status='processing',attempts=attempts+1,locked_until=?,updated_at=? WHERE id=(SELECT id FROM listing_videos WHERE ${ready} ORDER BY created_at LIMIT 1) AND ${ready} RETURNING *`)
    .bind(iso(at.getTime() + VIDEO_LOCK_MS), now, now, now, VIDEO_MAX_ATTEMPTS, now, now, VIDEO_MAX_ATTEMPTS).first());
}

export async function finishVideoJob(db: VideoDatabase, id: string, result: { mp4Key: string; posterKey: string; duration: number; width: number; height: number }, at = new Date()) {
  return Boolean(await db.prepare("UPDATE listing_videos SET status='ready',mp4_key=?,poster_key=?,duration_seconds=?,width=?,height=?,error=NULL,locked_until=NULL,updated_at=? WHERE id=? AND status='processing' RETURNING id")
    .bind(result.mp4Key, result.posterKey, result.duration, result.width, result.height, iso(at), id).first());
}

// Permanent failure: the message is shown to the member as it is (translated in the browser).
export async function failVideoJob(db: VideoDatabase, id: string, message: string, at = new Date()) {
  await db.prepare("UPDATE listing_videos SET status='failed',error=?,locked_until=NULL,updated_at=? WHERE id=?").bind(message.slice(0, 300), iso(at), id).run();
}

// Temporary failure: back to the queue, tried again after a delay (attempts already counted).
export async function retryVideoJob(db: VideoDatabase, id: string, at = new Date()) {
  await db.prepare("UPDATE listing_videos SET status='queued',locked_until=?,updated_at=? WHERE id=? AND status='processing'").bind(iso(at.getTime() + VIDEO_RETRY_DELAY_MS), iso(at), id).run();
}

// Problem text for saving a listing with this video, or null when it may be attached.
export async function videoAttachProblem(db: VideoDatabase, videoId: string, ownerId: string, listingId: string | null) {
  const video = await videoById(db, videoId);
  if (!video || video.owner_id !== ownerId || video.listing_id && video.listing_id !== listingId) return "Video bulunamadı. Videoyu yeniden yükleyin.";
  if (video.status === "uploading") return "Video yüklemesi tamamlanmadı. Yükleme bitince tekrar kaydedin.";
  if (video.status === "failed") return "Video işlenemedi. Başka bir video yükleyin.";
  return null;
}

// Part of the listing save batch; matches nothing if the listing row was not written.
export function attachVideoStatement<T extends Statement>(db: { prepare(sql: string): T }, videoId: string, ownerId: string, listingId: string) {
  return db.prepare("UPDATE listing_videos SET listing_id=? WHERE id=? AND owner_id=? AND (listing_id IS NULL OR listing_id=?) AND EXISTS(SELECT 1 FROM listings WHERE id=?)")
    .bind(listingId, videoId, ownerId, listingId, listingId) as T;
}

// The ready video of a listing for the listing page, or null.
export async function readyListingVideo(db: VideoDatabase, videoId: string, listingId: string) {
  const found = row(await db.prepare("SELECT * FROM listing_videos WHERE id=? AND listing_id=? AND status='ready'").bind(videoId, listingId).first());
  return found ? { id: found.id, width: found.width || 0, height: found.height || 0, duration: found.duration_seconds || 0 } : null;
}

// Media access: who may load the MP4/poster of a video.
export async function videoMediaAccess(db: VideoDatabase, videoId: string) {
  return await db.prepare("SELECT v.owner_id,v.status,l.status AS listing_status FROM listing_videos v LEFT JOIN listings l ON l.id=v.listing_id WHERE v.id=?")
    .bind(videoId).first<{ owner_id: unknown; status: string; listing_status: string | null }>();
}

export async function deleteVideoRow(db: VideoDatabase, id: string) {
  await db.prepare("DELETE FROM listing_videos WHERE id=?").bind(id).run();
}

// Daily cleanup: uploads never attached to a listing and failed jobs, both older than 2 days.
export async function staleVideos(db: VideoDatabase, at = new Date(), limit = 200) {
  const cutoff = iso(at.getTime() - VIDEO_UNATTACHED_MS);
  const found = await db.prepare("SELECT * FROM listing_videos WHERE (listing_id IS NULL AND created_at<?) OR (status='failed' AND updated_at<?) ORDER BY created_at LIMIT ?").bind(cutoff, cutoff, limit).all();
  return found.results.map((item) => row(item)!);
}
