// Rewrites SQLite json_extract on listing.presentation (top level or under land) to PostgreSQL jsonb.
export function pgPresentationJson(sql: string) {
  return sql.replace(/json_extract\(l\.presentation,'\$\.(land\.)?(\w+)'\)/g, (_, land: string | undefined, key: string) =>
    land ? `(l.presentation::jsonb->'land'->>'${key}')` : `(l.presentation::jsonb->>'${key}')`);
}
