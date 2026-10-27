import {body,currentUser,db,error,isAdmin,now,ok,sameOrigin,str} from '@/lib/server';
import {AGENT_PLANS_ENABLED} from '@/lib/publication-policy';
import {agentPlanDB} from '@/lib/agent-plan';
import {officeDB} from '@/lib/office-verification-server';

const planLimits:Record<string,number>={professional:5,prestige:20};
type Agent={id:string;role:string;agent_status:string;company:string|null;verification_state:string|null};

export async function GET(request:Request){
 const admin=await currentUser(request);
 if(!admin?.email_verified||!isAdmin(admin))return error('Yönetici yetkisi gerekli.',403);
 await agentPlanDB();
 const rows=await db().prepare("SELECT g.id,g.user_id,g.plan_id,g.listing_limit,g.starts_at,g.ends_at,g.revoked_at,g.note,g.created_at,u.name,u.email,u.company,(SELECT count(*) FROM listings l WHERE l.owner_id=g.user_id AND l.status IN ('pending','published')) AS used FROM agent_plan_grants g JOIN users u ON u.id=g.user_id ORDER BY g.created_at DESC LIMIT 200").all();
 return ok({grants:rows.results||[]},{headers:{'Cache-Control':'private, no-store'}});
}

export async function POST(request:Request){
 if(!sameOrigin(request))return error('Geçersiz kaynak.',403);
 const admin=await currentUser(request);
 if(!admin?.email_verified||!isAdmin(admin))return error('Yönetici yetkisi gerekli.',403);
 if(!AGENT_PLANS_ENABLED)return error('Fiyatlar belirlenene kadar paket işlemleri kapalıdır. Emlakçılar paket olmadan ilan verebilir.',409);
 await agentPlanDB();await officeDB();
 let input:Record<string,unknown>;try{input=await body(request);}catch{return error('Geçersiz istek.');}
 const action=str(input.action,20),userId=str(input.userId,80),grantId=str(input.grantId,80);
 if(action==='revoke'){
  if(!/^[0-9a-f-]{36}$/i.test(grantId))return error('Geçersiz paket kaydı.');
  const grant=await db().prepare('SELECT user_id FROM agent_plan_grants WHERE id=? AND revoked_at IS NULL').bind(grantId).first<{user_id:string}>();
  if(!grant)return error('Aktif paket bulunamadı.',404);
  const stamp=now();
  await db().batch([db().prepare('UPDATE users SET name=name WHERE id=?').bind(grant.user_id),db().prepare('UPDATE agent_plan_grants SET revoked_at=? WHERE id=? AND revoked_at IS NULL').bind(stamp,grantId),db().prepare('INSERT INTO admin_audit(id,actor_id,actor_name,action,target_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),admin.id,admin.name,'plan_revoke',grant.user_id,grantId,stamp)]);
  return ok({success:true});
 }
 if(action!=='grant')return error('Geçersiz işlem.');
 if(!/^[0-9a-f-]{36}$/i.test(userId))return error('Geçersiz emlakçı.');
 const planId=str(input.planId,30),limit=planLimits[planId],months=Number(input.months),note=str(input.note,500);
 if(!limit||!Number.isInteger(months)||months<1||months>24)return error('Paket ve süreyi kontrol edin.');
 const agent=await db().prepare("SELECT u.id,u.role,u.agent_status,u.company,v.state AS verification_state FROM users u LEFT JOIN office_verifications v ON v.user_id=CAST(u.id AS TEXT) AND v.company_snapshot=u.company WHERE u.id=?").bind(userId).first<Agent>();
 if(!agent||agent.role!=='agent')return error('Emlakçı hesabı bulunamadı.',404);
 if(agent.agent_status!=='approved'||agent.verification_state!=='approved')return error('Ücretsiz paket için önce ofis belgesi ve emlakçı hesabı onaylanmalı.',403);
 const start=new Date(),end=new Date(start);
 end.setUTCMonth(end.getUTCMonth()+months);
 const stamp=start.toISOString(),endsAt=end.toISOString(),id=crypto.randomUUID();
 await db().batch([
  db().prepare('UPDATE users SET name=name WHERE id=?').bind(userId),
  db().prepare('UPDATE agent_plan_grants SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(stamp,userId),
  db().prepare('INSERT INTO agent_plan_grants(id,user_id,plan_id,listing_limit,starts_at,ends_at,note,granted_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,userId,planId,limit,stamp,endsAt,note,admin.id,stamp),
  db().prepare('INSERT INTO admin_audit(id,actor_id,actor_name,action,target_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),admin.id,admin.name,'plan_grant',userId,`${planId} · ${months} ay ücretsiz · ${limit} eş zamanlı ilan${note?' · '+note:''}`,stamp)
 ]);
 return ok({success:true,id,endsAt});
}
