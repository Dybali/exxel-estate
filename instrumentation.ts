// Server startup hook (Next.js; vinext also calls it on the first request). Only the Node build for
// the Mittwald container does anything: there "@/lib/postgres-driver" is lib/postgres-driver-node.ts
// and applies new postgres/migrations (lib/postgres-migrations.ts), and "@/lib/video-worker" is
// lib/video-worker-node.ts, the ffmpeg worker for listing videos (docs/listing-videos.md). On
// Cloudflare both slots are null.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runStartupMigrations } = await import("@/lib/postgres-driver");
  if (runStartupMigrations) await runStartupMigrations();
  // After the migrations (the listing_videos table); never blocks or crashes the startup.
  const { startVideoWorker } = await import("@/lib/video-worker");
  if (startVideoWorker) void startVideoWorker().catch((cause) => console.error("[video] worker failed to start", cause));
}
