// Storage of the TCMB market snapshot (lib/market-stats.ts): one row in market_stats, created on first use.
// The SQL runs on PostgreSQL (Neon, Mittwald) and SQLite (tests).
import type { MarketSnapshot } from "./market-stats";

type Statement = { bind(...values: unknown[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown> };
export type MarketDatabase = { prepare(query: string): Statement };

const ready = new WeakSet<object>();
async function ensure(db: MarketDatabase) {
  if (ready.has(db)) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS market_stats (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
  ready.add(db);
}

export async function readMarketSnapshot(db: MarketDatabase): Promise<MarketSnapshot | null> {
  await ensure(db);
  const row = await db.prepare("SELECT data FROM market_stats WHERE id = ?").bind("tcmb").first<{ data: string }>();
  if (!row?.data) return null;
  try { return JSON.parse(row.data) as MarketSnapshot; } catch { return null; }
}

export async function writeMarketSnapshot(db: MarketDatabase, snapshot: MarketSnapshot) {
  await ensure(db);
  await db.prepare("INSERT INTO market_stats (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at")
    .bind("tcmb", JSON.stringify(snapshot), snapshot.updatedAt).run();
}
