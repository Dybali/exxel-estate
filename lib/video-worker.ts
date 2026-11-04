// Video worker slot. This file is what the Cloudflare (vinext) build sees: no worker, so ffmpeg,
// child_process and the job loop are never bundled for Workers. The Node build for the Mittwald
// container aliases "@/lib/video-worker" to lib/video-worker-node.ts (next.config.ts), started from
// instrumentation.ts after the startup migrations.
export const startVideoWorker: ((settings?: Record<string, string | undefined>) => Promise<void>) | null = null;
