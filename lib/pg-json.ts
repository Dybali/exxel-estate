// Rewrites SQLite json_extract on listing.presentation (top level, or under land/details/commission) to PostgreSQL jsonb.
export function pgPresentationJson(sql: string) {
  return sql.replace(/json_extract\(l\.presentation,'\$\.(?:(land|details|commission)\.)?(\w+)'\)/g, (_, group: string | undefined, key: string) =>
    group ? `(l.presentation::jsonb->'${group}'->>'${key}')` : `(l.presentation::jsonb->>'${key}')`);
}
