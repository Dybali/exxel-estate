import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { databaseDriver, pgD1, type BoundValue, type PgClient, type PgRow } from "./pg-d1";
import { applyMigrations, type MigrationSql } from "./postgres-migrations";

// Standard TCP PostgreSQL driver (postgres.js) for the Mittwald container, behind the same
// D1-compatible surface as Neon's HTTP driver. Only the Node build uses this module (next.config.ts
// aliases "@/lib/postgres-driver" here); lib/postgres-driver.ts is the empty Cloudflare stand-in.
type Sql = ReturnType<typeof postgres>;
const pools = new Map<string, Sql>();

function pool(url: string) {
  let sql = pools.get(url);
  if (!sql) {
    sql = postgres(url, {
      max: Math.max(1, Math.min(50, Number(process.env.DATABASE_POOL_MAX) || 10)),
      idle_timeout: 30,
      connect_timeout: 10,
      // One slow query must not hold one of the few connections indefinitely. Migrations use their own
      // connection (runStartupMigrations) and are not limited by this.
      connection: { statement_timeout: 30_000, idle_in_transaction_session_timeout: 60_000 },
      // "relation already exists, skipping" from CREATE TABLE IF NOT EXISTS is expected.
      onnotice: () => {},
    });
    pools.set(url, sql);
  }
  return sql;
}

// Neon's driver sends undefined as NULL; postgres.js would reject it.
const params = (values: BoundValue[]) => values.map((value) => value === undefined ? null : value) as never[];
const plain = (rows: Iterable<PgRow>) => Array.from(rows);

export function postgresClient(sql: Pick<Sql, "unsafe" | "begin">): PgClient {
  return {
    async query(text, values) { return plain(await sql.unsafe(text, params(values)) as Iterable<PgRow>); },
    async transaction(queries) {
      return await sql.begin(async (tx) => {
        const results: PgRow[][] = [];
        for (const query of queries) results.push(plain(await tx.unsafe(query.text, params(query.values)) as Iterable<PgRow>));
        return results;
      }) as PgRow[][];
    },
  };
}

export const postgresDriver = (url: string) => pgD1(postgresClient(pool(url)));

// Startup migrations (instrumentation.ts): applies postgres/migrations from 018 on to the TCP
// PostgreSQL database. Uses its own single connection, so the advisory lock and every statement
// share one session. Never throws: a failure is logged and the server keeps serving.
export async function runStartupMigrations(settings: Record<string, string | undefined> = process.env) {
  const url = settings.DATABASE_URL;
  if (!url || databaseDriver(url, settings.DATABASE_DRIVER, true) !== "postgres") {
    console.info("[migrations] skipped: no TCP PostgreSQL database configured");
    return;
  }
  // The Docker image copies postgres/migrations to /app/postgres/migrations (process.cwd() is /app).
  const dir = path.join(/* turbopackIgnore: true */ process.cwd(), "postgres", "migrations");
  let sql: ReturnType<typeof postgres> | undefined;
  try {
    const files = await readdir(dir);
    sql = postgres(url, {
      max: 1,
      connect_timeout: 10,
      onnotice: () => {},
      // Do not hold up startup forever behind another session's lock.
      connection: { application_name: "exxel-migrations", lock_timeout: 60_000 },
    });
    const applied = await applyMigrations(sql as unknown as MigrationSql, files, (file) => readFile(path.join(dir, file), "utf8"));
    console.info(applied.length ? `[migrations] done: ${applied.join(", ")}` : "[migrations] database up to date");
  } catch (cause) {
    const failure = cause as { code?: string; message?: string };
    console.error(`[migrations] failed (${failure?.code || "error"}): ${failure?.message || String(cause)}; the server keeps running`);
  } finally {
    await sql?.end({ timeout: 5 }).catch(() => {});
  }
}
