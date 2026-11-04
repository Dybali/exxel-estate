import type { pgD1 } from "./pg-d1";

// TCP PostgreSQL driver slot. This file is what the Cloudflare (vinext) build sees: no driver, so
// postgres.js is never bundled for Workers. The Node build for the Mittwald container aliases
// "@/lib/postgres-driver" to lib/postgres-driver-node.ts (next.config.ts).
export const postgresDriver: ((url: string) => ReturnType<typeof pgD1>) | null = null;
// Startup migration runner slot (instrumentation.ts): nothing to run on Cloudflare.
export const runStartupMigrations: ((settings?: Record<string, string | undefined>) => Promise<void>) | null = null;
