import type { ChatDatabase } from './messaging-service';
export const PROFILE_SCHEMA = `CREATE TABLE IF NOT EXISTS seller_profiles (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, bio text NOT NULL DEFAULT '', updated_at text NOT NULL)`;
export async function ensureProfiles(database: ChatDatabase){await database.prepare(PROFILE_SCHEMA).run();}
export function profilePage(value:string|null){const page=Number(value||1);return Number.isInteger(page)&&page>0?Math.min(page,1000):1;}
export function validProfileImage(value:string,userId:string){const parts=value.split('/');return parts.length===6&&parts.slice(0,4).join('/')==='/api/media/listings'&&parts[4]===userId&&/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(parts[5]);}
export const PROFILE_ID=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
/** Whether /profil/<id> has a seller to show (the same accounts /api/profiles/<id> answers for). */
export async function publicProfileExists(database: ChatDatabase, id: string){if(!PROFILE_ID.test(id))return false;if(await database.prepare("SELECT id FROM users WHERE id=? AND role IN ('individual','agent','admin')").bind(id).first())return true;return isTeamConsultant(database,id);}

// Office consultants (owner's request 2026-11-23): a consultant who joined an approved office as a team member keeps
// a buyer/individual account role but has a public profile too; it shows their own listings and, on a second tab,
// every listing of their office (the owner's and all active team members').
export const TEAM_CONSULTANT_SQL = "EXISTS(SELECT 1 FROM company_team_memberships tm JOIN agencies ta ON ta.id=tm.agency_id WHERE tm.user_id=u.id AND tm.ended_at IS NULL AND ta.status='approved')";
export async function isTeamConsultant(database: ChatDatabase, id: string) {
  if (!PROFILE_ID.test(id)) return false;
  return Boolean(await database.prepare(`SELECT u.id FROM users u WHERE u.id=? AND ${TEAM_CONSULTANT_SQL}`).bind(id).first().catch(() => null));
}
export type ProfileOffice = { id: string; name: string; ownerId: string; logo: string | null };
/** The office a seller works for: their active team membership, else an approved office they own. */
export async function profileOffice(database: ChatDatabase, id: string): Promise<ProfileOffice | null> {
  const team = await database.prepare("SELECT CAST(a.id AS TEXT) AS id,a.name,CAST(a.owner_id AS TEXT) AS owner_id,o.avatar_url FROM company_team_memberships m JOIN agencies a ON a.id=m.agency_id JOIN users o ON o.id=a.owner_id WHERE m.user_id=? AND m.ended_at IS NULL AND a.status='approved' LIMIT 1").bind(id).first<Record<string, unknown>>().catch(() => null);
  const row = team || await database.prepare("SELECT CAST(a.id AS TEXT) AS id,a.name,CAST(a.owner_id AS TEXT) AS owner_id,o.avatar_url FROM agencies a JOIN users o ON o.id=a.owner_id WHERE a.owner_id=? AND a.status='approved' LIMIT 1").bind(id).first<Record<string, unknown>>().catch(() => null);
  if (!row) return null;
  const logo = typeof row.avatar_url === "string" && row.avatar_url.startsWith("/") ? row.avatar_url : null;
  return { id: String(row.id), name: String(row.name || ""), ownerId: String(row.owner_id), logo };
}
/** WHERE part for the listings of an office: its owner's and its active team members'. Binds ownerId, officeId. */
export const OFFICE_LISTINGS_SQL = "(l.owner_id=? OR EXISTS(SELECT 1 FROM company_team_memberships om WHERE CAST(om.agency_id AS TEXT)=? AND om.user_id=l.owner_id AND om.ended_at IS NULL))";
