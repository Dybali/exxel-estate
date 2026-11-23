import {activePublicationQuery} from './listing-policy';
import {pgPresentationJson} from './pg-json';

// The D1-compatible surface of the PostgreSQL driver (TCP, lib/postgres-driver-node.ts, the Mittwald
// container's own PostgreSQL): rewrites the SQLite-flavoured queries and runs batches in one
// transaction. Pure module: no driver imports here. Neon is no longer used (owner's decision 2026-11-23).

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

// The database object the site works with (db(), serviceDB()).
export type SiteDatabase = ReturnType<typeof pgD1>;
export function pgD1(client: PgClient) {
  function prepare(source: string) {
    const values: BoundValue[] = [];
    const query = pgQuery(source);
    const statement = {
      bind(...args: unknown[]) { values.push(...(args as BoundValue[])); return statement; },
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

// Whether the main database can be reached: a DATABASE_URL and the TCP driver (it exists only in the
// Node build for the Mittwald container).
export function databaseDriver(url: string, tcpAvailable: boolean): "postgres" | "none" {
  return url && tcpAvailable ? "postgres" : "none";
}
