// Offsite database backup (lib/db-backup-node.ts, scripts/backup-restore.mjs,
// docs/backups-monitoring.md): file format and encryption, retention, pg_dump arguments and
// environment, skip conditions, the full run against fake pg tools and a fake R2, the private media
// warning, isolation inside the daily job and the Cloudflare slot.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,readdirSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {PassThrough} from 'node:stream';
import {createHash,randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import * as restore from '../scripts/backup-restore.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),nativeRequire=createRequire(import.meta.url);
function load(file,overrides={}){const full=path.resolve(root,file),module={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(overrides[name])return overrides[name];if(name.startsWith('.')||name.startsWith('@/')){const resolved=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return resolved.endsWith('.json')?JSON.parse(readFileSync(resolved,'utf8')):load(resolved+'.ts',overrides);}return nativeRequire(name);},module,module.exports);return module.exports;}
const read=file=>readFileSync(path.join(root,file),'utf8');
const backup=load('lib/db-backup-node.ts',{'@/lib/postgres-driver':{postgresDriver:null}});
const scratch=()=>mkdtempSync(path.join(tmpdir(),'em24-backup-test-'));
const key=randomBytes(32),keyText=key.toString('base64');
const sha=b=>createHash('sha256').update(b).digest('hex');

test('backup key: exactly 32 bytes of base64, anything else is rejected',()=>{
 for(const parse of [backup.parseBackupKey,restore.parseBackupKey]){
  assert.equal(parse(keyText).length,32);assert.equal(parse(' '+keyText+'\n').length,32);
  assert.throws(()=>parse(undefined),/not set/);assert.throws(()=>parse(''),/not set/);
  assert.throws(()=>parse(randomBytes(16).toString('base64')),/32 bytes/);
  assert.throws(()=>parse(randomBytes(33).toString('base64')),/32 bytes/);
  assert.throws(()=>parse('x'.repeat(64)),/32 bytes/);
  assert.throws(()=>parse(randomBytes(32).toString('hex')),/32 bytes/);
 }
});

test('file format: magic, version and IV header; parser rejects other files',()=>{
 const iv=randomBytes(12),header=backup.backupHeader(iv);
 assert.equal(header.length,backup.HEADER_BYTES);assert.equal(backup.HEADER_BYTES,restore.HEADER_BYTES);assert.equal(backup.TAG_BYTES,restore.TAG_BYTES);
 assert.equal(header.subarray(0,8).toString('ascii'),'EM24DUMP');assert.equal(header[8],1);
 const parsed=restore.parseBackupHeader(header);assert.equal(parsed.version,1);assert.deepEqual(Buffer.from(parsed.iv),iv);
 assert.throws(()=>restore.parseBackupHeader(header.subarray(0,20)),/too short/);
 const wrong=Buffer.from(header);wrong[0]^=1;assert.throws(()=>restore.parseBackupHeader(wrong),/magic/);
 const future=Buffer.from(header);future[8]=2;assert.throws(()=>restore.parseBackupHeader(future),/version 2/);
 assert.throws(()=>backup.backupHeader(randomBytes(16)),/12 bytes/);
});

test('encryption round trip (streamed, multi-chunk and empty) with SHA-256 of the plaintext',async()=>{
 const dir=scratch();
 try{
  for(const size of [0,1,70_000,3*1024*1024+17]){
   const plain=randomBytes(size),input=path.join(dir,`p${size}`),enc=input+'.enc',out=input+'.out';writeFileSync(input,plain);
   const sealed=await backup.encryptFile(input,enc,key);
   assert.equal(sealed.bytes,size);assert.equal(sealed.sha256,sha(plain));assert.equal(sealed.encryptedBytes,size+21+16);
   const file=readFileSync(enc);assert.equal(file.length,sealed.encryptedBytes);assert.equal(sealed.encryptedSha256,sha(file));
   if(size>100)assert.equal(file.indexOf(plain.subarray(0,64)),-1);
   const result=await restore.restoreFile(enc,out,key,{sha256:sealed.sha256,bytes:sealed.bytes});
   assert.equal(result.sha256,sha(plain));assert.equal(result.sha256Checked,true);assert.deepEqual(readFileSync(out),plain);
  }
  // A fresh IV every time: the same input never gives the same ciphertext.
  const input=path.join(dir,'p1');await backup.encryptFile(input,path.join(dir,'a'),key);await backup.encryptFile(input,path.join(dir,'b'),key);
  assert.notDeepEqual(readFileSync(path.join(dir,'a')),readFileSync(path.join(dir,'b')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('tamper detection: ciphertext, header, tag, truncation, wrong key and manifest mismatch',async()=>{
 const dir=scratch();
 try{
  const plain=randomBytes(200_000),input=path.join(dir,'p'),enc=path.join(dir,'p.enc'),out=path.join(dir,'out');writeFileSync(input,plain);
  const sealed=await backup.encryptFile(input,enc,key),good=readFileSync(enc);
  const attempt=async(bytes,useKey=key,expected={})=>{const f=path.join(dir,'t.enc');writeFileSync(f,bytes);try{await restore.restoreFile(f,out,useKey,expected);return 'accepted';}catch(e){assert.equal(existsSync(out),false,'output removed on failure');return e.message;}};
  const flip=(at)=>{const b=Buffer.from(good);b[at]^=0x40;return b;};
  assert.match(await attempt(flip(1000)),/Authentication failed/);
  assert.match(await attempt(flip(12)),/Authentication failed/);       // IV byte
  assert.match(await attempt(flip(good.length-1)),/Authentication failed/); // tag
  assert.match(await attempt(good.subarray(0,good.length-100)),/Authentication failed/);
  assert.match(await attempt(good,randomBytes(32)),/Authentication failed/);
  assert.match(await attempt(flip(3)),/magic/);
  assert.match(await attempt(good,key,{sha256:'0'.repeat(64)}),/SHA-256 does not match/);
  assert.match(await attempt(good,key,{bytes:sealed.bytes+1}),/size does not match/);
  assert.equal(await attempt(good,key,{sha256:sealed.sha256,bytes:sealed.bytes}),'accepted');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('retention keeps the 30 newest complete backups and never touches other keys',()=>{
 const stamp=i=>new Date(Date.UTC(2026,0,1)+i*86400000).toISOString().replace(/\.\d{3}Z$/,'Z').replace(/:/g,'');
 const keys=[];for(let i=0;i<40;i++)keys.push(`mittwald-db/db-${stamp(i)}.dump.enc`,`mittwald-db/db-${stamp(i)}.json`);
 const others=['db/db-2025-01-01T021700Z.dump.enc','db/db-2025-01-01T021700Z.dump.sha256','mittwald-db/notes.txt','mittwald-db/db-2025-01-01.dump.enc','mittwald-db/sub/db-2025-01-01T000000Z.json'];
 const orphan=`mittwald-db/db-${stamp(-5)}.dump.enc`;   // old incomplete leftover
 const fresh=`mittwald-db/db-${stamp(50)}.dump.enc`;    // newest, incomplete (upload in progress)
 const plan=backup.retentionPlan([...keys,...others,orphan,fresh].reverse());
 assert.equal(plan.keep.length,30);assert.equal(plan.keep[0],stamp(39));assert.equal(plan.keep[29],stamp(10));
 assert.equal(plan.delete.length,10*2+1);assert.ok(plan.delete.includes(orphan));assert.ok(!plan.delete.includes(fresh));
 for(const k of others)assert.ok(!plan.delete.includes(k),k);
 assert.ok(plan.delete.every(k=>k.startsWith('mittwald-db/db-')&&k<`mittwald-db/db-${stamp(10)}`));
 assert.deepEqual(backup.retentionPlan(keys.slice(0,60)).delete,[]);
 // Incomplete backups do not count towards the 30.
 const incomplete=[];for(let i=0;i<35;i++)incomplete.push(`mittwald-db/db-${stamp(i)}.dump.enc`);
 assert.deepEqual(backup.retentionPlan(incomplete).delete,[]);
 assert.deepEqual(backup.retentionPlan(keys,3).keep,[stamp(39),stamp(38),stamp(37)]);
});

test('pg_dump: custom format, no owner/privileges, connection via env, password never in argv',()=>{
 const url='postgres://exxel%40app:s3cr%3At%2Fpw@postgres-db:5433/estate%5Fdb?sslmode=require&foo=bar';
 const env=backup.pgConnectionEnv(url,{PATH:'/usr/bin'}),args=backup.pgDumpArgs('/tmp/x/db.dump');
 assert.deepEqual(args,['--format=custom','--no-owner','--no-privileges','--no-password','--file','/tmp/x/db.dump']);
 assert.deepEqual(env,{PATH:'/usr/bin',PGAPPNAME:'exxel-backup',PGCONNECT_TIMEOUT:'15',PGHOST:'postgres-db',PGPORT:'5433',PGUSER:'exxel@app',PGPASSWORD:'s3cr:t/pw',PGDATABASE:'estate_db',PGSSLMODE:'require'});
 assert.ok(!args.join(' ').includes('s3cr'));assert.ok(!Object.keys(env).some(k=>/R2|SECRET|KEY|TOKEN/.test(k)));
 assert.equal(backup.pgConnectionEnv('postgresql://u@h/d').PGPASSWORD,undefined);
 assert.throws(()=>backup.pgConnectionEnv('mysql://u:p@h/d'),/not a PostgreSQL URL/);assert.throws(()=>backup.pgConnectionEnv('nope'),/valid URL/);
 assert.equal(backup.pgBinary('pg_dump',{},()=>true),'/usr/libexec/postgresql18/pg_dump');
 assert.equal(backup.pgBinary('pg_restore',{},()=>false),'pg_restore');
 assert.equal(backup.pgBinary('pg_dump',{PG_BIN_DIR:'/opt/pg/bin'},()=>true),'/opt/pg/bin/pg_dump');
 assert.equal(backup.countTableData(';\n; Archive created\n3456; 0 16390 TABLE DATA public listings owner\n3457; 0 16391 TABLE DATA public users owner\n12; 1259 16390 TABLE public listings owner\n'),2);
 assert.equal(backup.backupStamp(new Date('2026-11-05T06:00:12.345Z')),'2026-11-05T060012Z');
});

// --- fakes ------------------------------------------------------------------------------------
const settings={DATABASE_URL:'postgres://site:pg-password-123@postgres:5432/estate',BACKUP_ENCRYPTION_KEY:keyText,R2_ENDPOINT:'https://abc123.eu.r2.cloudflarestorage.com',R2_ACCESS_KEY_ID:'id',R2_SECRET_ACCESS_KEY:'secret',PATH:'/usr/bin',APP_COMMIT:'abc1234',R2_SECRET_OTHER:'x'};
function fakeSpawn({tables=70,dumpBytes=50_000,dumpCode=0,dumpStderr=''}={}){
 const calls=[];
 const spawn=(command,args,options)=>{
  calls.push({command,args,env:options.env});
  const child=new (nativeRequire('node:events'))();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};
  setImmediate(()=>{
   if(command.endsWith('pg_dump')){if(dumpCode===0)writeFileSync(args[args.indexOf('--file')+1],randomBytes(dumpBytes));child.stderr.end(dumpStderr);child.stdout.end();child.emit('close',dumpCode);}
   else{child.stdout.end(';\n; header\n'+Array.from({length:tables},(_,i)=>`${i+100}; 0 ${16000+i} TABLE DATA public t${i} owner`).join('\n')+'\n');child.stderr.end();child.emit('close',0);}
  });
  return child;
 };
 return {spawn,calls};
}
function fakeR2(initial={}){
 const buckets={};const requests=[];const uploads=new Map();let ids=0;
 for(const [k,v] of Object.entries(initial)){const [b,...rest]=k.split('/');(buckets[b]??={})[rest.join('/')]={body:Buffer.from(v),headers:{}};}
 const fetch=async request=>{
  const url=new URL(request.url),[,bucket,...parts]=url.pathname.split('/'),key=parts.map(decodeURIComponent).join('/'),store=(buckets[bucket]??={});
  const method=request.method,q=url.searchParams;requests.push({method,bucket,key,query:url.search});
  assert.match(request.headers.get('authorization')||'',/^AWS4-HMAC-SHA256 /);
  if(method==='GET'&&q.get('list-type')==='2'){const prefix=q.get('prefix')||'';const keys=Object.keys(store).filter(k=>k.startsWith(prefix)).sort();return new Response(`<?xml version="1.0"?><ListBucketResult><IsTruncated>false</IsTruncated>${keys.map(k=>`<Contents><Key>${k}</Key><Size>${store[k].body.length}</Size></Contents>`).join('')}</ListBucketResult>`);}
  if(method==='POST'&&q.has('uploads')){const id='u'+(++ids);uploads.set(id,{key,parts:[],headers:Object.fromEntries(request.headers)});return new Response(`<InitiateMultipartUploadResult><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`);}
  if(method==='PUT'&&q.has('partNumber')){const u=uploads.get(q.get('uploadId'));u.parts[Number(q.get('partNumber'))-1]=Buffer.from(await request.arrayBuffer());return new Response(null,{headers:{etag:`"p${q.get('partNumber')}"`}});}
  if(method==='POST'&&q.has('uploadId')){const u=uploads.get(q.get('uploadId'));store[key]={body:Buffer.concat(u.parts),headers:u.headers};uploads.delete(q.get('uploadId'));return new Response('<CompleteMultipartUploadResult/>');}
  if(method==='DELETE'&&q.has('uploadId')){uploads.delete(q.get('uploadId'));return new Response(null,{status:204});}
  if(method==='PUT'){store[key]={body:Buffer.from(await request.arrayBuffer()),headers:Object.fromEntries(request.headers)};return new Response(null);}
  if(method==='HEAD'){const o=store[key];return o?new Response(null,{headers:{'content-length':String(o.body.length),...(o.headers['x-amz-meta-sha256']?{'x-amz-meta-sha256':o.headers['x-amz-meta-sha256']}:{})}}):new Response(null,{status:404});}
  if(method==='DELETE'){delete store[key];return new Response(null,{status:204});}
  if(method==='GET'){const o=store[key];return o?new Response(o.body):new Response(null,{status:404});}
  return new Response(null,{status:400});
 };
 return {fetch,buckets,requests,uploads};
}
const fakeDb=(tables={})=>({prepare:sql=>({all:async()=>{const name=/FROM (\w+)/.exec(sql)[1];if(!(name in tables))throw Error('relation does not exist');return {results:tables[name]};}})});

test('skip conditions: no database, Neon, and a clean result without touching tools or storage',async()=>{
 const {spawn,calls}=fakeSpawn(),r2=fakeR2();
 for(const [env,reason] of [[{},/no database configured/],[{DATABASE_URL:'postgres://u:p@ep-x.eu-central-1.aws.neon.tech/db'},/not the container's TCP PostgreSQL/],[{DATABASE_URL:'postgres://u:p@postgres/db',DATABASE_DRIVER:'neon'},/not the container's TCP PostgreSQL/]]){
  const report=await backup.runDatabaseBackup({...env,BACKUP_ENCRYPTION_KEY:keyText},{spawn,fetch:r2.fetch});
  assert.equal(report.status,'skipped');assert.match(report.reason,reason);assert.equal(typeof report.ms,'number');
 }
 assert.equal(calls.length,0);assert.equal(r2.requests.length,0);
});

test('configuration errors fail before anything runs (missing/invalid key, missing R2)',async()=>{
 const {spawn,calls}=fakeSpawn(),r2=fakeR2();
 for(const [patch,pattern] of [[{BACKUP_ENCRYPTION_KEY:''},/BACKUP_ENCRYPTION_KEY is not set/],[{BACKUP_ENCRYPTION_KEY:'short'},/32 bytes/],[{R2_SECRET_ACCESS_KEY:''},/R2_ENDPOINT/],[{R2_ENDPOINT:'https://example.com'},/R2 EU configuration/]]){
  const report=await backup.runDatabaseBackup({...settings,...patch},{spawn,fetch:r2.fetch});
  assert.equal(report.status,'failed');assert.equal(report.stage,'configuration');assert.match(report.error,pattern);
 }
 assert.equal(calls.length,0);assert.equal(r2.requests.length,0);
});

test('full run: dump, verify, encrypt, multipart upload, manifest, retention, private media warning',async()=>{
 const tmpRoot=scratch();
 try{
  const old={};for(let i=1;i<=31;i++){const s=`2026-10-${String(i).padStart(2,'0')}T060000Z`;old[`estatemarket24-backups/mittwald-db/db-${s}.dump.enc`]='x';old[`estatemarket24-backups/mittwald-db/db-${s}.json`]='{}';}
  old['estatemarket24-backups/db/db-2025-01-01T021700Z.dump.enc']='neon';
  old['exxel-estate-private/private/office-verifications/user-1/doc-a.pdf']='pdf';
  old['exxel-estate-private/captures/user-2/job-1/result-1.jpg']='jpg';
  const r2=fakeR2(old),{spawn,calls}=fakeSpawn({dumpBytes:40_000});
  const database=fakeDb({office_verifications:[{document_id:'doc-a',object_key:'private/office-verifications/user-1/doc-a.pdf',state:'approved'},{document_id:'doc-b',object_key:'private/office-verifications/user-9/doc-b.pdf',state:'pending'}],tour_capture_jobs:[{id:'job-1',state:'ready',result_key:'captures/user-2/job-1/result-1.jpg',files:'[]'},{id:'job-2',state:'uploading',result_key:null,files:'["captures/user-3/job-2/a.jpg"]'},{id:'job-3',state:'failed',result_key:'gone.jpg',files:'["gone2.jpg"]'}]});
  const logs=[];const warn=console.warn,info=console.info;console.warn=(...a)=>logs.push(a.join(' '));console.info=(...a)=>logs.push(a.join(' '));
  let report;
  try{report=await backup.runDatabaseBackup(settings,{spawn,fetch:r2.fetch,database,tmpRoot,now:()=>new Date('2026-11-05T06:00:12Z')});}finally{console.warn=warn;console.info=info;}
  assert.equal(report.status,'ok',JSON.stringify(report));
  assert.equal(report.key,'mittwald-db/db-2026-11-05T060012Z.dump.enc');assert.equal(report.manifest,'mittwald-db/db-2026-11-05T060012Z.json');
  assert.equal(report.tables,70);assert.equal(report.bytes,40_000);assert.equal(report.encryptedBytes,40_037);
  // pg_dump got the password only through the environment, and no other container secret.
  assert.equal(calls[0].command,'pg_dump');assert.deepEqual(calls[0].args.slice(0,4),['--format=custom','--no-owner','--no-privileges','--no-password']);
  assert.ok(!JSON.stringify(calls.map(c=>c.args)).includes('pg-password-123'));assert.equal(calls[0].env.PGPASSWORD,'pg-password-123');
  assert.ok(!Object.keys(calls[0].env).some(k=>k.startsWith('R2_')||k==='BACKUP_ENCRYPTION_KEY'));
  assert.equal(calls[1].command,'pg_restore');assert.equal(calls[1].args[0],'--list');assert.equal(calls[1].env.PGPASSWORD,undefined);
  // Stored object decrypts to a dump whose hash matches the manifest; metadata carries the hash.
  const bucket=r2.buckets['estatemarket24-backups'],stored=bucket[report.key],manifest=JSON.parse(bucket[report.manifest].body.toString());
  assert.equal(stored.headers['x-amz-meta-sha256'],report.sha256);
  assert.deepEqual({sha256:manifest.sha256,bytes:manifest.bytes,tables:manifest.tables,appCommit:manifest.appCommit,stamp:manifest.stamp,encryption:manifest.encryption},{sha256:report.sha256,bytes:40_000,tables:70,appCommit:'abc1234',stamp:'2026-11-05T060012Z',encryption:'AES-256-GCM'});
  const encFile=path.join(tmpRoot,'got.enc'),out=path.join(tmpRoot,'got.dump');writeFileSync(encFile,stored.body);
  assert.equal((await restore.restoreFile(encFile,out,key,manifest)).bytes,40_000);
  // Retention: 31 old + 1 new complete backups -> the 2 oldest go, the Neon-era db/ object stays.
  assert.deepEqual(report.retention,{kept:30,deleted:4});
  assert.ok(!bucket['mittwald-db/db-2026-10-01T060000Z.dump.enc']&&!bucket['mittwald-db/db-2026-10-02T060000Z.json']&&bucket['mittwald-db/db-2026-10-03T060000Z.dump.enc']);
  assert.ok(bucket['db/db-2025-01-01T021700Z.dump.enc']);
  assert.ok(r2.requests.filter(r=>r.method==='DELETE').every(r=>r.bucket==='estatemarket24-backups'&&r.key.startsWith('mittwald-db/db-2026-10-0')));
  // Private media: warning only, ids and key hashes, never the key itself (it contains user ids).
  assert.equal(report.privateMedia.checked,4);assert.equal(report.privateMedia.missing,2);
  assert.deepEqual(report.privateMedia.sample.map(m=>[m.table,m.id,m.state]),[['office_verifications','doc-b','pending'],['tour_capture_jobs','job-2','uploading']]);
  assert.ok(report.privateMedia.sample.every(m=>/^[a-f0-9]{16}$/.test(m.keyHash)));
  assert.ok(!JSON.stringify(report).includes('user-9')&&!logs.join('\n').includes('user-9'));
  assert.match(report.warnings.join(' '),/2 referenced object\(s\) missing/);
  assert.deepEqual(readdirSync(tmpRoot).filter(n=>n.startsWith('em24-backup-')),[],'temp files removed');
 }finally{rmSync(tmpRoot,{recursive:true,force:true});}
});

test('large files go up as a multipart upload; a failing part aborts it',async()=>{
 const dir=scratch();
 try{
  const file=path.join(dir,'big'),data=randomBytes(2500);writeFileSync(file,data);
  const r2=fakeR2(),store=backup.s3Bucket({endpoint:'https://abc123.eu.r2.cloudflarestorage.com',bucket:'estatemarket24-backups',accessKeyId:'a',secretAccessKey:'b'},r2.fetch);
  assert.deepEqual(await backup.uploadFile(store,'mittwald-db/x',file,data.length,{'x-amz-meta-sha256':'h'},1000),{parts:3});
  assert.deepEqual(r2.buckets['estatemarket24-backups']['mittwald-db/x'].body,data);
  assert.equal(r2.requests.filter(r=>r.query.includes('partNumber')).length,3);
  assert.deepEqual(await backup.uploadFile(store,'mittwald-db/y',file,data.length,{},5000),{parts:1});
  const failing=async request=>{const u=new URL(request.url);if(u.searchParams.get('partNumber')==='2')return new Response('no',{status:403});return r2.fetch(request);};
  const bad=backup.s3Bucket({endpoint:'https://abc123.eu.r2.cloudflarestorage.com',bucket:'estatemarket24-backups',accessKeyId:'a',secretAccessKey:'b'},failing);
  await assert.rejects(()=>backup.uploadFile(bad,'mittwald-db/z',file,data.length,{},1000),/part upload failed \(403\)/);
  assert.equal(r2.uploads.size,0,'multipart upload aborted');assert.equal(r2.buckets['estatemarket24-backups']['mittwald-db/z'],undefined);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('failures: nothing is deleted and temp files are cleaned (pg_dump error, too few tables, upload error)',async()=>{
 const tmpRoot=scratch();
 try{
  const old={};for(let i=1;i<=31;i++){const s=`2026-10-${String(i).padStart(2,'0')}T060000Z`;old[`estatemarket24-backups/mittwald-db/db-${s}.dump.enc`]='x';old[`estatemarket24-backups/mittwald-db/db-${s}.json`]='{}';}
  const cases=[
   [fakeSpawn({dumpCode:1,dumpStderr:'pg_dump: error: connection to server at "postgres" failed: postgres://site:pg-password-123@postgres/estate FATAL'}),null,'dump',/pg_dump failed \(exit 1\)/],
   [fakeSpawn({tables:12}),null,'verify',/12 TABLE DATA entries \(minimum 30\)/],
   [fakeSpawn(),async request=>request.method==='PUT'?new Response('denied',{status:403}):new Response(null,{status:404}),'upload',/R2 upload failed \(403\)/],
  ];
  for(const [{spawn},override,stage,pattern] of cases){
   const r2=fakeR2(old),errors=[];const error=console.error;console.error=(...a)=>errors.push(a.join(' '));
   let report;try{report=await backup.runDatabaseBackup(settings,{spawn,fetch:override||r2.fetch,database:fakeDb(),tmpRoot});}finally{console.error=error;}
   assert.equal(report.status,'failed');assert.equal(report.stage,stage);assert.match(report.error,pattern);
   assert.ok(!report.error.includes('pg-password-123')&&!errors.join('').includes('pg-password-123'));
   assert.ok(!r2.requests.some(r=>r.method==='DELETE'),'nothing deleted');
   assert.equal(Object.keys(r2.buckets['estatemarket24-backups']).length,62);
   assert.deepEqual(readdirSync(tmpRoot),[],'temp files removed');
  }
  const report=await backup.runDatabaseBackup({...settings,BACKUP_MIN_TABLES:'10'},{spawn:fakeSpawn({tables:12}).spawn,fetch:fakeR2().fetch,database:fakeDb(),tmpRoot});
  assert.equal(report.status,'ok');assert.match(report.privateMedia.note,/office_verifications not readable/);
 }finally{rmSync(tmpRoot,{recursive:true,force:true});}
});

test('daily job: the backup is isolated, reported and alerts on failure; Cloudflare slot skips',async()=>{
 const alerts=[];
 const deps=over=>({
  './server':{bucket:()=>null,db:()=>({})},'./site-url':{siteUrl:()=>'https://site.test'},
  './email-notifications':{sendDailyDigests:async()=>{}},'./tcmb-server':{currentRates:async()=>null},'./orders':{expirePromotions:async()=>{throw Error('orders down');}},
  './health':{runHealthChecks:async()=>[],alertOnFailure:async(checks)=>{alerts.push(checks);return 'alerted';}},
  './external-r2':{externalR2Ready:()=>true,headExternalImage:async()=>null},
  './listing-video-server':{videoFeatureEnabled:()=>false,cleanupVideos:async()=>({}),videoStorageFromEnv:()=>null},
  '@/lib/db-backup':{runDatabaseBackup:over},'./translation-runtime':{translationBatchJob:async()=>({poll:null,submit:null}),translationBatchPoll:async()=>null},
 });
 const error=console.error;console.error=()=>{};
 try{
  const failing=load('lib/scheduled-jobs.ts',deps(async()=>{throw Error('disk full');}));
  const jobs=failing.dailyJobs({});
  assert.equal(await jobs.promotions,false);assert.equal(await jobs.digest,true);assert.equal(await jobs.videos,true);
  const report=await jobs.backup;assert.equal(report.status,'failed');assert.match(report.error,/disk full/);assert.equal(report.alert,'alerted');
  assert.equal(alerts[0][0].name,'offsite-backup');assert.match(alerts[0][0].detail,/disk full/);
  const reported=load('lib/scheduled-jobs.ts',deps(async()=>({status:'failed',stage:'upload',error:'R2 upload failed (403)',ms:5})));
  assert.equal((await reported.backupJob({})).alert,'alerted');assert.match(alerts[1][0].detail,/^upload: R2 upload failed/);
  const fine=load('lib/scheduled-jobs.ts',deps(async()=>({status:'ok',ms:1})));assert.equal((await fine.backupJob({})).alert,undefined);
  const skipped=load('lib/scheduled-jobs.ts',deps(null));assert.deepEqual(await skipped.backupJob({}),{status:'skipped',reason:'not available in this build',ms:0});
  assert.equal(alerts.length,2);assert.deepEqual([...failing.CRON_JOBS],['health','daily','backup']);
 }finally{console.error=error;}
});

test('Cloudflare bundle never sees the backup: null slot, Node alias, cron script and image',()=>{
 assert.equal(load('lib/db-backup.ts').runDatabaseBackup,null);
 assert.doesNotMatch(read('lib/db-backup.ts'),/^import (?!type)/m);
 assert.match(read('next.config.ts'),/"@\/lib\/db-backup":\s*"\.\/lib\/db-backup-node\.ts"/);
 assert.match(read('lib/scheduled-jobs.ts'),/from "@\/lib\/db-backup"/);
 const files=dir=>readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.(ts|tsx)$/.test(e.name)?[path.join(dir,e.name).replaceAll('\\','/')]:[]);
 assert.deepEqual(['app','lib','components','build'].flatMap(files).filter(f=>/db-backup-node/.test(read(f).replace(/\/\/.*$/gm,''))),[]);
 assert.match(read('scripts/cron-call.mjs'),/\["health", "daily", "backup"\]/);
 assert.match(read('Dockerfile'),/apk add --no-cache ffmpeg postgresql18-client/);
 assert.match(read('app/api/cron/[job]/route.ts'),/job === "backup"/);
});

test('every upload request states its exact Content-Length (R2 answers 411 otherwise)',async()=>{
 const dir=scratch();
 try{
  const file=path.join(dir,'f'),data=randomBytes(2500);writeFileSync(file,data);
  const seen=[];const r2=fakeR2();
  const recording=async request=>{if(['PUT','POST'].includes(request.method)&&!new URL(request.url).searchParams.has('uploads'))seen.push({method:request.method,length:request.headers.get('content-length')});return r2.fetch(request);};
  const store=backup.s3Bucket({endpoint:'https://abc123.eu.r2.cloudflarestorage.com',bucket:'estatemarket24-backups',accessKeyId:'a',secretAccessKey:'b'},recording);
  await backup.uploadFile(store,'mittwald-db/one',file,data.length,{},5000);
  await backup.uploadFile(store,'mittwald-db/multi',file,data.length,{},1000);
  await store.put('mittwald-db/m.json',JSON.stringify({ok:'ü'}),{'Content-Type':'application/json'});
  // single PUT, three parts, the multipart completion XML, then the JSON manifest
  assert.deepEqual(seen.slice(0,4).map(s=>s.length),['2500','1000','1000','500']);
  assert.equal(seen.at(-1).length,String(Buffer.byteLength(JSON.stringify({ok:'ü'}))));
  assert.ok(seen.every(s=>Number(s.length)>0),'every request with a body has a positive Content-Length');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
