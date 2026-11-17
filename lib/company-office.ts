// Estate office page (/sirketler/[id]) like the big portals (owner's request 2026-11-17): the office owner and
// the team's consultants with their titles, "Danışmanın ilanları" (the office's listings of one consultant),
// the languages the office serves (union of the team's languages, lib/agent-directory.ts) and the licence.
// Titles live in company_team_titles (created with the team tables, lib/company-team-server.ts).
interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type OfficeDatabase = { prepare(sql: string): Statement };

export const TEAM_TITLES = { owner: "Ofis sahibi", manager: "Ofis müdürü", senior: "Kıdemli gayrimenkul danışmanı", consultant: "Gayrimenkul danışmanı", assistant: "Asistan danışman" } as const;
export type TeamTitle = keyof typeof TEAM_TITLES;
export const isTeamTitle = (value: unknown): value is TeamTitle => typeof value === "string" && value in TEAM_TITLES;
export const TEAM_TITLE_SCHEMA = "CREATE TABLE IF NOT EXISTS company_team_titles(agency_id TEXT NOT NULL,user_id TEXT NOT NULL,title TEXT NOT NULL,PRIMARY KEY(agency_id,user_id))";

export type OfficeMember = { id: string; name: string; avatar_url: string | null; listing_count: number; title: TeamTitle; owner: boolean; languages: string[] };
const languagesOf = (value: unknown) => { try { const list = JSON.parse(String(value || "[]")); return Array.isArray(list) ? list.filter((item): item is string => typeof item === "string" && /^[a-z]{2}$/.test(item)) : []; } catch { return []; } };

/** The owner first, then active consultants by name; each with the office listings they published. */
export async function officeTeam(db: OfficeDatabase, office: { id: string; owner_id: string }): Promise<OfficeMember[]> {
  const languages = "(SELECT al.languages FROM agent_languages al WHERE al.user_id=CAST(u.id AS TEXT))";
  const title = "(SELECT t.title FROM company_team_titles t WHERE t.agency_id=CAST(? AS TEXT) AND t.user_id=CAST(u.id AS TEXT))";
  const owner = await db.prepare(`SELECT CAST(u.id AS TEXT) AS id,u.name,u.avatar_url,${languages} AS languages,${title} AS title,
      (SELECT COUNT(*) FROM listings l WHERE l.owner_id=u.id AND (l.agency_id IS NULL OR l.agency_id=?) AND l.status='published') AS listing_count
    FROM users u WHERE u.id=?`).bind(office.id, office.id, office.owner_id).first<Record<string, unknown>>();
  const members = (await db.prepare(`SELECT CAST(u.id AS TEXT) AS id,u.name,u.avatar_url,${languages} AS languages,${title} AS title,
      (SELECT COUNT(*) FROM listings l WHERE l.owner_id=u.id AND l.agency_id=m.agency_id AND l.status='published') AS listing_count
    FROM company_team_memberships m JOIN users u ON u.id=m.user_id WHERE m.agency_id=? AND m.ended_at IS NULL ORDER BY u.name`).bind(office.id, office.id).all<Record<string, unknown>>()).results || [];
  const row = (value: Record<string, unknown>, isOwner: boolean): OfficeMember => ({
    id: String(value.id), name: String(value.name || ""), avatar_url: typeof value.avatar_url === "string" && value.avatar_url.startsWith("/api/media/") ? value.avatar_url : null,
    listing_count: Number(value.listing_count) || 0, title: isTeamTitle(value.title) ? value.title : isOwner ? "owner" : "consultant", owner: isOwner, languages: languagesOf(value.languages),
  });
  return [...(owner ? [row(owner, true)] : []), ...members.map((member) => row(member, false))];
}

/** Languages the office serves: every language of its owner and consultants, Turkish first. */
export const officeLanguages = (team: OfficeMember[]) => [...new Set(team.flatMap((member) => member.languages))].sort((a, b) => (a === "tr" ? -1 : b === "tr" ? 1 : 0));

/** Listing filter for "Danışmanın ilanları": the owner's own and office listings, or one consultant's office listings. */
export function consultantFilter(office: { id: string; owner_id: string }, team: OfficeMember[], consultantId: string | null) {
  const member = consultantId ? team.find((item) => item.id === consultantId) : null;
  if (!member) return { where: "((l.owner_id=? AND l.agency_id IS NULL) OR l.agency_id=?)", values: [office.owner_id, office.id], member: null };
  return member.owner
    ? { where: "(l.owner_id=? AND (l.agency_id IS NULL OR l.agency_id=?))", values: [office.owner_id, office.id], member }
    : { where: "(l.owner_id=? AND l.agency_id=?)", values: [member.id, office.id], member };
}

/** Office owner sets a consultant's (or their own) title. */
export async function setTeamTitle(db: OfficeDatabase, ownerId: string, userId: unknown, title: unknown) {
  if (!isTeamTitle(title) || typeof userId !== "string") throw new Error("Geçersiz unvan.");
  const office = await db.prepare("SELECT id,owner_id FROM agencies WHERE owner_id=? AND status='approved'").bind(ownerId).first<{ id: string; owner_id: string }>();
  if (!office) throw new Error("Şirket sahibi yetkisi gerekli.");
  const allowed = String(office.owner_id) === userId || await db.prepare("SELECT 1 AS ok FROM company_team_memberships WHERE agency_id=? AND CAST(user_id AS TEXT)=? AND ended_at IS NULL").bind(office.id, userId).first();
  if (!allowed) throw new Error("Ekip üyesi bulunamadı.");
  await db.prepare("INSERT INTO company_team_titles(agency_id,user_id,title) VALUES(?,?,?) ON CONFLICT(agency_id,user_id) DO UPDATE SET title=excluded.title").bind(String(office.id), userId, title).run();
}
