// Only call with an identity returned by Neon Auth's server-side getSession().
// Browser-supplied IDs/emails are never proof of identity.
import type {ChatDatabase} from './messaging-service';
export type VerifiedNeonIdentity={id:string;email:string;emailVerified:boolean;name?:string};
export type IdentityRegistration={role?:string;name?:string;company?:string;companyCategory?:string};
export class NeonIdentityError extends Error{constructor(message:string,public status=400){super(message);}}
const userFields='u.id,u.email,u.email_verified,u.name,u.role,u.agent_status,u.phone,u.whatsapp_enabled,u.company,u.avatar_url';
export async function findNeonAccount(database:ChatDatabase,identity:VerifiedNeonIdentity){
 if(!identity?.emailVerified||!identity.id||identity.id.length>256||!/^\S+@\S+\.\S+$/.test(identity.email||''))throw new NeonIdentityError('Önce e-posta adresinizi doğrulayın.',403);
 const email=identity.email.trim().toLowerCase();
 const linked=await database.prepare('SELECT '+userFields+' FROM oauth_accounts a JOIN users u ON u.id=a.user_id WHERE a.provider=? AND a.provider_user_id=?').bind('neon',identity.id).first<Record<string,unknown>>();
 if(linked){if(String(linked.email).toLowerCase()!==email)throw new NeonIdentityError('Hesap e-posta eşleştirmesi kontrol edilmeli.',409);return {user:linked,linked:true,email};}
 const existing=await database.prepare('SELECT '+userFields+' FROM users u WHERE LOWER(u.email)=?').bind(email).first<Record<string,unknown>>();
 if(existing){const other=await database.prepare('SELECT provider_user_id FROM oauth_accounts WHERE user_id=? AND provider=?',[0]).bind(String(existing.id),'neon').first<{provider_user_id:string}>();if(other)throw new NeonIdentityError('Bu hesap başka bir Neon kimliğine bağlı.',409);}
 return {user:existing,linked:false,email};
}
// Existing application UUIDs and roles remain authoritative, preserving all foreign keys.
export async function linkNeonAccount(database:ChatDatabase,identity:VerifiedNeonIdentity){
 const account=await findNeonAccount(database,identity);if(!account.user||account.linked)return account;
 await database.prepare('INSERT INTO oauth_accounts(provider,provider_user_id,user_id,created_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING',[2]).bind('neon',identity.id,String(account.user.id),new Date().toISOString()).run();
 // Re-read after conflict: concurrent requests may not reassign an existing identity.
 const result=await findNeonAccount(database,identity);if(!result.linked||result.user?.id!==account.user.id)throw new NeonIdentityError('Kimlik eşleştirmesi tamamlanamadı.',409);return result;
}
