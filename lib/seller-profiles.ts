import type { ChatDatabase } from './messaging-service';
export const PROFILE_SCHEMA = `CREATE TABLE IF NOT EXISTS seller_profiles (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, bio text NOT NULL DEFAULT '', updated_at text NOT NULL)`;
export async function ensureProfiles(database: ChatDatabase){await database.prepare(PROFILE_SCHEMA).run();}
export function profilePage(value:string|null){const page=Number(value||1);return Number.isInteger(page)&&page>0?Math.min(page,1000):1;}
export function validProfileImage(value:string,userId:string){const parts=value.split('/');return parts.length===6&&parts.slice(0,4).join('/')==='/api/media/listings'&&parts[4]===userId&&/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(parts[5]);}
export const PROFILE_ID=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
/** Whether /profil/<id> has a seller to show (the same accounts /api/profiles/<id> answers for). */
export async function publicProfileExists(database: ChatDatabase, id: string){if(!PROFILE_ID.test(id))return false;return Boolean(await database.prepare("SELECT id FROM users WHERE id=? AND role IN ('individual','agent','admin')").bind(id).first());}
