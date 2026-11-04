// Server startup hook (Next.js; vinext also calls it on the first request). Only the Node build for
// the Mittwald container does anything: there "@/lib/postgres-driver" is lib/postgres-driver-node.ts
// and applies new postgres/migrations (lib/postgres-migrations.ts). On Cloudflare the slot is null.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runStartupMigrations } = await import("@/lib/postgres-driver");
  if (runStartupMigrations) await runStartupMigrations();
}
