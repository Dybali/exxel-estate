import {body,currentUser,error,isAdmin,now,ok,sameOrigin,str} from '@/lib/server';
import {officeDB} from '@/lib/office-verification-server';
import {reportsDB} from '@/lib/reports-server';
import {OFFICE_PUBLIC_FIELDS,type OfficeVerification} from '@/lib/office-verification';
export async function GET(request:Request){
 const user=await currentUser(request);if(!user?.email_verified||!isAdmin(user))return error('Yönetici yetkisi gerekli.',403);
 const database=await officeDB(),q=new URL(request.url).searchParams,state=q.get('state')||'pending',page=Math.floor(Math.max(1,Math.min(10000,Number(q.get('page'))||1)));
 if(!['pending','approved','rejected'].includes(state))return error('Geçersiz durum.');
 const rows=await database.prepare(`SELECT ${OFFICE_PUBLIC_FIELDS.split(',').map(x=>'v.'+x).join(',')},u.name,u.email,u.company,u.agent_status,a.category AS company_category,d.contact_name AS applicant_name,d.phone AS applicant_phone,d.address AS office_address,d.tax_number FROM office_verifications v JOIN users u ON CAST(u.id AS TEXT)=v.user_id LEFT JOIN agencies a ON a.owner_id=u.id LEFT JOIN office_application_details d ON d.user_id=v.user_id AND d.document_id=v.document_id WHERE v.state=? ORDER BY v.updated_at DESC LIMIT 25 OFFSET ?`).bind(state,(page-1)*25).all();
 const count=await database.prepare('SELECT COUNT(*) AS n FROM office_verifications WHERE state=?').bind(state).first<{n:number}>();
 return ok({verifications:rows.results,total:Number(count?.n||0),page},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return error('Geçersiz kaynak.',403);
 const user=await currentUser(request);if(!user?.email_verified||!isAdmin(user))return error('Yönetici yetkisi gerekli.',403);
 let data:Record<string,unknown>;try{data=await body(request);}catch{return error('Geçersiz istek.');}
 const id=str(data.id,80),state=str(data.state,20),note=str(data.note,1000),version=Number(data.version);
 if(!['approved','rejected'].includes(state)||!Number.isInteger(version))return error('Geçersiz karar.');
 if(state==='rejected'&&note.length<5)return error('Düzeltme nedenini en az 5 karakterle yazın.');
 const database=await officeDB();await reportsDB();
 const record=await database.prepare('SELECT v.*,u.company,u.role FROM office_verifications v JOIN users u ON CAST(u.id AS TEXT)=v.user_id WHERE v.user_id=?').bind(id).first<OfficeVerification&{company:string;role:string}>();
 if(!record)return error('Belge bulunamadı.',404);
 if(record.state!=='pending'||record.version!==version)return error('Belge daha önce incelendi. Listeyi yenileyin.',409);
 if(record.role!=='agent'||(state==='approved'&&record.company!==record.company_snapshot))return error('Ofis bilgileri değişmiş. Belgeyi reddedip güncel başvuru isteyin.',409);
 const stamp=now(),action=crypto.randomUUID();
 const pending=state==='approved'?await database.prepare("SELECT id FROM listings WHERE owner_id=? AND status='pending' AND review_note IS NULL AND (expires_at IS NULL OR expires_at>?) AND NOT EXISTS(SELECT 1 FROM listing_moderation_holds h WHERE h.listing_id=CAST(listings.id AS TEXT) AND h.active=1)").bind(id,stamp).all<{id:string}>():{results:[]};
 await database.batch([
  database.prepare('UPDATE users SET company=company WHERE CAST(id AS TEXT)=?').bind(id),
  database.prepare("UPDATE office_verifications SET state=?,note=?,version=version+1,reviewer_id=?,reviewed_at=?,updated_at=?,last_action=? WHERE user_id=? AND state='pending' AND version=? AND (?='rejected' OR EXISTS(SELECT 1 FROM users u WHERE CAST(u.id AS TEXT)=office_verifications.user_id AND u.role='agent' AND u.company=office_verifications.company_snapshot))").bind(state,note,user.id,stamp,stamp,action,id,version,state),
  database.prepare('UPDATE users SET agent_status=? WHERE CAST(id AS TEXT)=? AND EXISTS(SELECT 1 FROM office_verifications WHERE user_id=? AND last_action=?)').bind(state,id,id,action),
  database.prepare('UPDATE agencies SET status=? WHERE CAST(owner_id AS TEXT)=? AND EXISTS(SELECT 1 FROM office_verifications WHERE user_id=? AND last_action=?)').bind(state,id,id,action),
  ...(state==='approved'?[database.prepare("UPDATE listings SET status='published',published_at=COALESCE(published_at,?),updated_at=?,reviewed_by=?,reviewed_at=? WHERE owner_id=? AND status='pending' AND review_note IS NULL AND (expires_at IS NULL OR expires_at>?) AND NOT EXISTS(SELECT 1 FROM listing_moderation_holds h WHERE h.listing_id=CAST(listings.id AS TEXT) AND h.active=1) AND EXISTS(SELECT 1 FROM office_verifications WHERE user_id=? AND state='approved' AND last_action=?)").bind(stamp,stamp,user.id,stamp,id,stamp,id,action)]:[]),
  database.prepare("INSERT INTO admin_audit(id,actor_id,actor_name,action,target_id,summary,created_at) SELECT ?,?,?,'office_document',?,?,? WHERE EXISTS(SELECT 1 FROM office_verifications WHERE user_id=? AND last_action=?)").bind(crypto.randomUUID(),user.id,user.name,id,state+' · '+record.document_number+(note?' · '+note:''),stamp,id,action)
 ]);
 const saved=await database.prepare('SELECT last_action FROM office_verifications WHERE user_id=?').bind(id).first<{last_action:string}>();
 if(saved?.last_action!==action)return error('Belge başka bir yönetici tarafından incelendi.',409);
 return ok({success:true,state},{headers:{'Cache-Control':'private, no-store'}});
}
