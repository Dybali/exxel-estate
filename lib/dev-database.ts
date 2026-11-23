import { publicationD1 } from "./d1-publication";
import type { SiteDatabase } from "./pg-d1";

// Local development without DATABASE_URL (npm run dev): a SQLite file, .data/dev.sqlite, with the
// drizzle/ schema (the same SQLite schema the tests use). It replaced the local D1 database of the
// removed Cloudflare build (2026-11-23). Never used in production: there DATABASE_URL is required.
// node:sqlite is loaded lazily with process.getBuiltinModule, so the production server never loads it.
type Row = Record<string, unknown>;
type Statement = { all(...values: unknown[]): Row[]; get(...values: unknown[]): Row | undefined; run(...values: unknown[]): unknown };
type Sqlite = { prepare(sql: string): Statement; exec(sql: string): void };
type Value = string | number | bigint | null | Uint8Array;

let opened: SiteDatabase | null = null;
const toValue = (value: unknown): Value => value === undefined ? null : typeof value === "boolean" ? Number(value) : value as Value;

export function sqliteD1(sqlite: Sqlite) {
  function prepare(source: string) {
    let values: Value[] = [];
    const statement = {
      bind(...args: unknown[]) { values = [...values, ...args.map(toValue)]; return statement; },
      async all<T = Row>() { return { results: sqlite.prepare(source).all(...values) as T[] }; },
      async first<T = Row>() { return (sqlite.prepare(source).get(...values) as T | undefined) ?? null; },
      async run() { sqlite.prepare(source).run(...values); return { success: true }; },
      run_now() { return sqlite.prepare(source).run(...values); },
    };
    return statement;
  }
  return {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      sqlite.exec("BEGIN");
      try { const out = statements.map((statement) => { statement.run_now(); return [] as Row[]; }); sqlite.exec("COMMIT"); return out; }
      catch (cause) { sqlite.exec("ROLLBACK"); throw cause; }
    },
  };
}

export function devDatabase(): SiteDatabase | null {
  if (process.env.NODE_ENV === "production") return null;
  if (opened) return opened;
  const getBuiltin = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule;
  if (!getBuiltin) return null;
  const { DatabaseSync } = getBuiltin("node:sqlite") as { DatabaseSync: new (file: string) => Sqlite };
  const fs = getBuiltin("node:fs") as typeof import("node:fs"), path = getBuiltin("node:path") as typeof import("node:path");
  const dir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "dev.sqlite"), fresh = !fs.existsSync(file);
  const sqlite = new DatabaseSync(file);
  if (fresh) {
    const migrations = path.join(process.cwd(), "drizzle");
    for (const name of fs.readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort())
      for (const part of fs.readFileSync(path.join(migrations, name), "utf8").split("--> statement-breakpoint")) if (part.trim()) sqlite.exec(part);
  }
  opened = publicationD1(sqliteD1(sqlite)) as unknown as SiteDatabase;
  return opened;
}
