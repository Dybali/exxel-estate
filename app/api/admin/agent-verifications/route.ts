import {body,currentUser,error,isAdmin,now,ok,sameOrigin,str} from '@/lib/server';
import {officeDB} from '@/lib/office-verification-server';
import {reportsDB} from '@/lib/reports-server';
import {queueListingTranslation} from '@/lib/translation-runtime';
import {decideOffice,OfficeDecisionError,revokeOffice} from '@/lib/office-decision';
import {ensureOfficeChecks} from '@/lib/office-check';
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
 const id=str(data.id,80),state=str(data.state,20),note=str(data.note,1000),version=Number(data.version),actor={id:String(user.id),name:user.name};
 const database=await officeDB();await reportsDB();
 try{
  // After an automatic approval the admin confirms the document in TTBS, or withdraws the approval.
  if(data.action==='ttbs_confirmed'){await ensureOfficeChecks(database as never);await database.prepare('UPDATE office_checks SET ttbs_checked_at=?,ttbs_checked_by=? WHERE user_id=?').bind(now(),actor.id,id).run();return ok({success:true},{headers:{'Cache-Control':'private, no-store'}});}
  if(data.action==='revoke'){await revokeOffice(database as never,id,note,actor);return ok({success:true,state:'rejected'},{headers:{'Cache-Control':'private, no-store'}});}
  if(!['approved','rejected'].includes(state)||!Number.isInteger(version))return error('Geçersiz karar.');
  if(state==='rejected'&&note.length<5)return error('Düzeltme nedenini en az 5 karakterle yazın.');
  const {published}=await decideOffice(database as never,{userId:id,state:state as 'approved'|'rejected',note,version,actor});
  for(const listing of published)await queueListingTranslation(listing);
  return ok({success:true,state},{headers:{'Cache-Control':'private, no-store'}});
 }catch(cause){if(cause instanceof OfficeDecisionError)return error(cause.message,cause.status);throw cause;}
}
