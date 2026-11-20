import {bucket,currentUser,error,isAdmin,now,ok,sameOrigin,str} from '@/lib/server';
import {normalizeContactPhone} from '@/lib/phone';
import {officeDB} from '@/lib/office-verification-server';
import {officeFileType,readOfficeFile,OFFICE_PUBLIC_FIELDS,type OfficeVerification} from '@/lib/office-verification';
import {checkOffice} from '@/lib/office-check';
import {decideOffice} from '@/lib/office-decision';
import {queueListingTranslation} from '@/lib/translation-runtime';
import {env,waitUntil} from '@/lib/runtime';
export async function GET(request:Request){
 const user=await currentUser(request);if(!user)return error('Belge başvurusu için hesabınızla giriş yapın.',401);
 const database=await officeDB(),id=new URL(request.url).searchParams.get('userId')||user.id;
 if(id!==user.id&&(!user.email_verified||!isAdmin(user)))return error('Bu belgeye erişiminiz yok.',403);
 const record=await database.prepare(`SELECT ${OFFICE_PUBLIC_FIELDS},object_key FROM office_verifications WHERE user_id=?`).bind(id).first<OfficeVerification&{object_key:string}>();
 if(new URL(request.url).searchParams.get('download')==='1'){
  if(!record)return error('Belge bulunamadı.',404);
  const file=await bucket()?.get(record.object_key);if(!file)return error('Belge deposuna ulaşılamadı.',503);
  const ext=record.content_type==='application/pdf'?'pdf':record.content_type==='image/png'?'png':'jpg';
  return new Response(file.body,{headers:{'Content-Type':record.content_type,'Content-Disposition':`attachment; filename="ofis-yetki-belgesi.${ext}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Content-Length':String(file.size)}});
 }
 if(record)delete (record as Partial<typeof record>).object_key;
 const company=await database.prepare('SELECT category FROM agencies WHERE owner_id=?').bind(id).first<{category:string}>();
 const application=record?await database.prepare('SELECT contact_name,phone,address,tax_number FROM office_application_details WHERE user_id=? AND document_id=?').bind(id,record.document_id).first():null;
 return ok({application,verification:record,companyCategory:company?.category||'agency'},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request){
 try{return await upload(request);}
 catch(cause){console.error('office_upload_failed',String(cause).slice(0,300));return error('Belge şu anda kaydedilemedi. Birkaç dakika sonra tekrar deneyin; sorun sürerse bize yazın.',500);}
}
async function upload(request:Request){
 if(!sameOrigin(request))return error('Geçersiz kaynak.',403);
 const user=await currentUser(request);if(!user)return error('Giriş yapın.',401);
 if(user.role!=='agent')return error('Emlakçı veya şirket hesabı gerekli.',403);
 if(!user.company?.trim())return error('Önce profilinize ofis adını ekleyin.');
 let application:Record<string,unknown>;try{application=JSON.parse(decodeURIComponent(request.headers.get('X-Office-Application')||''));if(!application||typeof application!=='object'||Array.isArray(application))throw Error();}catch{return error('Ofis başvuru bilgilerini doldurun.');}
 const contactName=str(application.name,100),phone=normalizeContactPhone(str(application.phone,32)),address=str(application.address,500),taxNumber=str(application.taxNumber,30);
 if(contactName.length<2||!phone||address.length<10||!/^[A-Za-z0-9 /-]{5,30}$/.test(taxNumber))return error('Ad soyad, ülke koduyla telefon, ofis adresi ve vergi / şirket sicil numarasını doldurun.');
 const number=str(request.headers.get('X-Document-Number'),41);if(!/^[A-Za-z0-9/-]{3,40}$/.test(number))return error('Yetki belgesi numarasını girin (3–40 harf/rakam).');
 const database=await officeDB(),previous=await database.prepare('SELECT * FROM office_verifications WHERE user_id=?').bind(user.id).first<OfficeVerification&{object_key:string}>();
 if(previous&&previous.state!=='rejected')return error(previous.state==='approved'?'Belgeniz zaten onaylı. Tekrar yüklemeniz gerekmez.':'Belgeniz incelemede. Sonucu bekleyin.',409);
 const expected=Number(request.headers.get('X-Document-Version')||0);if(expected!==(previous?.version||0))return error('Belge durumu değişti. Sayfayı yenileyin.',409);
 const storage=bucket();if(!storage)return error('Güvenli belge deposu kullanılamıyor.',503);
 let bytes:Uint8Array,ext:string;const type=request.headers.get('Content-Type')||'';
 try{bytes=await readOfficeFile(request);ext=officeFileType(bytes,type);}catch(e){return error((e as Error).message);}
 const documentId=crypto.randomUUID(),key=`private/office-verifications/${user.id}/${documentId}.${ext}`,stamp=now();
 try{await storage.put(key,bytes,{httpMetadata:{contentType:type}});}catch(cause){console.error('office_upload_storage_failed',String(cause).slice(0,300));return error('Belge deposuna yüklenemedi. Birkaç dakika sonra tekrar deneyin.',503);}
 try{
  await database.batch([database.prepare(`INSERT INTO office_verifications(user_id,document_id,document_number,company_snapshot,object_key,content_type,byte_size,state,note,version,created_at,updated_at)
   VALUES(?,?,?,?,?,?,?,'pending','',1,?,?) ON CONFLICT(user_id) DO UPDATE SET document_id=excluded.document_id,document_number=excluded.document_number,company_snapshot=excluded.company_snapshot,object_key=excluded.object_key,content_type=excluded.content_type,byte_size=excluded.byte_size,state='pending',note='',version=office_verifications.version+1,updated_at=excluded.updated_at,reviewer_id=NULL,reviewed_at=NULL WHERE office_verifications.state='rejected' AND office_verifications.version=?`)
   .bind(user.id,documentId,number,user.company,key,type,bytes.length,stamp,stamp,expected),
   database.prepare('INSERT INTO office_application_details(user_id,document_id,contact_name,phone,address,tax_number) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM office_verifications WHERE user_id=? AND document_id=?) ON CONFLICT(user_id) DO UPDATE SET document_id=excluded.document_id,contact_name=excluded.contact_name,phone=excluded.phone,address=excluded.address,tax_number=excluded.tax_number').bind(user.id,documentId,contactName,phone,address,taxNumber,user.id,documentId)]);
  const saved=await database.prepare(`SELECT ${OFFICE_PUBLIC_FIELDS} FROM office_verifications WHERE user_id=?`).bind(user.id).first<OfficeVerification>();
  if(saved?.document_id!==documentId){await storage.delete(key);return error('Belge başka bir oturumda değişti. Sayfayı yenileyin.',409);}
  if(previous)await storage.delete(previous.object_key).catch(()=>{});
  // Automatic check (lib/office-check.ts): every check passing approves; the admin confirms in TTBS later. It reads
  // the document with OpenAI (up to a minute), so it runs after the answer: waiting for it made Mittwald's proxy cut
  // the connection. The form refreshes the state until the result is there (components/OfficeVerification.tsx).
  const verification=saved,automatic=false,checking=true;
  waitUntil((async()=>{
   try{
    const result=await checkOffice(database as never,{userId:String(user.id),documentId,company:String(user.company),documentNumber:number,taxNumber,bytes,contentType:type},env as {OPENAI_API_KEY?:string;OFFICE_CHECK_MODEL?:string});
    if(result.decision==='auto_approved'&&saved){
     const {published}=await decideOffice(database as never,{userId:String(user.id),state:'approved',note:'',version:saved.version,actor:{id:'system',name:'Otomatik doğrulama'},summary:'approved (automatic, score '+result.score+') · '+number});
     for(const listing of published)await queueListingTranslation(listing);
    }
   }catch(cause){console.warn('office_check_failed',String(cause).slice(0,200));}
  })());
  return ok({verification,automatic,checking},{status:201,headers:{'Cache-Control':'private, no-store'}});
 }catch(e){await storage.delete(key).catch(()=>{});throw e;}
}
