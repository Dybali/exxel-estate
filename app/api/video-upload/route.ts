import { body, currentUser, db, error, isAdmin, ok, sameOrigin, sha256, type User } from "@/lib/server";
import { consumeRecoveryLimit, RecoveryError } from "@/lib/recovery-service";
import { exactLength, MAX_VIDEO_BYTES, peekStream, sniffVideo, validVideoId, VIDEO_CHUNK_BYTES, videoFileUrl, videoPartCount, videoPartLength, videoPosterUrl } from "@/lib/listing-video";
import { createVideoRow, markVideoQueued, openUploadCount, VIDEO_OPEN_UPLOADS, videoById, type VideoDatabase } from "@/lib/listing-video-store";
import { removeVideo, videoFeatureEnabled, videoStorageFromEnv, videoUploadsReady } from "@/lib/listing-video-server";
import { rawVideoKey } from "@/lib/video-storage";
import { wakeVideoWorker } from "@/lib/video-worker-state";

// Listing video upload (docs/listing-videos.md). The browser sends the file in 16 MiB chunks; each
// chunk is streamed straight into one part of an R2 multipart upload in the private bucket.
//   POST   {size,type}            -> {id, chunkSize, parts}    start
//   PUT    ?id=&part=N  (bytes)   -> {part}                    one chunk; repeatable (resume)
//   PATCH  {id, action:"complete"}-> {status:"queued"} or 409 {missing:[...]}
//   GET    ?id=[&parts=1]         -> status for the form (uploaded part numbers while uploading)
//   DELETE ?id=                   -> removes an upload that is not attached to a listing
// proxy.ts skips /api/video-upload so request bodies are never buffered (or cut at 10 MB) by Next.js.
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const unavailable = () => error("Video yükleme şu anda kullanılamıyor.", 503);

async function uploader(request: Request) {
  const user = await currentUser(request);
  return user && ["agent", "individual", "admin"].includes(user.role) ? user : null;
}
// Per-member request limits (15-minute window, lib/recovery-service.ts).
async function limit(kind: string, user: User, max: number) {
  try { await consumeRecoveryLimit(db() as never, await sha256(`video-${kind}:${user.id}`), max); return null; }
  catch (cause) { if (cause instanceof RecoveryError) return error("Çok fazla video isteği. 15 dakika sonra tekrar deneyin.", 429); throw cause; }
}
async function ownVideo(user: User, id: unknown) {
  if (!validVideoId(id)) return null;
  const video = await videoById(db() as unknown as VideoDatabase, id);
  return video && (video.owner_id === user.id || isAdmin(user)) ? video : null;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await uploader(request);
  if (!user) return error("Video yüklemek için ilan veren hesabı gerekir.", 403);
  const storage = videoStorageFromEnv();
  if (!videoUploadsReady() || !storage) return unavailable();
  const data = await body(request).catch(() => null) as { size?: unknown; type?: unknown } | null;
  const size = Number(data?.size);
  if (!Number.isSafeInteger(size) || size <= 0) return error("Lütfen bir video dosyası seçin.");
  if (size > MAX_VIDEO_BYTES) return error("Video en fazla 1 GB olabilir.");
  const limited = await limit("start", user, 10);
  if (limited) return limited;
  const database = db() as unknown as VideoDatabase;
  if (await openUploadCount(database, user.id) >= VIDEO_OPEN_UPLOADS) return error("Kaydedilmemiş çok fazla videonuz var. Önce ilanınızı kaydedin veya kullanmadığınız videoları kaldırın.", 429);
  const type = typeof data?.type === "string" && /^video\/[a-z0-9.+-]{1,40}$/.test(data.type) ? data.type : "application/octet-stream";
  const id = crypto.randomUUID(), key = rawVideoKey(user.id, id);
  try {
    const uploadId = await storage.createUpload(key, type);
    await createVideoRow(database, { id, ownerId: user.id, uploadId, rawKey: key, contentType: type, size });
  } catch (cause) {
    console.error("[video] upload start failed", String((cause as Error)?.message || cause));
    return error("Video yüklemesi başlatılamadı. Tekrar deneyin.", 502);
  }
  return ok({ id, chunkSize: VIDEO_CHUNK_BYTES, parts: videoPartCount(size) }, { status: 201, headers });
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await uploader(request);
  if (!user) return error("Giriş gerekli.", 401);
  const storage = videoStorageFromEnv();
  if (!videoUploadsReady() || !storage) return unavailable();
  const query = new URL(request.url).searchParams, part = Number(query.get("part"));
  const video = await ownVideo(user, query.get("id"));
  if (!video || video.owner_id !== user.id) return error("Video bulunamadı.", 404);
  if (video.status !== "uploading" || !video.upload_id) return error("Bu video yüklemesi tamamlandı veya iptal edildi.", 409);
  const length = videoPartLength(video.size_bytes, part);
  if (!length) return error("Geçersiz video parçası.");
  const declared = request.headers.get("content-length");
  if (declared != null && Number(declared) !== length || !request.body) return error("Video parçası eksik geldi. Tekrar deneyin.");
  const limited = await limit("part", user, 400);
  if (limited) return limited;
  let stream: ReadableStream<Uint8Array> = request.body;
  if (part === 1) {
    // The browser's file type is only a hint: check the container format from the first bytes.
    const peeked = await peekStream(stream, 12);
    if (!sniffVideo(peeked.head)) { await peeked.stream.cancel().catch(() => {}); return error("Bu dosya desteklenen bir video biçiminde değil. MP4, MOV, WEBM veya MKV yükleyin.", 415); }
    stream = peeked.stream;
  }
  const state = { wrong: false };
  try {
    await storage.uploadPart(video.raw_key, video.upload_id, part, exactLength(stream, length, state), length);
  } catch (cause) {
    if (state.wrong) return error("Video parçası eksik geldi. Tekrar deneyin.");
    console.error("[video] part upload failed", video.id, part, String((cause as Error)?.message || cause));
    return error("Video parçası yüklenemedi. Tekrar deneyin.", 502);
  }
  return ok({ part }, { headers });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await uploader(request);
  if (!user) return error("Giriş gerekli.", 401);
  const storage = videoStorageFromEnv();
  if (!videoUploadsReady() || !storage) return unavailable();
  const data = await body(request).catch(() => null) as { id?: unknown; action?: unknown } | null;
  if (data?.action !== "complete") return error("Geçersiz işlem.");
  const video = await ownVideo(user, data.id);
  if (!video || video.owner_id !== user.id) return error("Video bulunamadı.", 404);
  if (video.status !== "uploading") return ok({ status: video.status }, { headers });
  try {
    const parts = await storage.listParts(video.raw_key, video.upload_id || "");
    if (!parts) return error("Video yüklemesi bulunamadı. Videoyu yeniden yükleyin.", 410);
    const count = videoPartCount(video.size_bytes), done = new Map(parts.map((item) => [item.part, item]));
    const missing = Array.from({ length: count }, (_, index) => index + 1).filter((part) => done.get(part)?.size !== videoPartLength(video.size_bytes, part));
    if (missing.length) return Response.json({ error: "Videonun bazı parçaları eksik. Yükleme devam ediyor.", missing }, { status: 409, headers });
    await storage.completeUpload(video.raw_key, video.upload_id!, parts.filter((item) => item.part <= count));
    await markVideoQueued(db() as unknown as VideoDatabase, video.id);
  } catch (cause) {
    console.error("[video] upload completion failed", video.id, String((cause as Error)?.message || cause));
    return error("Video kaydedilemedi. Tekrar deneyin.", 502);
  }
  wakeVideoWorker();
  return ok({ status: "queued" }, { headers });
}

export async function GET(request: Request) {
  if (!videoFeatureEnabled()) return unavailable();
  const user = await uploader(request);
  if (!user) return error("Giriş gerekli.", 401);
  const query = new URL(request.url).searchParams;
  const video = await ownVideo(user, query.get("id"));
  if (!video) return error("Video bulunamadı.", 404);
  let parts: number[] | undefined;
  if (video.status === "uploading" && query.get("parts") === "1" && video.upload_id) {
    try { parts = (await videoStorageFromEnv()?.listParts(video.raw_key, video.upload_id))?.filter((item) => item.size === videoPartLength(video.size_bytes, item.part)).map((item) => item.part) ?? []; }
    catch { return error("Video durumu alınamadı.", 502); }
  }
  const ready = video.status === "ready";
  return ok({
    id: video.id, status: video.status, error: video.status === "failed" ? video.error || "Video işlenemedi. Başka bir video yükleyin." : null,
    duration: video.duration_seconds, width: video.width, height: video.height,
    ...(ready ? { poster: videoPosterUrl(video.id), src: videoFileUrl(video.id) } : {}),
    ...(parts ? { parts } : {}),
  }, { headers });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  if (!videoFeatureEnabled()) return unavailable();
  const user = await uploader(request);
  if (!user) return error("Giriş gerekli.", 401);
  const video = await ownVideo(user, new URL(request.url).searchParams.get("id"));
  if (!video) return ok({ success: true }, { headers });
  // Attached videos are removed when the listing is saved without them (app/api/listings/[id]).
  if (video.listing_id) return error("Bu video bir ilana bağlı. İlanı kaydettiğinizde kaldırılır.", 409);
  await removeVideo(db() as unknown as VideoDatabase, video, videoStorageFromEnv());
  return ok({ success: true }, { headers });
}
