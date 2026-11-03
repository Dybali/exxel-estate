import { neon } from "@neondatabase/serverless";
import { pgD1 } from "./pg-d1";

// Neon's HTTP driver behind the D1-compatible surface (query rewriting and batch semantics are
// shared with the TCP driver in lib/pg-d1.ts).
export function neonD1(url: string) {
  const sql = neon(url);
  return pgD1({
    query: (text, values) => sql.query(text, values) as Promise<Record<string, unknown>[]>,
    transaction: (queries) => sql.transaction(queries.map((query) => sql.query(query.text, query.values))) as Promise<Record<string, unknown>[][]>,
  });
}
