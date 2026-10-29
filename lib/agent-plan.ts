import {db,now} from './server';

let initialized:Promise<void>|undefined;
// First production publication of package controls; later cold starts must not
// grandfather agents who registered after this release.
const ROLLOUT_AT='2026-10-27T07:56:43.609Z';
export async function agentPlanDB(){
 if(!initialized)initialized=(async()=>{
  await db().prepare("CREATE TABLE IF NOT EXISTS agent_plan_grants (id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,plan_id text NOT NULL CHECK(plan_id IN ('professional','prestige')),listing_limit integer NOT NULL CHECK(listing_limit BETWEEN 1 AND 100),starts_at text NOT NULL,ends_at text NOT NULL,revoked_at text,note text NOT NULL DEFAULT '',granted_by uuid NOT NULL REFERENCES users(id),created_at text NOT NULL,CHECK(ends_at>starts_at))").run();
  await db().prepare('CREATE INDEX IF NOT EXISTS agent_plan_grants_user_idx ON agent_plan_grants(user_id,ends_at DESC)').run();
  await db().prepare('CREATE UNIQUE INDEX IF NOT EXISTS agent_plan_grants_one_active_idx ON agent_plan_grants(user_id) WHERE revoked_at IS NULL').run();
  await db().prepare('CREATE TABLE IF NOT EXISTS agent_plan_rollout (id integer PRIMARY KEY CHECK(id=1),activated_at text NOT NULL)').run();
  await db().prepare('INSERT INTO agent_plan_rollout(id,activated_at) VALUES(1,?) ON CONFLICT(id) DO NOTHING').bind(ROLLOUT_AT).run();
 })().catch(cause=>{initialized=undefined;throw cause;});
 await initialized;
}

type Access={created_at:string;activated_at:string;grant_id:string|null;listing_limit:number|null;used:number;had_grant:number};
export async function agentPlanAccess(userId:string){
 await agentPlanDB();
 const stamp=now();
 const row=await db().prepare("SELECT u.created_at,r.activated_at,g.id AS grant_id,g.listing_limit,(SELECT count(*) FROM listings l WHERE l.owner_id=u.id AND l.status IN ('pending','published')) AS used,(SELECT count(*) FROM agent_plan_grants h WHERE h.user_id=u.id) AS had_grant FROM users u CROSS JOIN agent_plan_rollout r LEFT JOIN agent_plan_grants g ON g.user_id=u.id AND g.revoked_at IS NULL AND g.starts_at<=? AND g.ends_at>? WHERE u.id=? AND r.id=1").bind(stamp,stamp,userId).first<Access>();
 if(!row)return {allowed:false,reason:'Paket bilgisi yüklenemedi.'};
 const legacy=String(row.created_at)<String(row.activated_at)&&Number(row.had_grant)===0;
 if(legacy)return {allowed:true,legacy:true};
 if(!row.grant_id)return {allowed:false,reason:'İlan verebilmek için aktif paketiniz bulunmalı. Yöneticiyle iletişime geçin.'};
 if(Number(row.used)>=Number(row.listing_limit))return {allowed:false,reason:`Paketinizin eş zamanlı ilan hakkı doldu: ${row.listing_limit}`};
 return {allowed:true,legacy:false};
}

// Rechecked inside the listing transaction, after locking the user's row.
export const agentInsertGuard="EXISTS (SELECT 1 FROM users u CROSS JOIN agent_plan_rollout r WHERE u.id=? AND r.id=1 AND ((u.created_at<r.activated_at AND NOT EXISTS(SELECT 1 FROM agent_plan_grants h WHERE h.user_id=u.id)) OR EXISTS(SELECT 1 FROM agent_plan_grants g WHERE g.user_id=u.id AND g.revoked_at IS NULL AND g.starts_at<=? AND g.ends_at>? AND (SELECT count(*) FROM listings l WHERE l.owner_id=u.id AND l.status IN ('pending','published'))<g.listing_limit)))";
