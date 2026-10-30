import { body, currentUser, error, isAdmin, ok, sameOrigin } from "@/lib/server";
import { createVideoUpload, scheduleVideoDeletion, streamReady, streamVideoInfo, unattachedDeletionDate } from "@/lib/stream-server";
import { MAX_VIDEO_BYTES, validStreamUid } from "@/lib/stream-video";

const noStore = { headers: { "Cache-Control": "private, no-store" } };
async function uploader(request: Request) {
  const user = await currentUser(request);
  return user && ["agent", "individual", "admin"].includes(user.role) ? user : null;
}

// Starts a listing video upload: returns a one-time tus URL the browser uploads to directly.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await uploader(request);
  if (!user) return error("Video yüklemek için ilan veren hesabı gerekir.", 403);
  if (!streamReady()) return error("Video yükleme henüz yapılandırılmadı.", 503);
  const data = await body(request).catch(() => null) as { size?: unknown } | null;
  const size = Number(data?.size);
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_VIDEO_BYTES) return error("Video en fazla 2 GB olabilir.");
  try { return ok(await createVideoUpload(user.id, size), { status: 201, ...noStore }); }
  catch { return error("Video yüklemesi başlatılamadı. Tekrar deneyin.", 502); }
}

async function ownVideo(request: Request, uid: unknown) {
  const user = await uploader(request);
  if (!user) return { problem: error("Giriş gerekli.", 401) };
  if (!validStreamUid(uid)) return { problem: error("Video bulunamadı.", 404) };
  const video = await streamVideoInfo(uid);
  if (!video || video.creator !== user.id && !isAdmin(user)) return { problem: error("Video bulunamadı.", 404) };
  return { video, uid };
}

// Processing status for the form preview.
export async function GET(request: Request) {
  if (!streamReady()) return error("Video yükleme henüz yapılandırılmadı.", 503);
  try {
    const found = await ownVideo(request, new URL(request.url).searchParams.get("uid"));
    if (found.problem) return found.problem;
    const { ready, state, duration } = found.video;
    return ok({ ready, state, duration, failed: state === "error" }, noStore);
  } catch { return error("Video durumu alınamadı.", 502); }
}

// Upload finished: until a listing is saved with it, the video is scheduled for deletion.
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  if (!streamReady()) return error("Video yükleme henüz yapılandırılmadı.", 503);
  const data = await body(request).catch(() => null) as { uid?: unknown } | null;
  try {
    const found = await ownVideo(request, data?.uid);
    if (found.problem) return found.problem;
    await scheduleVideoDeletion(found.uid, unattachedDeletionDate());
    return ok({ success: true }, noStore);
  } catch { return error("Video kaydedilemedi. Tekrar deneyin.", 502); }
}
