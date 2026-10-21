import type {ChatDatabase} from './messaging-service';
import {REPORT_REASONS,REPORT_RESOLUTIONS,REPORT_STATES} from './report-types';
export class ReportError extends Error{constructor(message:string,public status=400){super(message);}}
export const REPORT_SCHEMA=[
 `CREATE TABLE IF NOT EXISTS listing_reports(id TEXT PRIMARY KEY,listing_id TEXT NOT NULL,reporter_id TEXT NOT NULL,title_snapshot TEXT NOT NULL,reason TEXT NOT NULL,details TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'open',admin_note TEXT NOT NULL DEFAULT '',resolution TEXT NOT NULL DEFAULT '',reviewer_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,last_action TEXT NOT NULL DEFAULT '',UNIQUE(listing_id,reporter_id))`,
 `CREATE INDEX IF NOT EXISTS listing_reports_queue ON listing_reports(state,created_at)`,
 `CREATE INDEX IF NOT EXISTS listing_reports_owner ON listing_reports(reporter_id,created_at)`,
 `CREATE TABLE IF NOT EXISTS listing_report_events(id TEXT PRIMARY KEY,report_id TEXT NOT NULL,actor_id TEXT NOT NULL,actor_name TEXT NOT NULL,action TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL)`,
 `CREATE INDEX IF NOT EXISTS listing_report_events_report ON listing_report_events(report_id,created_at)`,
 `CREATE TABLE IF NOT EXISTS listing_report_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,window_started_at TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS listing_moderation_holds(listing_id TEXT PRIMARY KEY,report_id TEXT NOT NULL,active INTEGER NOT NULL,created_at TEXT NOT NULL,released_at TEXT)`,
 `CREATE TABLE IF NOT EXISTS admin_audit(id uuid PRIMARY KEY,actor_id uuid NOT NULL,actor_name TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT NOT NULL,summary TEXT NOT NULL,created_at TEXT NOT NULL)`,
 `CREATE INDEX IF NOT EXISTS admin_audit_time_idx ON admin_audit(created_at DESC)`
];
export function reportInput(input:Record<string,unknown>){const listingId=typeof input.listingId==='string'?input.listingId.trim():'',reason=typeof input.reason==='string'?input.reason:'',details=typeof input.details==='string'?input.details.trim():'';
 if(!/^[-a-zA-Z0-9]{1,80}$/.test(listingId)||!Object.hasOwn(REPORT_REASONS,reason))throw new ReportError('İlanı ve bildirim nedenini kontrol edin.');
 if(details.length<10||details.length>2000)throw new ReportError('Açıklama 10–2000 karakter olmalıdır.');return {listingId,reason,details};}
export async function reportLimit(db:ChatDatabase,userId:string,at=new Date()){
 const now=at.toISOString(),cutoff=new Date(+at-3600000).toISOString();const row=await db.prepare(`INSERT INTO listing_report_limits(key,count,window_started_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN listing_report_limits.window_started_at>? THEN listing_report_limits.count+1 ELSE 1 END,window_started_at=CASE WHEN listing_report_limits.window_started_at>? THEN listing_report_limits.window_started_at ELSE excluded.window_started_at END RETURNING count`).bind(userId,now,cutoff,cutoff).first<{count:number}>();
 if(!row||Number(row.count)>10)throw new ReportError('Bir saat içinde en fazla 10 bildirim gönderebilirsiniz.',429);
}
export function reviewInput(input:Record<string,unknown>){const id=typeof input.id==='string'?input.id:'',action=typeof input.action==='string'?input.action:'',note=typeof input.note==='string'?input.note.trim():'',resolution=typeof input.resolution==='string'?input.resolution:'',version=Number(input.version);
 if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isInteger(version)||version<1||!['reviewing','resolved','dismissed','reopen','hold_listing'].includes(action))throw new ReportError('Geçersiz inceleme işlemi.');
 if(note.length>2000)throw new ReportError('Yönetici notu en fazla 2000 karakter olabilir.');
 if(['resolved','dismissed','hold_listing'].includes(action)&&note.length<10)throw new ReportError('Karar gerekçesini en az 10 karakterle yazın.');
 if(action==='resolved'&&!Object.hasOwn(REPORT_RESOLUTIONS,resolution))throw new ReportError('Sonuç türünü seçin.');
 return {id,action,note,resolution:action==='hold_listing'?'removed':action==='dismissed'?'no_violation':action==='resolved'?resolution:'',version};}
export function reportTransition(state:string,action:string){
 if(!Object.hasOwn(REPORT_STATES,state))throw new ReportError('Bildirim durumu geçersiz.',409);
 if(action==='reopen'){if(!['resolved','dismissed'].includes(state))throw new ReportError('Bildirim zaten açık.',409);return 'open';}
 if(!['open','reviewing'].includes(state))throw new ReportError('Önce bildirimi yeniden açın.',409);
 if(action==='reviewing'&&state==='reviewing')throw new ReportError('Bildirim zaten inceleniyor.',409);
 return action==='hold_listing'?'resolved':action;
}
