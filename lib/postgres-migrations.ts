// Startup migration runner for the Mittwald container's PostgreSQL (docs/mittwald-migration.md).
// The database there is internal-only, so new files in postgres/migrations are applied when the
// Node server starts (instrumentation.ts -> lib/postgres-driver-node.ts). This module holds only the
// logic and never imports a driver; the Cloudflare build never reaches it.

// 001–017 are already part of the copied production data and must never run again.
export const MIGRATION_BASELINE = 18;
export const MIGRATION_FILE = /^\d{3}_[a-z0-9_]+\.sql$/;
// Arbitrary constant key for pg_advisory_lock, so two starting containers never migrate at once.
export const MIGRATION_LOCK_KEY = 4_524_018;

type Query = (text: string, values?: unknown[]) => PromiseLike<unknown>;
export type MigrationSql = {
  unsafe: Query;
  begin<T>(work: (tx: { unsafe: Query }) => Promise<T>): PromiseLike<T>;
};
type Log = Pick<Console, "info" | "warn">;

// Files still to apply, in order: valid names only, at or above the baseline, not yet recorded.
// Versions are full file names ("018_x.sql"), as scripts/neon-migrate.mjs records them.
export function pendingMigrations(files: string[], applied: Iterable<string>, baseline = MIGRATION_BASELINE) {
  const done = new Set(applied);
  return files.filter((file) => MIGRATION_FILE.test(file) && Number(file.slice(0, 3)) >= baseline && !done.has(file)).sort();
}

export async function applyMigrations(sql: MigrationSql, files: string[], read: (file: string) => Promise<string>, log: Log = console) {
  for (const file of files) if (file.endsWith(".sql") && !MIGRATION_FILE.test(file)) log.warn(`[migrations] ignored invalid file name ${file}`);
  await sql.unsafe("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
  try {
    await sql.unsafe("CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const rows = await sql.unsafe("SELECT version FROM schema_migrations") as { version: unknown }[];
    const pending = pendingMigrations(files, Array.from(rows, (row) => String(row.version)));
    for (const file of pending) {
      const text = await read(file);
      // One transaction per file. No parameters: postgres.js then uses the simple query protocol,
      // which runs several statements and $$-quoted function bodies as written.
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
        await tx.unsafe("INSERT INTO schema_migrations(version) VALUES($1)", [file]);
      });
      log.info(`[migrations] applied ${file}`);
    }
    return pending;
  } finally {
    await sql.unsafe("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
  }
}
