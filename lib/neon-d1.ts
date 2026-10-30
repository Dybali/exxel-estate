import {activePublicationQuery} from './listing-policy';
import { neon } from "@neondatabase/serverless";

type BoundValue = string | number | boolean | null;

// A small D1-compatible surface lets the existing API use parameterized PostgreSQL
// while the original D1 database remains available for the migration window.
function pgQuery(source: string) {
  let index = 0;
  return activePublicationQuery(source)
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO")
    .replace(/json_each\(l\.amenities\)/g, "jsonb_array_elements_text(l.amenities::jsonb)")
    .replace(/json_extract\(l\.presentation,'\$\.land\.(\w+)'\)/g, "(l.presentation::jsonb->'land'->>'$1')")
    .replace(/\?/g, () => `$${++index}`)
    .replace(/\bINSERT INTO favorites\b([\s\S]*?)$/i, (whole) =>
      /ON CONFLICT/i.test(whole) || !/INSERT\s+OR\s+IGNORE/i.test(source) ? whole : `${whole} ON CONFLICT DO NOTHING`);
}

export function neonD1(url: string) {
  const sql = neon(url);
  function prepare(source: string) {
    const values: BoundValue[] = [];
    const query = pgQuery(source);
    const statement = {
      bind(...args: BoundValue[]) { values.push(...args); return statement; },
      async all<T = Record<string, unknown>>() {
        const rows = await sql.query(query, values);
        return { results: rows as T[] };
      },
      async first<T = Record<string, unknown>>() {
        const rows = await sql.query(query, values);
        return (rows[0] as T | undefined) ?? null;
      },
      async run() {
        await sql.query(query, values);
        return { success: true };
      },
      toQuery() { return sql.query(query, values); },
    };
    return statement;
  }
  return {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      return sql.transaction(statements.map((statement) => statement.toQuery()));
    },
  };
}
