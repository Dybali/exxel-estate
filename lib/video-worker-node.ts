import { databaseDriver } from "./pg-d1";
// Through the alias: in the Node build this is lib/postgres-driver-node.ts.
import { postgresDriver } from "@/lib/postgres-driver";
import { claimVideoJob, type VideoDatabase } from "./listing-video-store";
import { videoStorage, type VideoStorage, type VideoStorageSettings } from "./video-storage";
import { processVideoJob, removeStaleTempDirs, videoToolsAvailable, type SpawnLike } from "./video-transcode";
import { setVideoWorkerState, videoWorkerState } from "./video-worker-state";

// Background video worker inside the Mittwald container (docs/listing-videos.md). Node build only:
// next.config.ts aliases "@/lib/video-worker" here; Cloudflare sees the null slot lib/video-worker.ts.
// One job at a time in this process; jobs are claimed with a single UPDATE (lib/listing-video-store.ts)
// so a restart or a second container never processes the same video twice. Never throws.
export const VIDEO_POLL_MS = 15_000;
type Settings = VideoStorageSettings & { DATABASE_URL?: string; VIDEO_WORKER?: string };
type Options = { spawn?: SpawnLike; database?: VideoDatabase; storage?: VideoStorage; pollMs?: number; tmpRoot?: string };

function skip(reason: string) {
  console.info(`[video] worker skipped: ${reason}`);
  setVideoWorkerState({ running: false, reason });
}

export async function startVideoWorker(settings: Settings = process.env as Settings, options: Options = {}) {
  try {
    if (videoWorkerState().running) return;
    if (settings.VIDEO_WORKER === "0") return skip("disabled (VIDEO_WORKER=0)");
    if (!postgresDriver || !settings.DATABASE_URL || databaseDriver(settings.DATABASE_URL, true) !== "postgres") return skip("no TCP PostgreSQL database configured");
    let storage: VideoStorage | null | undefined = options.storage;
    try { storage ??= videoStorage(settings); } catch { storage = null; }
    if (!storage) return skip("R2 storage is not configured");
    if (!await videoToolsAvailable(options.spawn)) return skip("ffmpeg/ffprobe not found");
    await removeStaleTempDirs(options.tmpRoot);
    const db = options.database ?? postgresDriver(settings.DATABASE_URL) as unknown as VideoDatabase;
    const pollMs = options.pollMs ?? VIDEO_POLL_MS;
    let timer: ReturnType<typeof setTimeout> | undefined, busy = false, stopped = false;
    const schedule = (ms: number) => { clearTimeout(timer); if (stopped) return; timer = setTimeout(() => void tick(), ms); timer.unref?.(); };
    async function tick() {
      if (busy || stopped) return;
      busy = true;
      try {
        for (let job = await claimVideoJob(db); job && !stopped; job = stopped ? null : await claimVideoJob(db)) {
          await processVideoJob(job, { db, storage: storage!, spawn: options.spawn, tmpRoot: options.tmpRoot });
        }
      } catch (cause) {
        // Database unreachable and the like: try again on the next poll.
        console.error("[video] worker poll failed:", String((cause as Error)?.message || cause));
      } finally {
        busy = false;
        schedule(pollMs);
      }
    }
    setVideoWorkerState({ running: true, wake: () => { if (!busy) schedule(0); }, stop: () => { stopped = true; clearTimeout(timer); setVideoWorkerState({ running: false, reason: "stopped" }); } });
    console.info("[video] worker started");
    schedule(1_000);
  } catch (cause) {
    skip(`start failed: ${String((cause as Error)?.message || cause)}`);
  }
}
