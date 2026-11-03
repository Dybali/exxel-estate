import {activePublicationQuery} from './listing-policy';
import {pgPresentationJson} from './pg-json';

// The D1-compatible surface shared by both PostgreSQL drivers: Neon's HTTP driver (lib/neon-d1.ts,
// Cloudflare today) and the TCP driver for the Mittwald container (lib/postgres-d1-node.ts). Both
// rewrite the SQLite-flavoured queries the same way and run batches in one transaction, so the
// site behaves identically whichever driver is in use. Pure module: no driver imports here.

export type BoundValue = string | number | boolean | null;
export type PgRow = Record<string, unknown>;
export type PgQuery = { text: string; values: BoundValue[] };
// What a driver has to provide: run one query, or run several in a single transaction
// (all succeed or none, results in order).
export interface PgClient {
  query(text: string, values: BoundValue[]): Promise<PgRow[]>;
  transaction(queries: PgQuery[]): Promise<PgRow[][]>;
}

export function pgQuery(source: string) {
  let index = 0;
  return pgPresentationJson(activePublicationQuery(source))
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO")
    .replace(/json_each\(l\.amenities\)/g, "jsonb_array_elements_text(l.amenities::jsonb)")
    .replace(/\?/g, () => `$${++index}`)
    .replace(/\bINSERT INTO favorites\b([\s\S]*?)$/i, (whole) =>
      /ON CONFLICT/i.test(whole) || !/INSERT\s+OR\s+IGNORE/i.test(source) ? whole : `${whole} ON CONFLICT DO NOTHING`);
}

export function pgD1(client: PgClient) {
  function prepare(source: string) {
    const values: BoundValue[] = [];
    const query = pgQuery(source);
    const statement = {
      bind(...args: BoundValue[]) { values.push(...args); return statement; },
      async all<T = PgRow>() {
        const rows = await client.query(query, values);
        return { results: rows as T[] };
      },
      async first<T = PgRow>() {
        const rows = await client.query(query, values);
        return (rows[0] as T | undefined) ?? null;
      },
      async run() {
        await client.query(query, values);
        return { success: true };
      },
      toQuery(): PgQuery { return { text: query, values }; },
    };
    return statement;
  }
  return {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      return client.transaction(statements.map((statement) => statement.toQuery()));
    },
  };
}

// Which PostgreSQL driver to use. The TCP driver only exists in the Node build (Mittwald
// container); Cloudflare always uses Neon's HTTP driver. DATABASE_DRIVER=postgres|neon forces a
// choice; otherwise a Neon host keeps the HTTP driver and any other host uses TCP.
export function databaseDriver(url: string, setting: string | undefined, tcpAvailable: boolean): "neon" | "postgres" {
  if (!tcpAvailable || setting === "neon") return "neon";
  if (setting === "postgres") return "postgres";
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { /* unparsable: let the driver report it */ }
  return host.endsWith(".neon.tech") ? "neon" : "postgres";
}
