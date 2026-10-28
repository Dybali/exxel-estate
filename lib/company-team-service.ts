export interface TeamDatabase { prepare(sql:string): {bind(...values:(string|number|null)[]):ReturnType<TeamDatabase['prepare']>;first<T>():Promise<T|null>;all<T>():Promise<{results:T[]}>;run():Promise<unknown>}; }
export type TeamActor={id:string;email:string;email_verified:number};
export class TeamError extends Error{constructor(message:string,public status=400){super(message);}}
const timestamp=()=>new Date().toISOString();
export async function inviteTeamMember(db:TeamDatabase,actor:TeamActor,emailInput:string){
 const email=emailInput.trim().toLowerCase();
 if(!actor.email_verified)throw new TeamError('Önce e-posta adresinizi doğrulayın.',403);
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw new TeamError('Geçerli bir e-posta adresi girin.');
 if(email===actor.email.toLowerCase())throw new TeamError('Kendi hesabınıza davet gönderemezsiniz.');
 const company=await db.prepare("SELECT id FROM agencies WHERE owner_id=? AND status='approved'").bind(actor.id).first<{id:string}>();
 if(!company)throw new TeamError('Yalnızca onaylı şirket sahibi davet oluşturabilir.',403);
 const id=crypto.randomUUID(),created=timestamp(),expires=new Date(Date.now()+7*86400000).toISOString();
 await db.prepare('INSERT INTO company_team_invitations(id,agency_id,invited_email,invited_by,created_at,expires_at) VALUES(?,?,?,?,?,?)').bind(id,company.id,email,actor.id,created,expires).run();
 return {id,email,expires};
}
export async function acceptTeamInvitation(db:TeamDatabase,actor:TeamActor,id:string){
 if(!actor.email_verified)throw new TeamError('Önce e-posta adresinizi doğrulayın.',403);
 const now=timestamp(),membershipId=crypto.randomUUID();
 try{
  const row=await db.prepare(`INSERT INTO company_team_memberships(id,agency_id,user_id,invitation_id,joined_at)
    SELECT ?,i.agency_id,?,i.id,? FROM company_team_invitations i
    JOIN agencies a ON a.id=i.agency_id JOIN users u ON u.id=?
    WHERE i.id=? AND i.invited_email=LOWER(u.email) AND u.email_verified=1
      AND i.expires_at>? AND i.revoked_at IS NULL AND i.accepted_at IS NULL
      AND a.status='approved' AND a.owner_id<>u.id AND u.role='buyer'
      AND NOT EXISTS(SELECT 1 FROM agencies own WHERE own.owner_id=u.id)
      AND NOT EXISTS(SELECT 1 FROM company_team_memberships m WHERE m.invitation_id=i.id)
      AND NOT EXISTS(SELECT 1 FROM company_team_memberships m WHERE m.user_id=u.id AND m.ended_at IS NULL)
    ON CONFLICT DO NOTHING RETURNING id`).bind(membershipId,actor.id,now,actor.id,id,now).first<{id:string}>();
  if(!row)throw new TeamError('Davet geçersiz, süresi dolmuş veya hesabınız ekip üyeliği için uygun değil. Danışmanlar kullanıcı hesabıyla katılabilir.',409);
  await db.prepare('UPDATE company_team_invitations SET accepted_at=? WHERE id=?').bind(now,id).run();
  return {id:row.id};
 }catch(e){if(e instanceof TeamError)throw e;throw e;}
}
export async function endTeamMembership(db:TeamDatabase,actor:TeamActor,membershipId:string){
 const now=timestamp();
 const result=await db.prepare(`UPDATE company_team_memberships SET ended_at=? WHERE id=? AND ended_at IS NULL AND (user_id=? OR agency_id IN (SELECT id FROM agencies WHERE owner_id=?)) RETURNING id`).bind(now,membershipId,actor.id,actor.id).first<{id:string}>();
 if(!result)throw new TeamError('Ekip üyeliği bulunamadı veya yetkiniz yok.',404);
 return {success:true};
}

const normalizedCode=(value:string)=>value.toUpperCase().replace(/[\s-]/g,'');
async function hashCode(value:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
export async function createTeamCode(db:TeamDatabase,actor:TeamActor){
 if(!actor.email_verified)throw new TeamError('Önce e-posta adresinizi doğrulayın.',403);
 const company=await db.prepare("SELECT id FROM agencies WHERE owner_id=? AND status='approved'").bind(actor.id).first<{id:string}>();
 if(!company)throw new TeamError('Yalnızca onaylı şirket sahibi kod oluşturabilir.',403);
 const code=Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
 const id=crypto.randomUUID(),created=timestamp(),expires=new Date(Date.now()+7*86400000).toISOString();
 await db.prepare('INSERT INTO company_team_invitations(id,agency_id,invited_email,invited_by,created_at,expires_at) VALUES(?,?,?,?,?,?)').bind(id,company.id,'',actor.id,created,expires).run();
 await db.prepare('INSERT INTO company_team_codes(invitation_id,code_hash) VALUES(?,?)').bind(id,await hashCode(code)).run();
 return {id,code,expires};
}
export async function redeemTeamCode(db:TeamDatabase,actor:TeamActor,rawCode:string){
 if(!actor.email_verified)throw new TeamError('Önce e-posta adresinizi doğrulayın.',403);
 const code=normalizedCode(rawCode);if(!/^[0-9A-F]{16}$/.test(code))throw new TeamError('Geçerli şirket kodunu girin.');
 const now=timestamp(),memberId=crypto.randomUUID();
 const result=await db.prepare(`INSERT INTO company_team_memberships(id,agency_id,user_id,invitation_id,joined_at)
 SELECT ?,i.agency_id,?,i.id,? FROM company_team_codes c JOIN company_team_invitations i ON i.id=c.invitation_id
 JOIN agencies a ON a.id=i.agency_id JOIN users u ON u.id=?
 WHERE c.code_hash=? AND i.expires_at>? AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND a.status='approved'
 AND u.email_verified=1 AND u.role='buyer' AND a.owner_id<>u.id
 AND NOT EXISTS(SELECT 1 FROM agencies own WHERE own.owner_id=u.id)
 AND NOT EXISTS(SELECT 1 FROM company_team_memberships m WHERE m.invitation_id=i.id)
 AND NOT EXISTS(SELECT 1 FROM company_team_memberships m WHERE m.user_id=u.id AND m.ended_at IS NULL)
 ON CONFLICT DO NOTHING RETURNING id,invitation_id`).bind(memberId,actor.id,now,actor.id,await hashCode(code),now).first<{id:string;invitation_id:string}>();
 if(!result)throw new TeamError('Kod geçersiz, kullanılmış veya süresi dolmuş; ya da hesabınız ekip üyeliği için uygun değil.',409);
 await db.prepare('UPDATE company_team_invitations SET accepted_at=?,invited_email=? WHERE id=?').bind(now,actor.email.toLowerCase(),result.invitation_id).run();
 return {success:true};
}
