import {bucket,currentUser,error,isAdmin,now,ok,sameOrigin,str} from '@/lib/server';
import {officeDB} from '@/lib/office-verification-server';
import {officeFileType,readOfficeFile,OFFICE_PUBLIC_FIELDS,type OfficeVerification} from '@/lib/office-verification';
export async function GET(request:Request){
 const user=await currentUser(request);if(!user?.email_verified)return error('Doğrulanmış hesapla giriş yapın.',401);
 const database=await officeDB(),id=new URL(request.url).searchParams.get('userId')||user.id;
 if(id!==user.id&&!isAdmin(user))return error('Bu belgeye erişiminiz yok.',403);
 const record=await database.prepare(`SELECT ${OFFICE_PUBLIC_FIELDS},object_key FROM office_verifications WHERE user_id=?`).bind(id).first<OfficeVerification&{object_key:string}>();
 if(new URL(request.url).searchParams.get('download')==='1'){
  if(!record)return error('Belge bulunamadı.',404);
  const file=await bucket()?.get(record.object_key);if(!file)return error('Belge deposuna ulaşılamadı.',503);
  const ext=record.content_type==='application/pdf'?'pdf':record.content_type==='image/png'?'png':'jpg';
  return new Response(file.body,{headers:{'Content-Type':record.content_type,'Content-Disposition':`attachment; filename="ofis-yetki-belgesi.${ext}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Content-Length':String(file.size)}});
 }
 if(record)delete (record as Partial<typeof record>).object_key;
 return ok({verification:record},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return error('Geçersiz kaynak.',403);
 const user=await currentUser(request);if(!user)return error('Giriş yapın.',401);
 if(!user.email_verified||user.role!=='agent')return error('E-postası doğrulanmış emlakçı hesabı gerekli.',403);
 if(!user.company?.trim())return error('Önce profilinize ofis adını ekleyin.');
 const number=str(request.headers.get('X-Document-Number'),41);if(!/^[A-Za-z0-9/-]{3,40}$/.test(number))return error('Yetki belgesi numarasını girin (3–40 harf/rakam).');
 const database=await officeDB(),previous=await database.prepare('SELECT * FROM office_verifications WHERE user_id=?').bind(user.id).first<OfficeVerification&{object_key:string}>();
 if(previous&&previous.state!=='rejected')return error(previous.state==='approved'?'Belgeniz zaten onaylı. Tekrar yüklemeniz gerekmez.':'Belgeniz incelemede. Sonucu bekleyin.',409);
 const expected=Number(request.headers.get('X-Document-Version')||0);if(expected!==(previous?.version||0))return error('Belge durumu değişti. Sayfayı yenileyin.',409);
 const storage=bucket();if(!storage)return error('Güvenli belge deposu kullanılamıyor.',503);
 let bytes:Uint8Array,ext:string;const type=request.headers.get('Content-Type')||'';
 try{bytes=await readOfficeFile(request);ext=officeFileType(bytes,type);}catch(e){return error((e as Error).message);}
 const documentId=crypto.randomUUID(),key=`private/office-verifications/${user.id}/${documentId}.${ext}`,stamp=now();
 await storage.put(key,bytes,{httpMetadata:{contentType:type}});
 try{
  await database.prepare(`INSERT INTO office_verifications(user_id,document_id,document_number,company_snapshot,object_key,content_type,byte_size,state,note,version,created_at,updated_at)
   VALUES(?,?,?,?,?,?,?,'pending','',1,?,?) ON CONFLICT(user_id) DO UPDATE SET document_id=excluded.document_id,document_number=excluded.document_number,company_snapshot=excluded.company_snapshot,object_key=excluded.object_key,content_type=excluded.content_type,byte_size=excluded.byte_size,state='pending',note='',version=office_verifications.version+1,updated_at=excluded.updated_at,reviewer_id=NULL,reviewed_at=NULL WHERE office_verifications.state='rejected' AND office_verifications.version=?`)
   .bind(user.id,documentId,number,user.company,key,type,bytes.length,stamp,stamp,expected).run();
  const saved=await database.prepare(`SELECT ${OFFICE_PUBLIC_FIELDS} FROM office_verifications WHERE user_id=?`).bind(user.id).first<OfficeVerification>();
  if(saved?.document_id!==documentId){await storage.delete(key);return error('Belge başka bir oturumda değişti. Sayfayı yenileyin.',409);}
  if(previous)await storage.delete(previous.object_key).catch(()=>{});
  return ok({verification:saved},{status:201,headers:{'Cache-Control':'private, no-store'}});
 }catch(e){await storage.delete(key).catch(()=>{});throw e;}
}
