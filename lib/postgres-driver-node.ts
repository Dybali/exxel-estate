import postgres from "postgres";
import { pgD1, type BoundValue, type PgClient, type PgRow } from "./pg-d1";

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
