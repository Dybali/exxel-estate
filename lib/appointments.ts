type Value=string|number|null;
export interface AppointmentDatabase {prepare(query:string):{bind(...values:Value[]):{all<T>():Promise<{results:T[]}>;first<T>():Promise<T|null>}}}
export class AppointmentError extends Error {constructor(message:string,public status=400){super(message);}}
export const CRM_STAGES=['new','contacted','viewing','offer','closed'] as const;
export const APPOINTMENT_LABELS:Record<string,string>={requested:'Talep alındı',confirmed:'Randevu onaylandı',rejected:'Talep reddedildi',cancelled:'Randevu iptal edildi',completed:'Görüşme tamamlandı',new:'Yeni müşteri',contacted:'İletişime geçildi',viewing:'Gösterim aşaması',offer:'Teklif aşaması',closed:'Tamamlandı'};
const uuid=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export async function appointmentsFor(db:AppointmentDatabase,userId:string){const result=await db.prepare('SELECT a.id,a.listing_id,a.buyer_id,a.seller_id,a.slot_at,a.message,a.status,CASE WHEN a.seller_id=? THEN a.stage ELSE NULL END AS stage,CASE WHEN a.seller_id=? THEN a.private_note ELSE NULL END AS private_note,a.version,a.created_at,a.updated_at,l.title AS listing_title,b.name AS buyer_name,s.name AS seller_name FROM appointments a JOIN listings l ON l.id=a.listing_id JOIN users b ON b.id=a.buyer_id JOIN users s ON s.id=a.seller_id WHERE a.buyer_id=? OR a.seller_id=? ORDER BY a.created_at DESC LIMIT 100').bind(userId,userId,userId,userId).all();return {appointments:result.results};}
export async function mutateAppointment(db:AppointmentDatabase,userId:string,data:Record<string,unknown>){
 const time=new Date().toISOString();
 if(data.action==='request'){
  if(!uuid(data.listingId)||!uuid(data.requestId))throw new AppointmentError('Geçersiz ilan veya randevu.');
  const slot=typeof data.slotAt==='string'?Date.parse(data.slotAt):NaN,message=typeof data.message==='string'?data.message.trim():'';
  if(!Number.isFinite(slot)||slot<Date.now()+15*60000||slot>Date.now()+180*86400000||message.length<5||message.length>1000)throw new AppointmentError('Gelecek 180 gün içinde bir saat ve en az 5 karakter açıklama seçin.');
  const listing=await db.prepare("SELECT owner_id FROM listings WHERE id=? AND status='published'").bind(data.listingId as string).first<{owner_id:string}>();
  if(!listing)throw new AppointmentError('İlan bulunamadı.',404);
  if(listing.owner_id===userId)throw new AppointmentError('Kendi ilanınız için randevu oluşturamazsınız.',403);
  const existing=await db.prepare('SELECT id FROM appointments WHERE id=? AND buyer_id=? AND listing_id=?').bind(data.requestId as string,userId,data.listingId as string).first();if(existing)return {success:true,id:data.requestId};
  const row=await db.prepare("INSERT INTO appointments(id,listing_id,buyer_id,seller_id,slot_at,message,status,stage,private_note,version,created_at,updated_at) SELECT ?,?,?,?,?,?,'requested','new','',1,?,? WHERE (SELECT count(*) FROM appointments WHERE buyer_id=? AND status IN ('requested','confirmed'))<10 ON CONFLICT DO NOTHING RETURNING id").bind(data.requestId as string,data.listingId as string,userId,listing.owner_id,new Date(slot).toISOString(),message,time,time,userId).first<{id:string}>();
  if(!row)throw new AppointmentError('Bu ilan için açık talebiniz var veya 10 açık talep sınırına ulaştınız.',409);
  return {success:true,id:row.id};
 }
 if(data.action!=='update'||!uuid(data.id)||!Number.isSafeInteger(data.version)||Number(data.version)<1)throw new AppointmentError('Geçersiz randevu.');
 const row=await db.prepare('SELECT buyer_id,seller_id,status,stage,private_note,version FROM appointments WHERE id=? AND (buyer_id=? OR seller_id=?)').bind(data.id as string,userId,userId).first<{buyer_id:string;seller_id:string;status:string;stage:string;private_note:string;version:number}>();
 if(!row)throw new AppointmentError('Randevu bulunamadı.',404);
 const seller=row.seller_id===userId;
 if(!seller&&(Object.hasOwn(data,'privateNote')||Object.hasOwn(data,'stage')))throw new AppointmentError('Müşteri notlarını yalnızca ilan sahibi değiştirebilir.',403);
 const status=typeof data.status==='string'?data.status:row.status,stage=typeof data.stage==='string'?data.stage:row.stage,note=typeof data.privateNote==='string'?data.privateNote:row.private_note;
 const transitions:Record<string,string[]>={requested:['confirmed','rejected','cancelled'],confirmed:['completed','cancelled'],completed:[],rejected:[],cancelled:[]};
 if(status!==row.status&&(!transitions[row.status]?.includes(status)||!seller&&status!=='cancelled'))throw new AppointmentError('Bu durum değişikliğine izin verilmiyor.',403);
 if(!(CRM_STAGES as readonly string[]).includes(stage)||note.length>2000)throw new AppointmentError('Müşteri notunu ve aşamasını kontrol edin.');
 const updated=await db.prepare('UPDATE appointments SET status=?,stage=?,private_note=?,version=version+1,updated_at=? WHERE id=? AND version=? RETURNING id').bind(status,stage,note,time,data.id as string,Number(data.version)).first();
 if(!updated)throw new AppointmentError('Randevu başka bir sekmede güncellendi. Yenileyin.',409);
 return {success:true,id:data.id};
}
