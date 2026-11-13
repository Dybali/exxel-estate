// Daily counters of a firm's public profile, shared by service firms (service_firm_stats) and contractors
// (contractor_firm_stats): profile views, contact clicks, appearances in search results and requests received.
// Only daily totals per firm are stored, never who did it. Days follow the Istanbul calendar. PostgreSQL and SQLite.
type Statement = { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> };
export type FirmStatsDatabase = { prepare(sql: string): Statement };
export type FirmStatsTable = "service_firm_stats" | "contractor_firm_stats";

export const firmStatsSchema = (table: FirmStatsTable) => `CREATE TABLE IF NOT EXISTS ${table}(firm_id TEXT NOT NULL,day TEXT NOT NULL,kind TEXT NOT NULL,n INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(firm_id,day,kind))`;
export const istanbulDay = (at: Date) => new Date(at.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
/** Kinds that are not a contact click: they stay out of the daily "contacts" line. */
const NOT_CONTACT = new Set(["view", "search", "quote", "offer", "request"]);

export async function countFirmStat(db: FirmStatsDatabase, table: FirmStatsTable, firmId: string, kind: string, at = new Date(), amount = 1) {
  await db.prepare(`INSERT INTO ${table}(firm_id,day,kind,n) VALUES(?,?,?,?) ON CONFLICT(firm_id,day,kind) DO UPDATE SET n=${table}.n+excluded.n`).bind(firmId, istanbulDay(at), kind, amount).run();
}

export type FirmStats<K extends string> = { days: number; totals: Record<K, number>; previous: Record<K, number>; daily: { day: string; views: number; contacts: number; searches: number }[] };
/** Last `days` days with the period before for comparison, and a daily series of views, contacts and search appearances. */
export async function firmDailyStats<K extends string>(db: FirmStatsDatabase, table: FirmStatsTable, kinds: readonly K[], firmId: string, days = 30, at = new Date()): Promise<FirmStats<K>> {
  const today = new Date(`${istanbulDay(at)}T00:00:00Z`), from = new Date(today.getTime() - (days - 1) * 86400_000), before = new Date(from.getTime() - days * 86400_000);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const rows = (await db.prepare(`SELECT day,kind,n FROM ${table} WHERE firm_id=? AND day>=?`).bind(firmId, iso(before)).all<{ day: string; kind: string; n: number }>()).results || [];
  const zero = () => Object.fromEntries(kinds.map((kind) => [kind, 0])) as Record<K, number>;
  const totals = zero(), previous = zero(), byDay = new Map<string, { views: number; contacts: number; searches: number }>();
  for (let index = 0; index < days; index++) byDay.set(iso(new Date(from.getTime() + index * 86400_000)), { views: 0, contacts: 0, searches: 0 });
  for (const row of rows) {
    const kind = String(row.kind) as K, n = Number(row.n) || 0, date = String(row.day);
    if (!(kinds as readonly string[]).includes(kind)) continue;
    if (date >= iso(from)) {
      totals[kind] += n;
      const entry = byDay.get(date);
      if (entry) { if (kind === "view") entry.views += n; else if (kind === "search") entry.searches += n; else if (!NOT_CONTACT.has(kind)) entry.contacts += n; }
    } else previous[kind] += n;
  }
  return { days, totals, previous, daily: [...byDay].map(([date, value]) => ({ day: date, ...value })) };
}
