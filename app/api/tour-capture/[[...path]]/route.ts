import {body,currentUser,error,ok,sameOrigin} from '@/lib/server';
import {captureDB,captureBucket,captureMode,cleanupExpired,cleanupFiles,filesOf,publicJob,workerAuthorized,workerOnline,type CaptureJob} from '@/lib/tour-capture';
import {CAPTURE_LIMITS as L,captureInput,jpegSize} from '@/lib/capture-rules';
import {panoramaDimensions} from '@/lib/panoramas';
import {externalR2Ready,putExternalImage} from '@/lib/external-r2';
const routeParts=(r:Request)=>new URL(r.url).pathname.split('/').filter(Boolean).slice(2);
const noCache={'Cache-Control':'private, no-store'};
async function readBytes(request:Request,max:number){if(Number(request.headers.get('content-length'))>max)throw Error('Dosya çok büyük.');const reader=request.body?.getReader();if(!reader)throw Error('Dosya gerekli.');const chunks:Uint8Array[]=[];let size=0;while(true){const result=await reader.read();if(result.done)break;size+=result.value.length;if(size>max){await reader.cancel();throw Error('Dosya çok büyük.');}chunks.push(result.value);}const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}return bytes;}
async function handle(request:Request){try{
 const parts=routeParts(request),method=request.method;
 if(parts[0]==='worker'){
  if(!await workerAuthorized(request))return error('Yetkisiz işlem servisi.',401);
  const database=await captureDB();
  if(method==='POST'&&parts[1]==='claim'){
   await cleanupExpired();
   await database.prepare('INSERT INTO tour_capture_workers(id,seen) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET seen=excluded.seen').bind('primary',Date.now()).run();
   await database.prepare("UPDATE tour_capture_jobs SET state='failed',message=?,lease=NULL WHERE state='processing' AND lease_until<? AND attempts>=?").bind('İşlem zaman aşımına uğradı. Yeni çekimle tekrar deneyin.',Date.now(),L.maxAttempts).run();
   const candidate=await database.prepare("SELECT * FROM tour_capture_jobs WHERE expires>? AND (state='queued' OR (state='processing' AND lease_until<? AND attempts<?)) ORDER BY created LIMIT 1").bind(Date.now(),Date.now(),L.maxAttempts).first<CaptureJob>();
   if(!candidate)return ok({job:null}, {headers:noCache});
   const lease=crypto.randomUUID();
   await database.prepare("UPDATE tour_capture_jobs SET state='processing',lease=?,lease_until=?,attempts=attempts+1,progress=5,message=? WHERE id=? AND (state='queued' OR (state='processing' AND lease_until<? AND attempts<?))").bind(lease,Date.now()+L.leaseMs,'Fotoğraflar birleştiriliyor.',candidate.id,Date.now(),L.maxAttempts).run();
   const job=await database.prepare('SELECT * FROM tour_capture_jobs WHERE id=? AND lease=?').bind(candidate.id,lease).first<CaptureJob>();
   return ok({job:job?{id:job.id,lease,name:job.name,count:job.expected,hfov:job.hfov}:null},{headers:noCache});
  }
  const id=parts[1],action=parts[2],lease=request.headers.get('x-capture-lease');
  // Consume a bounded result body before returning a lease conflict. This also
  // avoids truncating uploads through HTTP reverse proxies on cancellation.
  const resultBytes=method==='PUT'&&action==='result'?await readBytes(request,L.resultBytes):null;
  const job=await database.prepare("SELECT * FROM tour_capture_jobs WHERE id=? AND state='processing' AND lease=? AND lease_until>? AND expires>?").bind(id,lease||'',Date.now(),Date.now()).first<CaptureJob>();
  if(!job)return error('İşlem süresi doldu veya iptal edildi.',409);
  if(method==='GET'&&action==='source'){
   const index=Number(parts[3]);if(!Number.isInteger(index)||index<0||index>=job.expected)return error('Fotoğraf bulunamadı.',404);
   const object=await captureBucket().get(filesOf(job)[index]);if(!object)return error('Fotoğraf bulunamadı.',404);return new Response(object.body,{headers:{...noCache,'Content-Type':'image/jpeg'}});
  }
  if(method==='POST'&&action==='heartbeat'){
   await database.prepare('UPDATE tour_capture_workers SET seen=? WHERE id=?').bind(Date.now(),'primary').run();const input=await body(request),progress=Number(input.progress);await database.prepare("UPDATE tour_capture_jobs SET lease_until=?,progress=? WHERE id=? AND lease=? AND state='processing' AND lease_until>?").bind(Date.now()+L.leaseMs,Number.isFinite(progress)?Math.max(5,Math.min(95,Math.round(progress))):5,id,lease,Date.now()).run();return ok({ok:true});
  }
  if(method==='POST'&&action==='fail'){
   const input=await body(request);const message=input.code==='coverage'?'Çekimde eksik alanlar var. Tavan ve zemini de çekerek yeniden deneyin.':input.code==='overlap'?'Fotoğraflar eşleştirilemedi. Aynı noktadan daha fazla örtüşen fotoğraf çekin.':'Birleştirme tamamlanamadı. Daha net ve örtüşen fotoğraflarla tekrar deneyin.';
   await database.prepare("UPDATE tour_capture_jobs SET state='failed',message=?,lease=NULL WHERE id=? AND lease=? AND state='processing' AND lease_until>?").bind(message,id,lease,Date.now()).run();const failed=await database.prepare("SELECT id FROM tour_capture_jobs WHERE id=? AND state='failed'").bind(id).first();if(!failed)return error('İşlem süresi doldu.',409);await cleanupFiles(job);return ok({ok:true});
  }
  if(method==='PUT'&&action==='result'){
   const bytes=resultBytes!;panoramaDimensions(bytes);
   const key=`captures/${job.owner_id}/${job.id}/result-${lease}.jpg`;await captureBucket().put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
   await database.prepare("UPDATE tour_capture_jobs SET state='ready',result_key=?,progress=100,message=?,lease=NULL WHERE id=? AND lease=? AND state='processing' AND lease_until>? AND expires>?").bind(key,'Tur hazır. Önizleyip ilanınıza ekleyin.',id,lease,Date.now(),Date.now()).run();
   const saved=await database.prepare("SELECT id FROM tour_capture_jobs WHERE id=? AND result_key=? AND state='ready'").bind(id,key).first();if(!saved){await captureBucket().delete(key);return error('İşlem iptal edildi veya süresi doldu.',409);}await cleanupFiles(job);return ok({ok:true});
  }
  return error('İşlem bulunamadı.',404);
 }
 if(method!=='GET'&&!sameOrigin(request))return error('Geçersiz kaynak.',403);
 const user=await currentUser(request);if(!user||!['individual','agent','admin'].includes(user.role))return error('İlan veren hesabıyla giriş yapın.',401);
 if(!user.email_verified)return error('Önce e-posta adresinizi doğrulayın.',403);
 const database=await captureDB();
 if(!parts.length&&method==='GET'){
  const rows=await database.prepare('SELECT * FROM tour_capture_jobs WHERE owner_id=? AND expires>? ORDER BY created DESC LIMIT 8').bind(user.id,Date.now()).all<CaptureJob>();
  return ok({available:await workerOnline(),mode:captureMode(),jobs:rows.results.map(publicJob)},{headers:noCache});
 }
 if(!parts.length&&method==='POST'){
  if(!await workerOnline())return error('Fotoğraf işleme servisi henüz bağlı değil. Hazır 360° JPG yükleyebilirsiniz.',503);
  await cleanupExpired();const input=captureInput(await body(request)),id=crypto.randomUUID();
  await database.prepare("INSERT INTO tour_capture_jobs(id,owner_id,name,state,expected,files,hfov,progress,message,lease_until,attempts,created,expires,public_id) SELECT ?,?,?,'uploading',?,'[]',?,0,'Fotoğraflar yükleniyor.',0,0,?,?,? WHERE (SELECT COUNT(*) FROM tour_capture_jobs WHERE owner_id=? AND expires>? AND state IN ('uploading','queued','processing','ready'))<3 AND (SELECT COUNT(*) FROM tour_capture_jobs WHERE owner_id=? AND created>?)<12").bind(id,user.id,input.name,input.count,input.hfov,Date.now(),Date.now()+L.ttlMs,crypto.randomUUID(),user.id,Date.now(),user.id,Date.now()-86400000).run();
  const job=await database.prepare('SELECT * FROM tour_capture_jobs WHERE id=?').bind(id).first<CaptureJob>();return job?ok(publicJob(job),{status:201}):error('En fazla 3 açık işlem ve günde 12 oda oluşturabilirsiniz.',429);
 }
 const id=parts[0],action=parts[1];
 const job=await database.prepare('SELECT * FROM tour_capture_jobs WHERE id=? AND owner_id=? AND expires>?').bind(id,user.id,Date.now()).first<CaptureJob>();if(!job)return error('İşlem bulunamadı veya süresi doldu.',404);
 if(method==='GET'&&!action)return ok(publicJob(job),{headers:noCache});
 if(method==='DELETE'&&!action){await database.prepare("UPDATE tour_capture_jobs SET state='canceled',lease=NULL,message=? WHERE id=? AND owner_id=?").bind('İptal edildi.',id,user.id).run();await cleanupFiles(job,true);return ok({ok:true});}
 if(method==='PUT'&&action==='source'){
  const bytes=await readBytes(request,L.photoBytes);
  if(job.state!=='uploading')return error('Yükleme kapandı.',409);const files=filesOf(job);if(files.length>=job.expected)return error('Tüm fotoğraflar yüklendi.',409);
  jpegSize(bytes);const key=`captures/${user.id}/${id}/${crypto.randomUUID()}.jpg`;await captureBucket().put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
  const next=JSON.stringify([...files,key]);await database.prepare("UPDATE tour_capture_jobs SET files=? WHERE id=? AND files=? AND state='uploading' AND expires>?").bind(next,id,job.files,Date.now()).run();
  const saved=await database.prepare('SELECT files,state FROM tour_capture_jobs WHERE id=?').bind(id).first<{files:string;state:string}>();if(saved?.files!==next||saved.state==='canceled'){await captureBucket().delete(key);return error('Eşzamanlı yükleme. Tekrar deneyin.',409);}return ok({uploaded:files.length+1});
 }
 if(method==='POST'&&action==='submit'){
  if(job.state!=='uploading'||filesOf(job).length!==job.expected)return error('Tüm fotoğrafları yükleyin.',409);
  await database.prepare("UPDATE tour_capture_jobs SET state='queued',message=? WHERE id=? AND state='uploading'").bind('İşlem sırası bekleniyor.',id).run();return ok({ok:true});
 }
 if(method==='GET'&&action==='preview'&&job.state==='ready'&&job.result_key){const object=await captureBucket().get(job.result_key);if(!object)return error('Önizleme bulunamadı.',404);return new Response(object.body,{headers:{...noCache,'Content-Type':'image/jpeg'}});}
 if(method==='POST'&&action==='accept'&&['ready','accepted'].includes(job.state)&&job.result_key){
  if(!externalR2Ready())return error('İlan fotoğraf deposu yapılandırılmamış.',503);const key=`listings/${user.id}/${job.public_id}.jpg`;
  if(job.state==='ready'){const object=await captureBucket().get(job.result_key);if(!object)return error('Sonuç bulunamadı.',404);const bytes=new Uint8Array(await object.arrayBuffer());const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');await putExternalImage(key,bytes,'image/jpeg',digest);
  await database.prepare("UPDATE tour_capture_jobs SET state='accepted' WHERE id=? AND state='ready'").bind(id).run();const current=await database.prepare('SELECT state FROM tour_capture_jobs WHERE id=?').bind(id).first<{state:string}>();if(current?.state!=='accepted')return error('İşlem iptal edildi.',409);}
  return ok({scene:{id:job.public_id,name:job.name,url:`/api/media/${key}`}});
 }
 return error('İşlem bulunamadı.',404);
 }catch(cause){console.error('tour-capture',cause instanceof Error?cause.message:'error');return error('İşlem tamamlanamadı. Dosyaları ve bağlantınızı kontrol edin.',400);}}
export const GET=handle,POST=handle,PUT=handle,DELETE=handle;

