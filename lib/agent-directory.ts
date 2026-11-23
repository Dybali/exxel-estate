// "Gayrimenkul danışmanları" (/danismanlar): approved estate agents and the consultants of approved offices
// (company_team_memberships, shown with the office's name) with at least one published listing, most
// listings first, filterable by province, district, spoken language and name. Agents choose their languages in
// Hesabım › Profilim (agent_languages, created on first use). Works on PostgreSQL and SQLite.
interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type AgentDirectoryDatabase = { prepare(sql: string): Statement };

/** Languages an agent can choose; names are shown with Intl.DisplayNames in the visitor's language. */
export const AGENT_LANGUAGES = ["tr", "en", "de", "ru", "ar", "fa", "fr", "nl", "uk", "es", "it", "az", "ka", "zh"] as const;
export type AgentLanguage = typeof AGENT_LANGUAGES[number];
// Flag shown next to each language (public/flags): English with the British flag, Arabic with Saudi Arabia, Persian with Iran.
export const AGENT_LANGUAGE_FLAGS: Record<AgentLanguage, string> = { tr: "tr", en: "gb", de: "de", ru: "ru", ar: "sa", fa: "ir", fr: "fr", nl: "nl", uk: "ua", es: "es", it: "it", az: "az", ka: "ge", zh: "cn" };
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

// Redesign 2026-11-23 (owner's request, like the big portals): each consultant shows the office they work for,
// active listings, the average asking price of their sale listings, listings added in the last three months, the
// languages they speak and the plan badge; filters for listing kind and category, four sort orders, and an
// office list (listOffices) next to the consultants.
export const AGENT_SORTS = ["onerilen", "ilan", "yeni", "fiyat"] as const;
export type AgentSort = typeof AGENT_SORTS[number];
export const AGENT_SPECIALTIES = { konut: ["daire", "rezidans", "mustakil", "villa", "ciftlik-evi", "kosk-konak", "yali", "yali-dairesi", "yazlik", "kooperatif"], isyeri: ["ticari", "bina"], arsa: ["arsa"], turistik: ["turistik", "devremulk"] } as const;
export type AgentSpecialty = keyof typeof AGENT_SPECIALTIES;
export type AgentQuery = { city?: string; district?: string; language?: string; q?: string; page?: number; purpose?: string; specialty?: string; sort?: string };
export type AgentOffice = { id: string; name: string; logo: string | null };
export type AgentCard = { id: string; name: string; company: string | null; office: AgentOffice | null; avatarUrl: string | null; city: string; district: string; listings: number; saleAverage: number | null; recent: number; languages: AgentLanguage[]; verified: boolean; plan: "prestige" | "professional" | null; about: string };
const media = (value: unknown) => typeof value === "string" && value.startsWith("/api/media/") ? value : null;
const RECENT_DAYS = 90;

/** Listing conditions shared by the consultant and office lists (place, sale/rent, category). */
function listingFilter(query: AgentQuery) {
  const where = ["l.status='published'"], values: string[] = [];
  if (query.city) { where.push("l.city=?"); values.push(query.city); if (query.district) { where.push("l.district=?"); values.push(query.district); } }
  if (query.purpose === "satilik" || query.purpose === "kiralik") { where.push("l.purpose=?"); values.push(query.purpose); }
  const types = AGENT_SPECIALTIES[query.specialty as AgentSpecialty];
  if (types) { where.push(`l.property_type IN (${types.map(() => "?").join(",")})`); values.push(...types); }
  return { where, values };
}
const textFilter = (query: AgentQuery, columns: string[]) => {
  const text = (query.q || "").trim().toLowerCase().slice(0, 80);
  if (!text) return null;
  const like = `%${text.replace(/[!%_]/g, (c) => `!${c}`)}%`;
  return { where: `(${columns.map((column) => `LOWER(COALESCE(${column},'')) LIKE ? ESCAPE '!'`).join(" OR ")})`, values: columns.map(() => like) };
};

/** One page of consultants and the total; `verifiedSql` is the server's OWNER_VERIFIED_SQL (alias u, column owner_verified). */
export async function listAgents(db: AgentDirectoryDatabase, query: AgentQuery, verifiedSql = "0 AS owner_verified", at = new Date()) {
  await ensure(db);
  const where = [`((u.role='agent' AND u.agent_status='approved') OR EXISTS(SELECT 1 FROM company_team_memberships tm JOIN agencies ta ON ta.id=tm.agency_id WHERE tm.user_id=u.id AND tm.ended_at IS NULL AND ta.status='approved'))`], values: (string | number)[] = [];
  const listing = listingFilter(query);
  if (query.language && isAgentLanguage(query.language)) { where.push("EXISTS(SELECT 1 FROM agent_languages al WHERE al.user_id=CAST(u.id AS TEXT) AND al.languages LIKE ?)"); values.push(`%"${query.language}"%`); }
  const text = textFilter(query, ["u.name", "u.company"]);
  if (text) { where.push(text.where); values.push(...text.values); }
  const page = Math.min(500, Math.max(1, Math.floor(query.page || 1)));
  const recentSince = new Date(at.getTime() - RECENT_DAYS * 86400000).toISOString();
  const from = `FROM users u JOIN listings l ON l.owner_id=u.id AND ${listing.where.join(" AND ")} WHERE ${where.join(" AND ")}`;
  const sort = AGENT_SORTS.find((item) => item === query.sort) || "onerilen";
  const saleAverage = "(SELECT AVG(ls.price) FROM listings ls WHERE ls.owner_id=u.id AND ls.status='published' AND ls.purpose='satilik' AND ls.currency='TRY')";
  const order = sort === "ilan" ? "COUNT(l.id) DESC" : sort === "yeni" ? "recent DESC,COUNT(l.id) DESC" : sort === "fiyat" ? `${saleAverage} IS NULL,${saleAverage} DESC,COUNT(l.id) DESC` : "owner_verified DESC,COUNT(l.id) DESC";
  const total = await db.prepare(`SELECT COUNT(*) AS n FROM (SELECT u.id ${from} GROUP BY u.id) x`).bind(...listing.values, ...values).first<{ n: number }>();
  const office = `COALESCE((SELECT CAST(om.agency_id AS TEXT) FROM company_team_memberships om JOIN agencies oa ON oa.id=om.agency_id WHERE om.user_id=u.id AND om.ended_at IS NULL AND oa.status='approved' LIMIT 1),(SELECT CAST(oo.id AS TEXT) FROM agencies oo WHERE oo.owner_id=u.id AND oo.status='approved' LIMIT 1))`;
  const rows = (await db.prepare(`SELECT CAST(u.id AS TEXT) AS id,u.name,u.company,u.avatar_url,COUNT(l.id) AS listings,${verifiedSql},${office} AS office_id,
      ${saleAverage} AS sale_average,
      (SELECT COUNT(*) FROM listings lr WHERE lr.owner_id=u.id AND lr.status='published' AND lr.created_at>=?) AS recent,
      (SELECT l2.city FROM listings l2 WHERE l2.owner_id=u.id AND l2.status='published' GROUP BY l2.city ORDER BY COUNT(*) DESC LIMIT 1) AS main_city,
      (SELECT l3.district FROM listings l3 WHERE l3.owner_id=u.id AND l3.status='published' GROUP BY l3.district ORDER BY COUNT(*) DESC LIMIT 1) AS main_district,
      (SELECT al.languages FROM agent_languages al WHERE al.user_id=CAST(u.id AS TEXT)) AS languages
    ${from} GROUP BY u.id ORDER BY ${order},u.name ASC LIMIT ? OFFSET ?`).bind(recentSince, ...listing.values, ...values, AGENTS_PER_PAGE, (page - 1) * AGENTS_PER_PAGE).all<Record<string, unknown>>()).results || [];
  const offices = new Map<string, AgentOffice>();
  for (const id of new Set(rows.map((row) => row.office_id).filter(Boolean).map(String))) {
    const row = await db.prepare("SELECT CAST(a.id AS TEXT) AS id,a.name,u.avatar_url FROM agencies a JOIN users u ON u.id=a.owner_id WHERE CAST(a.id AS TEXT)=?").bind(id).first<Record<string, unknown>>();
    if (row) offices.set(id, { id, name: String(row.name || ""), logo: media(row.avatar_url) });
  }
  const plans = new Map<string, "prestige" | "professional">();
  for (const row of rows) {
    const grant = await db.prepare("SELECT plan_id FROM agent_plan_grants WHERE CAST(user_id AS TEXT)=? AND revoked_at IS NULL AND starts_at<=? AND ends_at>? ORDER BY ends_at DESC LIMIT 1").bind(String(row.id), at.toISOString(), at.toISOString()).first<{ plan_id: string }>().catch(() => null);
    if (grant?.plan_id === "prestige" || grant?.plan_id === "professional") plans.set(String(row.id), grant.plan_id);
  }
  // The consultant's own words (Hesabım › Profilim › Hakkımda, seller_profiles.bio), shortened for the list.
  const about = new Map<string, string>();
  for (const row of rows) {
    const profile = await db.prepare("SELECT bio FROM seller_profiles WHERE CAST(user_id AS TEXT)=?").bind(String(row.id)).first<{ bio: string }>().catch(() => null);
    if (profile?.bio?.trim()) about.set(String(row.id), shortAbout(profile.bio));
  }
  return {
    total: Number(total?.n) || 0, page, sort,
    agents: rows.map((row): AgentCard => {
      const officeEntry = row.office_id ? offices.get(String(row.office_id)) || null : null;
      return {
        id: String(row.id), name: String(row.name || ""), company: officeEntry?.name || (row.company ? String(row.company) : null), office: officeEntry, avatarUrl: media(row.avatar_url),
        city: String(row.main_city || ""), district: String(row.main_district || ""), listings: Number(row.listings) || 0,
        saleAverage: row.sale_average == null ? null : Math.round(Number(row.sale_average)), recent: Number(row.recent) || 0,
        languages: parseLanguages(row.languages), verified: Number(row.owner_verified) === 1 || row.owner_verified === true, plan: plans.get(String(row.id)) || null, about: about.get(String(row.id)) || "",
      };
    }),
  };
}

// First 220 characters of the introduction on one line, cut at a word.
export function shortAbout(text: string, max = 220) {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= max) return line;
  const cut = line.slice(0, max), space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, "") + "…";
}
export type OfficeCard = { id: string; name: string; logo: string | null; city: string; district: string; consultants: number; listings: number; recent: number; languages: AgentLanguage[]; verified: boolean };
/** Approved estate offices with published listings (the owner's and their consultants'), most listings first. */
export async function listOffices(db: AgentDirectoryDatabase, query: AgentQuery, verifiedSql = "0 AS owner_verified", at = new Date()) {
  await ensure(db);
  const listing = listingFilter(query);
  const people = "(l.owner_id=a.owner_id OR EXISTS(SELECT 1 FROM company_team_memberships m WHERE m.agency_id=a.id AND m.user_id=l.owner_id AND m.ended_at IS NULL))";
  const where = ["a.status='approved'"], values: string[] = [];
  const text = textFilter(query, ["a.name"]);
  if (text) { where.push(text.where); values.push(...text.values); }
  if (query.language && isAgentLanguage(query.language)) { where.push(`EXISTS(SELECT 1 FROM agent_languages al WHERE al.languages LIKE ? AND (al.user_id=CAST(a.owner_id AS TEXT) OR EXISTS(SELECT 1 FROM company_team_memberships m2 WHERE m2.agency_id=a.id AND m2.ended_at IS NULL AND CAST(m2.user_id AS TEXT)=al.user_id)))`); values.push(`%"${query.language}"%`); }
  const page = Math.min(500, Math.max(1, Math.floor(query.page || 1)));
  const from = `FROM agencies a JOIN users u ON u.id=a.owner_id JOIN listings l ON ${people} AND ${listing.where.join(" AND ")} WHERE ${where.join(" AND ")}`;
  const total = await db.prepare(`SELECT COUNT(*) AS n FROM (SELECT a.id ${from} GROUP BY a.id) x`).bind(...listing.values, ...values).first<{ n: number }>();
  const recentSince = new Date(at.getTime() - RECENT_DAYS * 86400000).toISOString();
  const rows = (await db.prepare(`SELECT CAST(a.id AS TEXT) AS id,a.name,u.avatar_url,COUNT(l.id) AS listings,${verifiedSql},
      SUM(CASE WHEN l.created_at>=? THEN 1 ELSE 0 END) AS recent,
      1+(SELECT COUNT(*) FROM company_team_memberships m3 WHERE m3.agency_id=a.id AND m3.ended_at IS NULL) AS consultants,
      (SELECT lc.city FROM listings lc WHERE lc.owner_id=a.owner_id AND lc.status='published' GROUP BY lc.city ORDER BY COUNT(*) DESC LIMIT 1) AS main_city,
      (SELECT ld.district FROM listings ld WHERE ld.owner_id=a.owner_id AND ld.status='published' GROUP BY ld.district ORDER BY COUNT(*) DESC LIMIT 1) AS main_district
    ${from} GROUP BY a.id,a.name,u.avatar_url,u.id,u.role,u.agent_status ORDER BY COUNT(l.id) DESC,a.name ASC LIMIT ? OFFSET ?`).bind(recentSince, ...listing.values, ...values, AGENTS_PER_PAGE, (page - 1) * AGENTS_PER_PAGE).all<Record<string, unknown>>()).results || [];
  const offices: OfficeCard[] = [];
  for (const row of rows) {
    const langs = (await db.prepare("SELECT al.languages FROM agent_languages al WHERE al.user_id IN (SELECT CAST(a.owner_id AS TEXT) FROM agencies a WHERE CAST(a.id AS TEXT)=? UNION SELECT CAST(m.user_id AS TEXT) FROM company_team_memberships m WHERE CAST(m.agency_id AS TEXT)=? AND m.ended_at IS NULL)").bind(String(row.id), String(row.id)).all<{ languages: string }>()).results || [];
    offices.push({ id: String(row.id), name: String(row.name || ""), logo: media(row.avatar_url), city: String(row.main_city || ""), district: String(row.main_district || ""), consultants: Number(row.consultants) || 1, listings: Number(row.listings) || 0, recent: Number(row.recent) || 0, languages: [...new Set(langs.flatMap((item) => parseLanguages(item.languages)))], verified: Number(row.owner_verified) === 1 || row.owner_verified === true });
  }
  return { total: Number(total?.n) || 0, page, offices };
}

/** Phone of a listed, approved agent or office consultant for "Telefonu göster"; null otherwise. */
export async function agentPhone(db: AgentDirectoryDatabase, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = await db.prepare("SELECT u.phone FROM users u WHERE CAST(u.id AS TEXT)=? AND ((u.role='agent' AND u.agent_status='approved') OR EXISTS(SELECT 1 FROM company_team_memberships tm JOIN agencies ta ON ta.id=tm.agency_id WHERE tm.user_id=u.id AND tm.ended_at IS NULL AND ta.status='approved')) AND EXISTS(SELECT 1 FROM listings l WHERE l.owner_id=u.id AND l.status='published')").bind(id).first<{ phone: string | null }>();
  return row?.phone ? String(row.phone) : null;
}
