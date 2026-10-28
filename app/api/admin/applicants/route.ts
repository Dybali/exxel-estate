import {currentUser,isAdmin,error,ok,str} from '@/lib/server';
import {officeDB} from '@/lib/office-verification-server';
const fields=`u.id,u.name,u.email,u.phone,u.company,u.agent_status,u.email_verified,u.created_at,a.category,
 v.document_id,v.document_number,v.company_snapshot,v.content_type,v.byte_size,v.state AS document_state,v.version,v.note,v.reviewed_at,
 d.contact_name AS applicant_name,d.phone AS applicant_phone,d.address AS office_address,d.tax_number`;
const joins=`FROM users u LEFT JOIN agencies a ON a.owner_id=u.id LEFT JOIN office_verifications v ON v.user_id=CAST(u.id AS TEXT) LEFT JOIN office_application_details d ON d.user_id=v.user_id AND d.document_id=v.document_id`;
export async function GET(request:Request){
 const user=await currentUser(request);if(!user?.email_verified||!isAdmin(user))return error('Yönetici yetkisi gerekli.',403);
 const db=await officeDB(),params=new URL(request.url).searchParams,id=str(params.get('userId'),80);
 if(id){
  const applicant=await db.prepare(`SELECT ${fields} ${joins} WHERE CAST(u.id AS TEXT)=? AND u.role='agent'`).bind(id).first();
  if(!applicant)return error('Başvuru bulunamadı.',404);
  const listings=await db.prepare("SELECT id,title,city,district,status,price,currency,created_at FROM listings WHERE owner_id=? ORDER BY created_at DESC LIMIT 50").bind(id).all();
  return ok({applicant,listings:listings.results},{headers:{'Cache-Control':'private, no-store'}});
 }
 const page=Math.max(1,Math.min(10000,Math.floor(Number(params.get('page'))||1))),q=str(params.get('q'),100),state=params.get('state')||'pending';
 if(!['pending','approved','rejected','missing','all'].includes(state))return error('Geçersiz filtre.');
 const conditions=["u.role='agent'"],values:(string|number)[]=[];
 if(state==='missing')conditions.push('v.user_id IS NULL');
 else if(state==='pending')conditions.push("(v.state='pending' OR (u.agent_status='pending' AND v.state='approved'))");
 else if(state==='approved')conditions.push("u.agent_status='approved' AND v.state='approved'");
 else if(state==='rejected')conditions.push("(u.agent_status='rejected' OR v.state='rejected')");
 if(q){conditions.push("(LOWER(u.name) LIKE LOWER(?) ESCAPE '\\' OR LOWER(u.email) LIKE LOWER(?) ESCAPE '\\' OR LOWER(COALESCE(u.company,'')) LIKE LOWER(?) ESCAPE '\\')");const pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%';values.push(pattern,pattern,pattern);}
 const where=conditions.join(' AND ');
 const [rows,count,summary]=await Promise.all([
  db.prepare(`SELECT ${fields} ${joins} WHERE ${where} ORDER BY CASE WHEN v.state='pending' THEN 0 ELSE 1 END,u.created_at DESC LIMIT 25 OFFSET ?`).bind(...values,(page-1)*25).all(),
  db.prepare(`SELECT COUNT(*) AS total ${joins} WHERE ${where}`).bind(...values).first<{total:number}>(),
  db.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN v.state='pending' OR (u.agent_status='pending' AND v.state='approved') THEN 1 ELSE 0 END) AS pending,SUM(CASE WHEN v.user_id IS NULL THEN 1 ELSE 0 END) AS missing,SUM(CASE WHEN u.agent_status='approved' AND v.state='approved' THEN 1 ELSE 0 END) AS approved FROM users u LEFT JOIN office_verifications v ON v.user_id=CAST(u.id AS TEXT) WHERE u.role='agent'").first()
 ]);
 return ok({applicants:rows.results,total:Number(count?.total||0),page,summary},{headers:{'Cache-Control':'private, no-store'}});
}
