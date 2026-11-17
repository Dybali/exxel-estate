// "Gayrimenkul danışmanları" (/danismanlar): approved estate agents and the consultants of approved offices
// (company_team_memberships, shown with the office's name) with at least one published listing, most
// listings first, filterable by province, district, spoken language and name. Agents choose their languages in
// Hesabım › Profilim (agent_languages, created on first use). Works on PostgreSQL and SQLite.
interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type AgentDirectoryDatabase = { prepare(sql: string): Statement };

/** Languages an agent can choose; names are shown with Intl.DisplayNames in the visitor's language. */
export const AGENT_LANGUAGES = ["tr", "en", "de", "ru", "ar", "fa", "fr", "nl", "uk", "es", "it", "az", "ka", "zh"] as const;
export type AgentLanguage = typeof AGENT_LANGUAGES[number];
export const AGENTS_PER_PAGE = 24;
export const AGENT_LANGUAGE_SCHEMA = "CREATE TABLE IF NOT EXISTS agent_languages(user_id TEXT PRIMARY KEY,languages TEXT NOT NULL DEFAULT '[]',updated_at TEXT NOT NULL)";
const ready = new WeakMap<object, Promise<unknown>>();
async function ensure(db: AgentDirectoryDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = db.prepare(AGENT_LANGUAGE_SCHEMA).run(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}
export const isAgentLanguage = (value: unknown): value is AgentLanguage => (AGENT_LANGUAGES as readonly unknown[]).includes(value);
const parseLanguages = (value: unknown): AgentLanguage[] => { try { const list = JSON.parse(String(value || "[]")); return Array.isArray(list) ? list.filter(isAgentLanguage) : []; } catch { return []; } };

export async function agentLanguages(db: AgentDirectoryDatabase, userId: string) {
  await ensure(db);
  return parseLanguages((await db.prepare("SELECT languages FROM agent_languages WHERE user_id=?").bind(userId).first<{ languages: string }>())?.languages);
}
export async function setAgentLanguages(db: AgentDirectoryDatabase, userId: string, value: unknown, at = new Date()) {
  await ensure(db);
  const list = Array.isArray(value) ? [...new Set(value.filter(isAgentLanguage))] : [];
  await db.prepare("INSERT INTO agent_languages(user_id,languages,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET languages=excluded.languages,updated_at=excluded.updated_at").bind(userId, JSON.stringify(list), at.toISOString()).run();
  return list;
}

export type AgentQuery = { city?: string; district?: string; language?: string; q?: string; page?: number };
export type AgentCard = { id: string; name: string; company: string | null; avatarUrl: string | null; city: string; district: string; listings: number; languages: AgentLanguage[]; verified: boolean };

/** One page of agents and the total; `verifiedSql` is the server's OWNER_VERIFIED_SQL (alias u, column owner_verified). */
export async function listAgents(db: AgentDirectoryDatabase, query: AgentQuery, verifiedSql = "0 AS owner_verified") {
  await ensure(db);
  const where = [`((u.role='agent' AND u.agent_status='approved') OR EXISTS(SELECT 1 FROM company_team_memberships tm JOIN agencies ta ON ta.id=tm.agency_id WHERE tm.user_id=u.id AND tm.ended_at IS NULL AND ta.status='approved'))`], values: (string | number)[] = [];
  const listing = ["l.owner_id=u.id", "l.status='published'"], listingValues: string[] = [];
  if (query.city) { listing.push("l.city=?"); listingValues.push(query.city); if (query.district) { listing.push("l.district=?"); listingValues.push(query.district); } }
  if (query.language && isAgentLanguage(query.language)) { where.push("EXISTS(SELECT 1 FROM agent_languages al WHERE al.user_id=CAST(u.id AS TEXT) AND al.languages LIKE ?)"); values.push(`%"${query.language}"%`); }
  const text = (query.q || "").trim().toLowerCase().slice(0, 80);
  if (text) { const like = `%${text.replace(/[!%_]/g, (c) => `!${c}`)}%`; where.push("(LOWER(u.name) LIKE ? ESCAPE '!' OR LOWER(COALESCE(u.company,'')) LIKE ? ESCAPE '!')"); values.push(like, like); }
  const page = Math.min(500, Math.max(1, Math.floor(query.page || 1)));
  const from = `FROM users u JOIN listings l ON ${listing.join(" AND ")} WHERE ${where.join(" AND ")}`;
  const total = await db.prepare(`SELECT COUNT(*) AS n FROM (SELECT u.id ${from} GROUP BY u.id) x`).bind(...listingValues, ...values).first<{ n: number }>();
  const rows = (await db.prepare(`SELECT CAST(u.id AS TEXT) AS id,u.name,COALESCE((SELECT oa.name FROM company_team_memberships om JOIN agencies oa ON oa.id=om.agency_id WHERE om.user_id=u.id AND om.ended_at IS NULL AND oa.status='approved' LIMIT 1),u.company) AS company,u.avatar_url,COUNT(l.id) AS listings,${verifiedSql},
      (SELECT l2.city FROM listings l2 WHERE l2.owner_id=u.id AND l2.status='published' GROUP BY l2.city ORDER BY COUNT(*) DESC LIMIT 1) AS main_city,
      (SELECT l3.district FROM listings l3 WHERE l3.owner_id=u.id AND l3.status='published' GROUP BY l3.district ORDER BY COUNT(*) DESC LIMIT 1) AS main_district,
      (SELECT al.languages FROM agent_languages al WHERE al.user_id=CAST(u.id AS TEXT)) AS languages
    ${from} GROUP BY u.id ORDER BY COUNT(l.id) DESC,u.name ASC LIMIT ? OFFSET ?`).bind(...listingValues, ...values, AGENTS_PER_PAGE, (page - 1) * AGENTS_PER_PAGE).all<Record<string, unknown>>()).results || [];
  return {
    total: Number(total?.n) || 0, page,
    agents: rows.map((row): AgentCard => ({
      id: String(row.id), name: String(row.name || ""), company: row.company ? String(row.company) : null, avatarUrl: typeof row.avatar_url === "string" && row.avatar_url.startsWith("/api/media/") ? row.avatar_url : null,
      city: String(row.main_city || ""), district: String(row.main_district || ""), listings: Number(row.listings) || 0, languages: parseLanguages(row.languages), verified: Number(row.owner_verified) === 1 || row.owner_verified === true,
    })),
  };
}

/** Phone of a listed, approved agent or office consultant for "Telefonu göster"; null otherwise. */
export async function agentPhone(db: AgentDirectoryDatabase, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = await db.prepare("SELECT u.phone FROM users u WHERE CAST(u.id AS TEXT)=? AND ((u.role='agent' AND u.agent_status='approved') OR EXISTS(SELECT 1 FROM company_team_memberships tm JOIN agencies ta ON ta.id=tm.agency_id WHERE tm.user_id=u.id AND tm.ended_at IS NULL AND ta.status='approved')) AND EXISTS(SELECT 1 FROM listings l WHERE l.owner_id=u.id AND l.status='published')").bind(id).first<{ phone: string | null }>();
  return row?.phone ? String(row.phone) : null;
}
