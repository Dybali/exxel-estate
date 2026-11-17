import {consumeRecoveryLimit,RecoveryError} from '@/lib/recovery-service';
import {body,currentUser,error,ok,sameOrigin,str,sha256} from '@/lib/server';
import {statisticsDB} from '@/lib/listing-statistics-server';
import {teamDB} from '@/lib/company-team-server';
import {setTeamTitle} from '@/lib/company-office';
import {notifyTeamInvitation} from '@/lib/team-emails';
import {env,waitUntil} from '@/lib/runtime';
import {siteUrl} from '@/lib/request-context';
import type {EmailSettings} from '@/lib/email';
import {inviteTeamMember,acceptTeamInvitation,endTeamMembership,createTeamCode,redeemTeamCode,TeamError} from '@/lib/company-team-service';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 const user=await currentUser(request);if(!user?.email_verified)return error('Giriş ve e-posta doğrulaması gerekli.',401);
 const database=await teamDB(),stamp=new Date().toISOString();
 const [invitations,membership,company]=await Promise.all([
  database.prepare(`SELECT i.id,a.name,i.expires_at FROM company_team_invitations i JOIN agencies a ON a.id=i.agency_id WHERE i.invited_email=? AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at>? AND a.status='approved' ORDER BY i.created_at DESC`).bind(user.email.toLowerCase(),stamp).all(),
  database.prepare(`SELECT m.id,a.name FROM company_team_memberships m JOIN agencies a ON a.id=m.agency_id WHERE m.user_id=? AND m.ended_at IS NULL`).bind(user.id).first(),
  database.prepare(`SELECT id,name,status FROM agencies WHERE owner_id=?`).bind(user.id).first<{id:string;name:string;status:string}>()
 ]);
 let team:unknown[]=[],sent:unknown[]=[],listings:unknown[]=[];
 if(company){await statisticsDB();const [members,invites]=await Promise.all([
 database.prepare(`SELECT m.id,u.id AS user_id,u.name,u.avatar_url,m.joined_at,(SELECT t.title FROM company_team_titles t WHERE t.agency_id=CAST(m.agency_id AS TEXT) AND t.user_id=CAST(u.id AS TEXT)) AS title, COUNT(l.id) AS listing_count, (SELECT COUNT(*) FROM listing_view_daily v JOIN listings x ON CAST(x.id AS TEXT)=v.listing_id WHERE x.owner_id=u.id AND x.agency_id=m.agency_id) AS views, (SELECT COUNT(*) FROM favorites f JOIN listings x ON CAST(x.id AS TEXT)=CAST(f.listing_id AS TEXT) WHERE x.owner_id=u.id AND x.agency_id=m.agency_id) AS favorites, (SELECT COUNT(*) FROM messages msg JOIN listings x ON CAST(x.id AS TEXT)=CAST(msg.listing_id AS TEXT) WHERE x.owner_id=u.id AND x.agency_id=m.agency_id AND msg.recipient_id=u.id AND msg.sender_id<>u.id) AS messages FROM company_team_memberships m JOIN users u ON u.id=m.user_id LEFT JOIN listings l ON l.owner_id=u.id AND l.agency_id=m.agency_id WHERE m.agency_id=? AND m.ended_at IS NULL GROUP BY m.id,m.agency_id,u.id,u.name,u.avatar_url,m.joined_at ORDER BY u.name`).bind(company.id).all(),
 database.prepare(`SELECT id,invited_email,expires_at,revoked_at,accepted_at FROM company_team_invitations WHERE agency_id=? ORDER BY created_at DESC LIMIT 100`).bind(company.id).all()]);team=members.results;sent=invites.results;
 const results=await database.prepare(`SELECT l.id,l.title,l.status,u.name AS agent_name,CASE WHEN f.listing_id IS NULL THEN 0 ELSE 1 END AS selected FROM listings l JOIN users u ON u.id=l.owner_id LEFT JOIN company_featured_listings f ON f.agency_id=? AND f.listing_id=l.id WHERE (l.owner_id=? AND l.agency_id IS NULL) OR l.agency_id=? ORDER BY l.created_at DESC LIMIT 200`).bind(company.id,user.id,company.id).all();listings=results.results; }
 return ok({invitations:invitations.results,membership,company,team,sent,listings},{headers});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return error('Geçersiz kaynak.',403);const user=await currentUser(request);if(!user?.email_verified)return error('Giriş ve e-posta doğrulaması gerekli.',401);
 try{const data=await body(request),database=await teamDB(),action=str(data.action,20),id=str(data.id,36);
 if(action==='create_code'||action==='redeem_code'){await consumeRecoveryLimit(database,await sha256('team-code:'+action+':'+user.id),action==='create_code'?20:12);if(action==='create_code')return ok(await createTeamCode(database,user),{headers});return ok(await redeemTeamCode(database,user,str(data.code,40)),{headers});}
 // Consultant title on the office page (lib/company-office.ts).
 if(action==='title'){try{await setTeamTitle(database as never,user.id,str(data.userId,36),str(data.title,20));}catch(e){return error((e as Error).message,403);}return ok({success:true},{headers});}
 if(action==='invite'){const invited=await inviteTeamMember(database,user,str(data.email,254));
  // The invited person gets an e-mail with the way in (lib/team-emails.ts); a missing mailer never blocks the invitation.
  try{const office=await database.prepare("SELECT name FROM agencies WHERE owner_id=?").bind(user.id).first<{name:string}>();waitUntil(notifyTeamInvitation({...(env as unknown as EmailSettings),SITE_URL:siteUrl()},{email:invited.email,officeName:office?.name||'estatemarket24',expires:invited.expires}).catch(()=>{}));}catch{}
  return ok(invited,{headers});}
 if(action==='accept')return ok(await acceptTeamInvitation(database,user,id),{headers});
 if(action==='remove')return ok(await endTeamMembership(database,user,id),{headers});
 if(action==='feature'){
  const company=await database.prepare("SELECT id FROM agencies WHERE owner_id=? AND status='approved'").bind(user.id).first<{id:string}>();if(!company)return error('Şirket sahibi yetkisi gerekli.',403);
  if(data.enabled===true){const row=await database.prepare(`INSERT INTO company_featured_listings(agency_id,listing_id,created_at) SELECT ?,l.id,? FROM listings l WHERE l.id=? AND ((l.owner_id=? AND l.agency_id IS NULL) OR l.agency_id=?) AND l.status='published' ON CONFLICT DO NOTHING RETURNING listing_id`).bind(company.id,new Date().toISOString(),id,user.id,company.id).first();if(!row)return error('Yayındaki ilan bulunamadı veya zaten seçili.',409);}
  else await database.prepare('DELETE FROM company_featured_listings WHERE agency_id=? AND listing_id=?').bind(company.id,id).run();
  return ok({success:true},{headers});
 }
 if(action==='revoke'){const row=await database.prepare(`UPDATE company_team_invitations SET revoked_at=? WHERE id=? AND accepted_at IS NULL AND revoked_at IS NULL AND agency_id IN (SELECT id FROM agencies WHERE owner_id=?) RETURNING id`).bind(new Date().toISOString(),id,user.id).first();if(!row)return error('Davet bulunamadı veya yetkiniz yok.',404);return ok({success:true},{headers});}
 return error('Geçersiz işlem.');
 }catch(e){if(e instanceof TeamError||e instanceof RecoveryError)return error(e.message,e.status);return error('Ekip işlemi tamamlanamadı.',500);}
}
