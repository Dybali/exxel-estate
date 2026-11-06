// Self-hosted listing videos (docs/listing-videos.md): shared helpers, the listing_videos table on
// SQLite (same SQL as PostgreSQL), R2 multipart storage, the upload API, Range responses of the media
// route, ffmpeg arguments and job processing with a fake ffmpeg, the worker start and the daily
// cleanup, and that none of the Node-only pieces can reach the Cloudflare bundle.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import http from 'node:http';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {PassThrough} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),nativeRequire=createRequire(import.meta.url);
function load(file,overrides={}){const full=path.resolve(root,file),module={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(overrides[name])return overrides[name];if(name.startsWith('.')||name.startsWith('@/')){const resolved=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return load(resolved+'.ts',overrides);}return nativeRequire(name);},module,module.exports);return module.exports;}
const read=file=>readFileSync(path.join(root,file),'utf8');
const shared=load('lib/listing-video.ts'),store=load('lib/listing-video-store.ts');
const MB=1024*1024;

function database(){
 const sql=new DatabaseSync(':memory:');
 for(const file of readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(read('drizzle/'+file));
 const db={sql,prepare(query){let values=[];const statement={bind(...v){values=v;return statement;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){return sql.prepare(query).run(...values);}};return statement;},
  async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 return db;
}
const uuid=()=>crypto.randomUUID();
function addUser(db,id=uuid()){db.sql.prepare("INSERT INTO users(id,email,password_hash,name,created_at) VALUES(?,?,?,?,?)").run(id,id+'@example.test','x','Test','2026-11-01T00:00:00.000Z');return id;}
function addListing(db,owner,status='published',presentation='{}'){const id=uuid();db.sql.prepare("INSERT INTO listings(id,owner_id,title,description,purpose,property_type,price,city,district,gross_area,status,presentation,created_at,updated_at) VALUES(?,?,'Deniz manzaralı daire','Açıklama','satilik','daire',1,'İstanbul','Kadıköy',100,?,?,?,?)").run(id,owner,status,presentation,'2026-11-01T00:00:00.000Z','2026-11-01T00:00:00.000Z');return id;}
async function addVideo(db,owner,{size=40*MB,at=new Date('2026-11-04T10:00:00Z')}={}){const id=uuid();await store.createVideoRow(db,{id,ownerId:owner,uploadId:'up-'+id,rawKey:`video-uploads/${owner}/${id}`,contentType:'video/mp4',size},at);return id;}
const sqlFiles={pg:read('postgres/migrations/019_listing_videos.sql'),sqlite:read('drizzle/0026_listing_videos.sql')};

test('shared helpers: ids, part sizes, container sniffing, stream peeking and exact length',async()=>{
 assert.equal(shared.MAX_VIDEO_BYTES,1024*MB);assert.equal(shared.MAX_VIDEO_SECONDS,180);assert.equal(shared.VIDEO_CHUNK_BYTES,16*MB);
 assert.ok(shared.validVideoId(uuid()));assert.equal(shared.validVideoId('a'.repeat(32)),false);assert.equal(shared.validVideoId('../x'),false);
 assert.equal(shared.videoPartCount(1),1);assert.equal(shared.videoPartCount(16*MB),1);assert.equal(shared.videoPartCount(16*MB+1),2);assert.equal(shared.videoPartCount(1024*MB),64);
 assert.equal(shared.videoPartLength(40*MB,1),16*MB);assert.equal(shared.videoPartLength(40*MB,3),8*MB);assert.equal(shared.videoPartLength(40*MB,4),0);assert.equal(shared.videoPartLength(40*MB,0),0);assert.equal(shared.videoPartLength(40*MB,1.5),0);
 const bytes=s=>new Uint8Array([...s].map(c=>c.charCodeAt(0)));
 assert.equal(shared.sniffVideo(bytes('\0\0\0\x18ftypisom\0\0')),'video/mp4');assert.equal(shared.sniffVideo(bytes('\0\0\0\x14ftypqt  \0\0')),'video/quicktime');
 assert.equal(shared.sniffVideo(new Uint8Array([0x1a,0x45,0xdf,0xa3,0,0,0,0,0,0,0,0])),'video/webm');assert.equal(shared.sniffVideo(bytes('RIFF\0\0\0\0AVI LIST')),'video/x-msvideo');
 assert.equal(shared.sniffVideo(bytes('%PDF-1.7\n%abcdef')),null);assert.equal(shared.sniffVideo(bytes('\xff\xd8\xff\xe0JFIF\0\0\0\0')),null);assert.equal(shared.sniffVideo(bytes('short')),null);
 const source=()=>new ReadableStream({start(c){c.enqueue(bytes('\0\0'));c.enqueue(bytes('\0\x18ftypisom'));c.enqueue(bytes('-rest-of-file'));c.close();}});
 const peeked=await shared.peekStream(source(),12);assert.equal(shared.sniffVideo(peeked.head),'video/mp4');
 assert.equal(await new Response(peeked.stream).text(),'\0\0\0\x18ftypisom-rest-of-file');
 const total='\0\0\0\x18ftypisom-rest-of-file'.length;
 assert.equal(await new Response(shared.exactLength(source(),total,{wrong:false})).text().then(t=>t.length),total);
 for(const expected of [total-1,total+1]){const state={wrong:false};await assert.rejects(()=>new Response(shared.exactLength(source(),expected,state)).arrayBuffer());assert.equal(state.wrong,true);}
});

test('migrations: PostgreSQL 019 and SQLite 0026 define the same listing_videos table',()=>{
 for(const column of ['id','owner_id','listing_id','status','upload_id','raw_key','mp4_key','poster_key','content_type','size_bytes','duration_seconds','width','height','error','attempts','locked_until','created_at','updated_at']){assert.match(sqlFiles.pg,new RegExp(`\\n  ${column} `),column);assert.match(sqlFiles.sqlite,new RegExp('`'+column+'`'),column);}
 assert.match(sqlFiles.pg,/listing_id uuid REFERENCES listings\(id\) ON DELETE SET NULL/);assert.match(sqlFiles.pg,/size_bytes bigint/);
 for(const file of [sqlFiles.pg,sqlFiles.sqlite])assert.match(file,/'uploading','queued','processing','ready','failed'/);
 assert.doesNotMatch(sqlFiles.pg+sqlFiles.sqlite,/\r/);
 const journal=JSON.parse(read('drizzle/meta/_journal.json'));assert.ok(journal.entries.some(entry=>entry.tag==='0026_listing_videos'));
 assert.match(read('postgres/schema.sql'),/CREATE TABLE IF NOT EXISTS listing_videos/);
 const {pendingMigrations}=load('lib/postgres-migrations.ts');assert.deepEqual(pendingMigrations(readdirSync(path.join(root,'postgres/migrations')),['018_individual_listing_45_days.sql']).slice(0,1),['019_listing_videos.sql']);
});

test('job queue: atomic claim, no double processing, requeue after the lock expires, attempt limit, retry delay',async()=>{
 const db=database(),owner=addUser(db);
 const first=await addVideo(db,owner,{at:new Date('2026-11-04T09:00:00Z')}),second=await addVideo(db,owner,{at:new Date('2026-11-04T09:30:00Z')});
 const t0=new Date('2026-11-04T10:00:00Z');
 assert.equal(await store.claimVideoJob(db,t0),null,'uploads still in progress are not jobs');
 assert.equal(await store.markVideoQueued(db,first,t0),true);assert.equal(await store.markVideoQueued(db,first,t0),false);await store.markVideoQueued(db,second,t0);
 const job=await store.claimVideoJob(db,t0);assert.equal(job.id,first);assert.equal(job.status,'processing');assert.equal(job.attempts,1);assert.equal(job.upload_id,null);
 const next=await store.claimVideoJob(db,t0);assert.equal(next.id,second,'a claimed job is never handed out twice');
 assert.equal(await store.claimVideoJob(db,t0),null);
 // Container died: after the 30-minute lock the job is taken again.
 assert.equal(await store.claimVideoJob(db,new Date(t0.getTime()+29*60_000)),null);
 const again=await store.claimVideoJob(db,new Date(t0.getTime()+31*60_000));assert.equal(again.id,first);assert.equal(again.attempts,2);
 // Temporary failure: queued again, but only after the retry delay.
 await store.retryVideoJob(db,first,new Date(t0.getTime()+32*60_000));
 const second2=await store.claimVideoJob(db,new Date(t0.getTime()+33*60_000));assert.equal(second2.id,second);
 assert.equal(await store.claimVideoJob(db,new Date(t0.getTime()+34*60_000)),null);
 const third=await store.claimVideoJob(db,new Date(t0.getTime()+38*60_000));assert.equal(third.id,first);assert.equal(third.attempts,3);
 // Third attempt dies too: the job fails instead of looping forever.
 assert.equal((await store.claimVideoJob(db,new Date(t0.getTime()+80*60_000))).id,second);
 const failed=await store.videoById(db,first);assert.equal(failed.status,'failed');assert.match(failed.error,/işlenemedi/);
 assert.equal(await store.finishVideoJob(db,second,{mp4Key:`videos/${second}/video.mp4`,posterKey:`videos/${second}/poster.jpg`,duration:12.5,width:1280,height:720}),true);
 const ready=await store.videoById(db,second);assert.equal(ready.status,'ready');assert.equal(ready.width,1280);assert.equal(ready.duration_seconds,12.5);assert.equal(ready.locked_until,null);
 assert.equal(await store.finishVideoJob(db,second,{mp4Key:'x',posterKey:'y',duration:1,width:1,height:1}),false,'only a processing job can finish');
 // The claim is one UPDATE with the condition repeated, so PostgreSQL re-checks it after a concurrent claim commits.
 assert.match(read('lib/listing-video-store.ts'),/UPDATE listing_videos SET status='processing'[^`]*WHERE id=\(SELECT id FROM listing_videos WHERE \$\{ready\}[^`]*\) AND \$\{ready\} RETURNING \*/);
 db.sql.close();
});

test('attaching to listings: ownership, upload state, the save batch, readiness and media access',async()=>{
 const db=database(),owner=addUser(db),other=addUser(db),listing=addListing(db,owner),draft=addListing(db,owner,'pending');
 const video=await addVideo(db,owner);
 assert.match(await store.videoAttachProblem(db,video,owner,null),/tamamlanmadı/);
 await store.markVideoQueued(db,video);
 assert.equal(await store.videoAttachProblem(db,video,owner,null),null);
 assert.match(await store.videoAttachProblem(db,video,other,null),/bulunamadı/,'someone else\'s upload');
 assert.match(await store.videoAttachProblem(db,uuid(),owner,null),/bulunamadı/);
 await store.attachVideoStatement(db,video,owner,uuid()).run();assert.equal((await store.videoById(db,video)).listing_id,null,'no listing row, nothing attached');
 await store.attachVideoStatement(db,video,other,listing).run();assert.equal((await store.videoById(db,video)).listing_id,null);
 await store.attachVideoStatement(db,video,owner,listing).run();assert.equal((await store.videoById(db,video)).listing_id,listing);
 assert.match(await store.videoAttachProblem(db,video,owner,draft),/bulunamadı/,'already used by another listing');
 assert.equal(await store.videoAttachProblem(db,video,owner,listing),null);
 assert.equal(await store.openUploadCount(db,owner),0);await addVideo(db,owner);assert.equal(await store.openUploadCount(db,owner),1);
 assert.equal(await store.readyListingVideo(db,video,listing),null,'not processed yet');
 await store.claimVideoJob(db);await store.finishVideoJob(db,video,{mp4Key:'m',posterKey:'p',duration:30,width:720,height:1280});
 assert.deepEqual(await store.readyListingVideo(db,video,listing),{id:video,width:720,height:1280,duration:30});
 assert.equal(await store.readyListingVideo(db,video,draft),null);
 assert.deepEqual({...await store.videoMediaAccess(db,video)},{owner_id:owner,status:'ready',listing_status:'published'});
 db.sql.close();
});

// R2 over the S3 API with a fake fetch (like tests/mittwald-runtime.test.mjs).
const r2={R2_ENDPOINT:'https://abc123.eu.r2.cloudflarestorage.com',R2_BUCKET_NAME:'exxel-estate-images',R2_ACCESS_KEY_ID:'id',R2_SECRET_ACCESS_KEY:'secret'};
function fakeFetch(responses){const calls=[];const original=globalThis.fetch;globalThis.fetch=async(request)=>{const r=request instanceof Request?request:new Request(request);calls.push({method:r.method,url:r.url,headers:Object.fromEntries(r.headers),body:['POST','PUT'].includes(r.method)&&r.body?await r.text():null});const next=responses.shift();return typeof next==='function'?next(r):next;};return {calls,restore:()=>{globalThis.fetch=original;}};}
const {videoStorage,rawVideoKey}=load('lib/video-storage.ts');

test('R2 multipart storage: start, parts listing, completion, abort, objects and key checks',async()=>{
 assert.equal(videoStorage({}),null);assert.throws(()=>videoStorage({...r2,R2_ENDPOINT:'https://evil.example'}),/invalid/);
 const storage=videoStorage(r2),owner=uuid(),id=uuid(),key=rawVideoKey(owner,id);
 await assert.rejects(()=>storage.deleteRaw('listings/../x'),/Invalid/);await assert.rejects(()=>storage.getMedia('videos/../../etc/passwd'),/Invalid/);
 const f=fakeFetch([
  new Response('<?xml version="1.0"?><InitiateMultipartUploadResult><UploadId>abc~1&amp;2</UploadId></InitiateMultipartUploadResult>'),
  new Response('<ListPartsResult><IsTruncated>true</IsTruncated><NextPartNumberMarker>1</NextPartNumberMarker><Part><PartNumber>1</PartNumber><ETag>&quot;e1&quot;</ETag><Size>16777216</Size></Part></ListPartsResult>'),
  new Response('<ListPartsResult><IsTruncated>false</IsTruncated><Part><PartNumber>2</PartNumber><ETag>"e2"</ETag><Size>5</Size></Part></ListPartsResult>'),
  new Response('<CompleteMultipartUploadResult><ETag>"x"</ETag></CompleteMultipartUploadResult>'),
  new Response('<Error><Code>InternalError</Code></Error>'),
  new Response(null,{status:404}),new Response(null,{status:204}),new Response(null,{status:404}),
 ]);
 try{
  assert.equal(await storage.createUpload(key,'video/mp4'),'abc~1&2');
  assert.equal(f.calls[0].method,'POST');assert.equal(f.calls[0].url,`https://abc123.eu.r2.cloudflarestorage.com/exxel-estate-private/${key}?uploads`);assert.match(f.calls[0].headers.authorization,/^AWS4-HMAC-SHA256 Credential=id\//);
  const parts=await storage.listParts(key,'abc~1&2');assert.deepEqual(parts,[{part:1,etag:'"e1"',size:16777216},{part:2,etag:'"e2"',size:5}]);
  assert.match(f.calls[1].url,/\?uploadId=abc~1%262$/);assert.match(f.calls[2].url,/part-number-marker=1/);
  await storage.completeUpload(key,'abc~1&2',parts);assert.equal(f.calls[3].body,'<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>&quot;e1&quot;</ETag></Part><Part><PartNumber>2</PartNumber><ETag>&quot;e2&quot;</ETag></Part></CompleteMultipartUpload>');
  await assert.rejects(()=>storage.completeUpload(key,'u',parts),/completion failed/,'an error inside a 200 answer');
  await storage.abortUpload(key,'u');await storage.deleteRaw(key);await storage.deleteMedia(`videos/${id}/poster.jpg`);
  assert.deepEqual(f.calls.slice(5).map(c=>[c.method,c.url.replace(/^https:\/\/[^/]+\//,'')]),[['DELETE',`exxel-estate-private/${key}?uploadId=u`],['DELETE',`exxel-estate-private/${key}`],['DELETE',`exxel-estate-images/videos/${id}/poster.jpg`]]);
 }finally{f.restore();}
 const g=fakeFetch([r=>new Response('ab',{status:206,headers:{'content-range':'bytes 0-1/10','content-length':'2'}})]);
 try{const response=await storage.getMedia(`videos/${id}/video.mp4`,'bytes=0-1');assert.equal(response.status,206);assert.equal(g.calls[0].headers.range,'bytes=0-1');assert.equal(g.calls[0].url,`https://abc123.eu.r2.cloudflarestorage.com/exxel-estate-images/videos/${id}/video.mp4`);}finally{g.restore();}
});

test('a part is streamed to storage with an exact Content-Length, never chunked or buffered whole',async()=>{
 const seen=[];const server=http.createServer((req,res)=>{let bytes=0;req.on('data',c=>{bytes+=c.length;});req.on('end',()=>{seen.push({method:req.method,url:req.url,length:req.headers['content-length'],chunked:req.headers['transfer-encoding'],bytes,sha:req.headers['x-amz-content-sha256']});res.setHeader('etag','"part-etag"');res.end();});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port,original=globalThis.fetch;
 // Same request, sent to a local server instead of R2.
 globalThis.fetch=async request=>{const url=new URL(request.url);return original(new Request(`http://127.0.0.1:${port}${url.pathname}${url.search}`,{method:request.method,headers:request.headers,body:request.body,duplex:'half'}));};
 try{
  const storage=videoStorage(r2),key=rawVideoKey(uuid(),uuid()),size=3*MB+7;
  const body=new ReadableStream({pull(c){const sent=c.sent||0;if(sent>=size){c.close();return;}const n=Math.min(256*1024,size-sent);c.enqueue(new Uint8Array(n).fill(1));c.sent=sent+n;}});
  assert.equal(await storage.uploadPart(key,'up',2,body,size),'"part-etag"');
  assert.deepEqual(seen[0],{method:'PUT',url:`/exxel-estate-private/${key}?partNumber=2&uploadId=up`,length:String(size),chunked:undefined,bytes:size,sha:'UNSIGNED-PAYLOAD'});
 }finally{globalThis.fetch=original;server.close();}
});

// Upload API with a fake storage and the SQLite table.
function fakeStorage(){const parts=new Map(),log=[];return {log,parts,
 async createUpload(key,type){log.push(['create',key,type]);return 'upload-1';},
 async uploadPart(key,uploadId,part,body,length){const bytes=new Uint8Array(await new Response(body).arrayBuffer());parts.set(part,{part,etag:'"e'+part+'"',size:bytes.length,first:bytes.slice(0,12)});log.push(['part',part,length]);return '"e'+part+'"';},
 async listParts(){return [...parts.values()].sort((a,b)=>a.part-b.part);},
 async completeUpload(key,uploadId,list){log.push(['complete',list.map(p=>p.part)]);},
 async abortUpload(key,uploadId){log.push(['abort',uploadId]);},async deleteRaw(key){log.push(['deleteRaw',key]);},async deleteMedia(key){log.push(['deleteMedia',key]);},
 async getMedia(key,range){log.push(['get',key,range]);return range?new Response('ab',{status:206,headers:{'content-type':'video/mp4','content-range':'bytes 0-1/1000','content-length':'2',etag:'"v"'}}):new Response('whole',{headers:{'content-type':'video/mp4','content-length':'5'}});}};}
function uploadRoute({db,user,storage,ready=true,limits={}}){
 const woken=[];class RecoveryError extends Error{};const server={db:()=>db,currentUser:async()=>user,isAdmin:u=>u?.role==='admin',sameOrigin:r=>!r.headers.get('origin')||r.headers.get('origin')==='https://site.test',sha256:async v=>v,body:r=>r.json(),error:(error,status=400)=>Response.json({error},{status}),ok:(v,i)=>Response.json(v,i)};
 const route=load('app/api/video-upload/route.ts',{'@/lib/server':server,'@/lib/recovery-service':{RecoveryError,consumeRecoveryLimit:async(_,key,max)=>{limits[key]=(limits[key]||0)+1;if(limits[key]>max)throw new RecoveryError('limit');}},
  '@/lib/listing-video-server':{videoUploadsReady:()=>ready,videoFeatureEnabled:()=>ready,videoStorageFromEnv:()=>storage,removeVideo:load('lib/listing-video-server.ts',{'@/lib/postgres-driver':{postgresDriver:null},'./runtime':{env:{}}}).removeVideo},
  '@/lib/video-worker-state':{wakeVideoWorker:()=>woken.push(1)}});
 return {route,woken};
}
const json=(method,body,headers={})=>new Request('https://site.test/api/video-upload',{method,headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const put=(id,part,bytes,headers={})=>new Request(`https://site.test/api/video-upload?id=${id}&part=${part}`,{method:'PUT',headers,body:bytes,duplex:'half'});
const mp4=size=>{const bytes=new Uint8Array(size);bytes.set([0,0,0,0x18,...'ftypisom'].map(c=>typeof c==='string'?c.charCodeAt(0):c).slice(0,size));return bytes;};

test('upload API: availability, auth, limits, sniffing, ownership, resume and completion',async()=>{
 const db=database(),owner={id:addUser(db),role:'individual'},stranger={id:addUser(db),role:'agent'},storage=fakeStorage();
 // Cloudflare build / no worker: a clear 503, nothing stored.
 const off=uploadRoute({db,user:owner,storage,ready:false}).route;
 const unavailable=await off.POST(json('POST',{size:10}));assert.equal(unavailable.status,503);assert.match((await unavailable.json()).error,/kullanılamıyor/);assert.equal(storage.log.length,0);
 const {route,woken}=uploadRoute({db,user:owner,storage});
 assert.equal((await route.POST(json('POST',{size:10},{Origin:'https://evil.test'}))).status,403);
 assert.equal((await uploadRoute({db,user:{id:'x',role:'buyer'},storage}).route.POST(json('POST',{size:10}))).status,403);
 const big=await route.POST(json('POST',{size:1024*MB+1}));assert.equal(big.status,400);assert.match((await big.json()).error,/1 GB/);
 assert.equal((await route.POST(json('POST',{size:0}))).status,400);
 const size=16*MB+100,start=await route.POST(json('POST',{size,type:'video/quicktime'}));assert.equal(start.status,201);
 const {id,chunkSize,parts}=await start.json();assert.ok(shared.validVideoId(id));assert.equal(chunkSize,16*MB);assert.equal(parts,2);
 assert.deepEqual(storage.log[0],['create',`video-uploads/${owner.id}/${id}`,'video/quicktime']);
 const row=await store.videoById(db,id);assert.equal(row.status,'uploading');assert.equal(row.upload_id,'upload-1');assert.equal(row.size_bytes,size);
 // Only the uploader can send parts; wrong part numbers and lengths are refused.
 assert.equal((await uploadRoute({db,user:stranger,storage}).route.PUT(put(id,1,mp4(16*MB)))).status,404);
 assert.equal((await route.PUT(put(id,3,mp4(10)))).status,400);
 assert.equal((await route.PUT(put(id,2,mp4(99)))).status,400,'the last part must be exactly 100 bytes');
 const pdf=new Uint8Array(16*MB);pdf.set([...'%PDF-1.7 abcdef'].map(c=>c.charCodeAt(0)));
 assert.equal((await route.PUT(put(id,1,pdf))).status,415);assert.equal(storage.parts.size,0);
 // Completing early names the missing parts (the browser uploads them and tries again).
 assert.equal((await route.PUT(put(id,1,mp4(16*MB)))).status,200);
 const early=await route.PATCH(json('PATCH',{id,action:'complete'}));assert.equal(early.status,409);assert.deepEqual((await early.json()).missing,[2]);
 const status=await route.GET(new Request(`https://site.test/api/video-upload?id=${id}&parts=1`));assert.deepEqual((await status.json()).parts,[1]);
 assert.equal((await route.PUT(put(id,2,new Uint8Array(100).fill(9)))).status,200);
 assert.equal((await uploadRoute({db,user:stranger,storage}).route.PATCH(json('PATCH',{id,action:'complete'}))).status,404);
 const done=await route.PATCH(json('PATCH',{id,action:'complete'}));assert.equal(done.status,200);assert.deepEqual(await done.json(),{status:'queued'});
 assert.deepEqual(storage.log.find(e=>e[0]==='complete'),['complete',[1,2]]);assert.equal(woken.length,1);
 assert.equal((await store.videoById(db,id)).status,'queued');
 assert.equal((await route.PUT(put(id,1,mp4(16*MB)))).status,409,'no parts after completion');
 const view=await (await route.GET(new Request(`https://site.test/api/video-upload?id=${id}`))).json();assert.equal(view.status,'queued');assert.equal(view.poster,undefined);
 assert.equal((await uploadRoute({db,user:stranger,storage}).route.GET(new Request(`https://site.test/api/video-upload?id=${id}`))).status,404);
 // At most 5 unattached uploads per member, and a request limit.
 for(let i=0;i<4;i++)assert.equal((await route.POST(json('POST',{size:10}))).status,201);
 const tooMany=await route.POST(json('POST',{size:10}));assert.equal(tooMany.status,429);
 const limited=uploadRoute({db,user:stranger,storage,limits:{[`video-start:${stranger.id}`]:10}}).route;assert.equal((await limited.POST(json('POST',{size:10}))).status,429);
 // Delete: an unattached upload goes at once (multipart aborted); an attached one stays until the listing is saved.
 const removed=await route.DELETE(new Request(`https://site.test/api/video-upload?id=${id}`,{method:'DELETE'}));assert.equal(removed.status,200);
 assert.equal(await store.videoById(db,id),null);assert.ok(storage.log.some(e=>e[0]==='deleteRaw'&&e[1].endsWith(id)));
 const attached=await addVideo(db,owner.id);const listing=addListing(db,owner.id);await store.markVideoQueued(db,attached);await store.attachVideoStatement(db,attached,owner.id,listing).run();
 assert.equal((await route.DELETE(new Request(`https://site.test/api/video-upload?id=${attached}`,{method:'DELETE'}))).status,409);
 db.sql.close();
});

function mediaRoute({db,user,storage,enabled=true}){
 const server={db:()=>db,currentUser:async()=>user,isAdmin:u=>u?.role==='admin',bucket:()=>null};
 return load('app/api/media/[...key]/route.ts',{'@/lib/server':server,'@/lib/external-r2':{getExternalImage:async()=>null},'@/lib/projects':{projectMediaPublic:async()=>false},'@/lib/projects-server':{projectsDB:()=>null},'@/lib/services':{serviceMediaPublic:async()=>false},'@/lib/services-server':{servicesDB:()=>null},'@/lib/listing-video-server':{videoFeatureEnabled:()=>enabled,videoStorageFromEnv:()=>storage}});
}
const media=(route,key,headers={},method='GET')=>route.GET(new Request('https://site.test/api/media/'+key,{method,headers}),{params:Promise.resolve({key:key.split('/')})});

test('media route: Range requests answer 206 for MP4 seeking; access follows the listing',async()=>{
 const db=database(),owner=addUser(db),listing=addListing(db,owner),pending=addListing(db,owner,'pending'),storage=fakeStorage();
 const make=async target=>{const id=await addVideo(db,owner);await store.markVideoQueued(db,id);await store.attachVideoStatement(db,id,owner,target).run();await store.claimVideoJob(db);await store.finishVideoJob(db,id,{mp4Key:`videos/${id}/video.mp4`,posterKey:`videos/${id}/poster.jpg`,duration:5,width:1280,height:720});return id;};
 const visible=await make(listing),hidden=await make(pending);
 const route=mediaRoute({db,user:null,storage});
 const ranged=await media(route,`videos/${visible}/video.mp4`,{Range:'bytes=0-1'});
 assert.equal(ranged.status,206);assert.equal(ranged.headers.get('content-range'),'bytes 0-1/1000');assert.equal(ranged.headers.get('accept-ranges'),'bytes');assert.equal(ranged.headers.get('content-length'),'2');assert.equal(ranged.headers.get('content-type'),'video/mp4');
 assert.equal(ranged.headers.get('cache-control'),'public,max-age=31536000,immutable');assert.equal(await ranged.text(),'ab');
 const whole=await media(route,`videos/${visible}/video.mp4`);assert.equal(whole.status,200);assert.equal(whole.headers.get('accept-ranges'),'bytes');assert.equal(await whole.text(),'whole');
 // Several ranges or junk: the whole file (allowed by HTTP), never passed on.
 await media(route,`videos/${visible}/video.mp4`,{Range:'bytes=0-1,5-9'});assert.equal(storage.log.at(-1)[2],null);
 await media(route,`videos/${visible}/poster.jpg`,{Range:'bytes=-500'});assert.deepEqual(storage.log.at(-1),['get',`videos/${visible}/poster.jpg`,'bytes=-500']);
 // Not published: only owner and admins.
 assert.equal((await media(route,`videos/${hidden}/video.mp4`)).status,404);
 const own=await media(mediaRoute({db,user:{id:owner,role:'individual'},storage}),`videos/${hidden}/video.mp4`,{Range:'bytes=0-1'});assert.equal(own.status,206);assert.equal(own.headers.get('cache-control'),'private,no-store');
 assert.equal((await media(mediaRoute({db,user:{id:'admin',role:'admin'},storage}),`videos/${hidden}/poster.jpg`)).status,200);
 // Unknown, unprocessed or malformed keys, and the Cloudflare build: 404.
 assert.equal((await media(route,`videos/${uuid()}/video.mp4`)).status,404);
 const raw=await addVideo(db,owner);assert.equal((await media(route,`videos/${raw}/video.mp4`)).status,404);
 assert.equal((await media(route,`videos/${visible}/other.mp4`)).status,404);
 assert.equal((await media(mediaRoute({db,user:null,storage,enabled:false}),`videos/${visible}/video.mp4`)).status,404);
 // Out-of-range request: 416 passed through.
 const unsatisfiable={...storage,getMedia:async()=>new Response(null,{status:416,headers:{'content-range':'bytes */1000'}})};
 const r416=await media(mediaRoute({db,user:null,storage:unsatisfiable}),`videos/${visible}/video.mp4`,{Range:'bytes=5000-'});assert.equal(r416.status,416);assert.equal(r416.headers.get('content-range'),'bytes */1000');
 db.sql.close();
});

const transcode=load('lib/video-transcode.ts');
test('ffmpeg arguments: H.264 High/AAC, 720p box without upscaling, faststart, CRF 23 with a cap, 2 threads',()=>{
 const args=transcode.transcodeArgs('/tmp/in','/tmp/out.mp4'),joined=args.join(' ');
 for(const part of ['-c:v libx264','-profile:v high','-crf 23','-maxrate 3M','-bufsize 6M','-c:a aac','-b:a 128k','-movflags +faststart','-map 0:a:0?','-map_metadata -1','-fpsmax 30','-nostdin','-filter_threads 1'])assert.ok(joined.includes(part),part);
 assert.equal(args.filter(a=>a==='-threads').length,2);assert.equal(args[args.indexOf('-threads')+1],'2');
 assert.equal(args[args.indexOf('-t')+1],'181');assert.equal(args.at(-1),'/tmp/out.mp4');assert.equal(args[args.indexOf('-i')+1],'/tmp/in');
 const filter=args[args.indexOf('-vf')+1];
 assert.equal(filter,"scale=w='min(iw,if(gte(iw,ih),1280,720))':h='min(ih,if(gte(iw,ih),720,1280))':force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p");
 const poster=transcode.posterArgs('/tmp/out.mp4','/tmp/poster.jpg',2);assert.deepEqual(poster.slice(poster.indexOf('-ss'),poster.indexOf('-ss')+2),['-ss','0.50']);assert.ok(poster.join(' ').includes('-frames:v 1'));
 assert.equal(transcode.posterArgs('a','b',120)[transcode.posterArgs('a','b',120).indexOf('-ss')+1],'1.00');
 assert.deepEqual(transcode.probeArgs('/x'),['-v','error','-print_format','json','-show_format','-show_streams','/x']);
 // Arguments go to spawn as an array: no shell, so file names cannot inject commands.
 assert.doesNotMatch(read('lib/video-transcode.ts'),/shell:\s*true|exec\(|execSync/);
});

test('ffprobe parsing: duration, displayed size of rotated phone videos, files without video',()=>{
 assert.deepEqual(transcode.parseProbe(JSON.stringify({format:{duration:'12.48'},streams:[{codec_type:'audio'},{codec_type:'video',width:1920,height:1080}]})),{duration:12.48,width:1920,height:1080,hasVideo:true});
 assert.deepEqual(transcode.parseProbe(JSON.stringify({format:{duration:'5'},streams:[{codec_type:'video',width:1920,height:1080,side_data_list:[{rotation:-90}]}]})),{duration:5,width:1080,height:1920,hasVideo:true});
 assert.deepEqual(transcode.parseProbe(JSON.stringify({format:{duration:'5'},streams:[{codec_type:'video',width:640,height:480,tags:{rotate:'90'}}]})),{duration:5,width:480,height:640,hasVideo:true});
 assert.equal(transcode.parseProbe(JSON.stringify({format:{duration:'5'},streams:[{codec_type:'audio'}]})).hasVideo,false);
 assert.equal(transcode.parseProbe('not json').hasVideo,false);
});

// Fake ffmpeg/ffprobe: answers from a script and writes the output file ffmpeg was asked for.
function fakeSpawn(script){const calls=[];const spawn=(command,args)=>{calls.push([command,args]);const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.pid=undefined;child.kill=()=>{setImmediate(()=>child.emit('close',null,'SIGKILL'));return true;};
 setImmediate(()=>{const step=script(command,args,calls.length);if(step==='hang')return;if(step.error){child.emit('error',step.error);return;}if(step.write)writeFileSync(args.at(-1),step.write);if(step.stdout)child.stdout.end(step.stdout);else child.stdout.end();child.stderr.end(step.stderr||'');setImmediate(()=>child.emit('close',step.code??0,null));});return child;};return {spawn,calls};}
const probeJson=(duration,w=1920,h=1080)=>JSON.stringify({format:{duration:String(duration)},streams:[{codec_type:'video',width:w,height:h}]});
function jobStorage({failUpload=false}={}){const log=[];return {log,
 async getRaw(key){log.push(['getRaw',key]);return new Response('raw video bytes');},
 async putMedia(key,body,length,type){const bytes=new Uint8Array(await new Response(body).arrayBuffer());log.push(['put',key,length,type,bytes.length]);if(failUpload)throw Error('R2 503');},
 async deleteRaw(key){log.push(['deleteRaw',key]);},async deleteMedia(key){log.push(['deleteMedia',key]);}};}
async function claimedJob(db){const owner=addUser(db),id=await addVideo(db,owner);await store.markVideoQueued(db,id);return store.claimVideoJob(db);}

test('job processing with a fake ffmpeg: ready, too long, unreadable, temporary storage failure; temp files always removed',async()=>{
 const tmp=mkdtempSync(path.join(tmpdir(),'video-test-')),quiet={info:console.info,error:console.error};console.info=console.error=()=>{};
 try{
  // Success: probe input, transcode, probe output, poster, upload both, delete raw, row ready.
  let db=database(),job=await claimedJob(db),storage=jobStorage();
  let fake=fakeSpawn((command,args)=>command==='ffprobe'?{stdout:args.at(-1).endsWith('video.mp4')?probeJson(42.25,1280,720):probeJson(42.3)}:{write:'encoded'});
  assert.equal(await transcode.processVideoJob(job,{db,storage,spawn:fake.spawn,tmpRoot:tmp}),'ready');
  assert.deepEqual(fake.calls.map(c=>c[0]),['ffprobe','ffmpeg','ffprobe','ffmpeg']);
  assert.ok(fake.calls[1][1].includes('libx264'));assert.ok(fake.calls[3][1].includes('-frames:v'));
  assert.deepEqual(storage.log.filter(e=>e[0]==='put').map(e=>[e[1],e[3],e[2]===e[4]]),[[`videos/${job.id}/video.mp4`,'video/mp4',true],[`videos/${job.id}/poster.jpg`,'image/jpeg',true]]);
  assert.deepEqual(storage.log.at(-1),['deleteRaw',job.raw_key]);
  let row=await store.videoById(db,job.id);assert.equal(row.status,'ready');assert.equal(row.width,1280);assert.equal(row.height,720);assert.equal(row.duration_seconds,42.3);assert.equal(row.mp4_key,`videos/${job.id}/video.mp4`);
  assert.deepEqual(readdirSync(tmp),[]);
  // Longer than 3 minutes (ffprobe decides): failed with a readable message, raw deleted, ffmpeg never run.
  job=await claimedJob(db);storage=jobStorage();fake=fakeSpawn(()=>({stdout:probeJson(181.5)}));
  assert.equal(await transcode.processVideoJob(job,{db,storage,spawn:fake.spawn,tmpRoot:tmp}),'failed');
  row=await store.videoById(db,job.id);assert.equal(row.status,'failed');assert.equal(row.error,transcode.VIDEO_ERRORS.tooLong);
  assert.deepEqual(fake.calls.map(c=>c[0]),['ffprobe']);assert.ok(storage.log.some(e=>e[0]==='deleteRaw'));assert.deepEqual(readdirSync(tmp),[]);
  // Not a video.
  job=await claimedJob(db);fake=fakeSpawn(()=>({code:1,stderr:'Invalid data found'}));
  assert.equal(await transcode.processVideoJob(job,{db,storage:jobStorage(),spawn:fake.spawn,tmpRoot:tmp}),'failed');assert.equal((await store.videoById(db,job.id)).error,transcode.VIDEO_ERRORS.unreadable);
  // ffmpeg fails: permanent.
  job=await claimedJob(db);fake=fakeSpawn(command=>command==='ffprobe'?{stdout:probeJson(10)}:{code:1,stderr:'Conversion failed!'});
  assert.equal(await transcode.processVideoJob(job,{db,storage:jobStorage(),spawn:fake.spawn,tmpRoot:tmp}),'failed');assert.equal((await store.videoById(db,job.id)).error,transcode.VIDEO_ERRORS.failed);
  // R2 unavailable while uploading the result: queued again for a later try, raw kept.
  job=await claimedJob(db);storage=jobStorage({failUpload:true});fake=fakeSpawn((command,args)=>command==='ffprobe'?{stdout:probeJson(10)}:{write:'x'});
  assert.equal(await transcode.processVideoJob(job,{db,storage,spawn:fake.spawn,tmpRoot:tmp}),'retry');
  row=await store.videoById(db,job.id);assert.equal(row.status,'queued');assert.ok(row.locked_until>new Date().toISOString());assert.ok(!storage.log.some(e=>e[0]==='deleteRaw'));
  // Last attempt: failed instead of retried.
  assert.equal(await transcode.processVideoJob({...job,attempts:3},{db,storage:jobStorage({failUpload:true}),spawn:fake.spawn,tmpRoot:tmp}),'failed');
  // A hanging ffmpeg is killed at the time limit and the job retried.
  job=await claimedJob(db);fake=fakeSpawn(command=>command==='ffprobe'?{stdout:probeJson(10)}:'hang');
  assert.equal(await transcode.processVideoJob(job,{db,storage:jobStorage(),spawn:fake.spawn,tmpRoot:tmp,timeoutMs:50}),'retry');
  // ffmpeg missing on the server (spawn error): retried, never thrown.
  job=await claimedJob(db);fake=fakeSpawn(()=>({error:Object.assign(Error('spawn ffprobe ENOENT'),{code:'ENOENT'})}));
  assert.equal(await transcode.processVideoJob(job,{db,storage:jobStorage(),spawn:fake.spawn,tmpRoot:tmp}),'retry');
  // Removed by the owner while processing: the new files are deleted again.
  job=await claimedJob(db);storage=jobStorage();fake=fakeSpawn((command,args)=>{if(command==='ffprobe')return {stdout:probeJson(10)};db.sql.prepare('DELETE FROM listing_videos WHERE id=?').run(job.id);return {write:'x'};});
  assert.equal(await transcode.processVideoJob(job,{db,storage,spawn:fake.spawn,tmpRoot:tmp}),'removed');assert.deepEqual(storage.log.filter(e=>e[0]==='deleteMedia').map(e=>e[1]).sort(),[`videos/${job.id}/poster.jpg`,`videos/${job.id}/video.mp4`]);
  assert.deepEqual(readdirSync(tmp),[],'no temp folder left behind');
  db.sql.close();
 }finally{Object.assign(console,quiet);rmSync(tmp,{recursive:true,force:true});}
});

test('worker start: skipped without TCP database, storage, ffmpeg or with VIDEO_WORKER=0; then processes queued jobs',async()=>{
 const state=load('lib/video-worker-state.ts');
 const logs=[];const info=console.info;console.info=(...a)=>logs.push(a.join(' '));
 const tmp=mkdtempSync(path.join(tmpdir(),'video-worker-'));
 try{
  const fakeDriver={postgresDriver:()=>{throw Error('tests pass the database');}};
  const worker=load('lib/video-worker-node.ts',{'@/lib/postgres-driver':fakeDriver,'./video-worker-state':state});
  const tools=fakeSpawn(()=>({code:0}));
  const pg={DATABASE_URL:'postgres://u:p@postgres:5432/app',...r2};
  for(const [settings,reason] of [[{...pg,VIDEO_WORKER:'0'},'VIDEO_WORKER=0'],[{...r2},'no TCP PostgreSQL'],[{...r2,DATABASE_URL:'postgres://u:p@ep-x.eu-central-1.aws.neon.tech/db'},'no TCP PostgreSQL'],[{DATABASE_URL:pg.DATABASE_URL},'R2 storage']]){
   await worker.startVideoWorker(settings,{spawn:tools.spawn,tmpRoot:tmp});assert.equal(state.videoWorkerState().running,false);assert.match(logs.at(-1),new RegExp('worker skipped: .*'+reason.replace(/[=]/g,'.')));
  }
  await worker.startVideoWorker(pg,{spawn:fakeSpawn(()=>({error:Error('ENOENT')})).spawn,tmpRoot:tmp});assert.match(logs.at(-1),/skipped: ffmpeg\/ffprobe not found/);
  await load('lib/video-worker-node.ts',{'@/lib/postgres-driver':{postgresDriver:null},'./video-worker-state':state}).startVideoWorker(pg,{spawn:tools.spawn,tmpRoot:tmp});assert.match(logs.at(-1),/skipped: no TCP PostgreSQL/,'Cloudflare-like build without the TCP driver');
  // Running: picks up a queued job, then waits for the next one.
  const db=database(),storage=jobStorage();const owner=addUser(db),id=await addVideo(db,owner);await store.markVideoQueued(db,id);
  const spawn=fakeSpawn((command,args)=>args[0]==='-version'?{code:0}:command==='ffprobe'?{stdout:probeJson(8)}:{write:'x'}).spawn;
  await worker.startVideoWorker(pg,{spawn,database:db,storage,pollMs:20,tmpRoot:tmp});
  assert.equal(state.videoWorkerState().running,true);assert.match(logs.at(-1),/worker started/);
  for(let i=0;i<100&&(await store.videoById(db,id)).status!=='ready';i++)await new Promise(r=>setTimeout(r,20));
  assert.equal((await store.videoById(db,id)).status,'ready');
  const second=await addVideo(db,owner);await store.markVideoQueued(db,second);state.wakeVideoWorker();
  for(let i=0;i<100&&(await store.videoById(db,second)).status!=='ready';i++)await new Promise(r=>setTimeout(r,20));
  assert.equal((await store.videoById(db,second)).status,'ready');
  await worker.startVideoWorker(pg,{spawn,database:db,storage,tmpRoot:tmp});assert.equal(logs.filter(l=>/worker started/.test(l)).length,1,'started once');
  db.sql.close();
 }finally{console.info=info;state.videoWorkerState().stop?.();state.setVideoWorkerState({running:false});rmSync(tmp,{recursive:true,force:true});}
});

test('daily cleanup: unattached uploads and failed jobs older than 2 days go, with their files',async()=>{
 const db=database(),owner=addUser(db),storage=fakeStorage(),now=new Date('2026-11-10T06:00:00Z'),old=new Date('2026-11-07T05:00:00Z'),recent=new Date('2026-11-09T12:00:00Z');
 const server=load('lib/listing-video-server.ts',{'@/lib/postgres-driver':{postgresDriver:null},'./runtime':{env:{}}});
 const abandoned=await addVideo(db,owner,{at:old}),fresh=await addVideo(db,owner,{at:recent});
 const kept=await addVideo(db,owner,{at:old});await store.markVideoQueued(db,kept,old);const listing=addListing(db,owner);await store.attachVideoStatement(db,kept,owner,listing).run();
 const broken=await addVideo(db,owner,{at:old});await store.markVideoQueued(db,broken,old);const other=addListing(db,owner,'published',JSON.stringify({floorPlan:'',videoId:broken}));await store.attachVideoStatement(db,broken,owner,other).run();
 await store.claimVideoJob(db,old);await store.claimVideoJob(db,old);
 db.sql.prepare("UPDATE listing_videos SET status='ready',locked_until=NULL WHERE id=?").run(kept);
 await store.failVideoJob(db,broken,'Video işlenemedi. Başka bir video yükleyin.',old);
 assert.deepEqual(await server.cleanupVideos(db,storage,now),{removed:2,failed:0});
 const left=db.sql.prepare('SELECT id FROM listing_videos ORDER BY created_at').all().map(r=>r.id);assert.deepEqual(left.sort(),[fresh,kept].sort());
 assert.ok(storage.log.some(e=>e[0]==='abort'&&e[1]===`up-${abandoned}`),'unfinished multipart upload aborted');
 assert.deepEqual(JSON.parse(db.sql.prepare('SELECT presentation FROM listings WHERE id=?').get(other).presentation),{floorPlan:''},'failed video taken out of its listing');
 // Storage down: the row is kept (detached) for the next run.
 const failing={...storage,deleteRaw:async()=>{throw Error('R2 down');}};const err=console.error;console.error=()=>{};
 try{const stuck=await addVideo(db,owner,{at:old});assert.deepEqual(await server.cleanupVideos(db,failing,now),{removed:0,failed:1});assert.ok(await store.videoById(db,stuck));}finally{console.error=err;}
 // Removing a listing's previous video (replace/remove/delete) deletes the files and the row.
 assert.equal(await server.removeVideoById(db,kept,storage),true);assert.equal(await store.videoById(db,kept),null);
 assert.equal(server.videoFeatureEnabled({DATABASE_URL:'postgres://u:p@postgres/app'}),false,'Cloudflare build: no TCP driver, no videos');
 const node=load('lib/listing-video-server.ts',{'@/lib/postgres-driver':{postgresDriver:()=>null},'./runtime':{env:{}}});
 assert.equal(node.videoFeatureEnabled({DATABASE_URL:'postgres://u:p@postgres/app'}),true);assert.equal(node.videoFeatureEnabled({DATABASE_URL:'postgres://u:p@ep-x.aws.neon.tech/db'}),false);assert.equal(node.videoFeatureEnabled({}),false);
 assert.equal(node.videoUploadsReady({DATABASE_URL:'postgres://u:p@postgres/app',...r2}),false,'worker not running');
 db.sql.close();
});

test('Cloudflare build: Stream is gone, the worker slot is null and Node-only video code is only reachable through the alias',()=>{
 assert.equal(load('lib/video-worker.ts').startVideoWorker,null);
 assert.match(read('next.config.ts'),/"@\/lib\/video-worker":\s*"\.\/lib\/video-worker-node\.ts"/);
 assert.match(read('instrumentation.ts'),/await import\("@\/lib\/video-worker"\)/);
 for(const file of ['lib/stream-server.ts','lib/stream-video.ts','tests/stream-video.test.mjs'])assert.equal(existsSync(path.join(root,file)),false,file);
 const files=dir=>readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.(ts|tsx)$/.test(e.name)?[path.join(dir,e.name).replaceAll('\\','/')]:[]);
 const sources=['app','lib','components','build'].flatMap(files).concat(['instrumentation.ts','proxy.ts']);
 const importing=pattern=>sources.filter(f=>pattern.test(read(f))).sort();
 // lib/db-backup-node.ts (pg_dump) is likewise reachable only through its "@/lib/db-backup" alias (tests/db-backup.test.mjs).
 assert.deepEqual(importing(/from\s+["']node:child_process["']/),['lib/db-backup-node.ts','lib/video-transcode.ts']);
 assert.deepEqual(importing(/from\s+["'][^"']*video-transcode["']/),['lib/video-worker-node.ts']);
 assert.deepEqual(importing(/(import|from)[^;\n]*video-worker-node/),[]);
 assert.deepEqual(importing(/Cloudflare Stream|videodelivery\.net|STREAM_API_TOKEN|streamVideo/),[]);
 assert.doesNotMatch(read('wrangler.jsonc'),/CLOUDFLARE_ACCOUNT_ID|STREAM_API_TOKEN/);
 // Request bodies of the upload must not pass through the proxy (Next.js would buffer them and cut at 10 MB).
 assert.match(read('proxy.ts'),/manifest\.webmanifest\|api\/video-upload\)/);
 assert.match(read('Dockerfile'),/apk add --no-cache ffmpeg/);
});
