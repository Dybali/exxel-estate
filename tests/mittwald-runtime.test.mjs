// Node/Mittwald runtime pieces (docs/mittwald-migration.md): PostgreSQL rewriting and batch
// semantics, driver selection, the former D1 tables on the main database, the
// S3-backed private bucket, the protected cron endpoint and the liveness endpoint.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),nativeRequire=createRequire(import.meta.url);
function load(file,overrides={}){const full=path.resolve(root,file),module={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(overrides[name])return overrides[name];if(name.startsWith('.')||name.startsWith('@/')){const resolved=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return resolved.endsWith('.json')?JSON.parse(readFileSync(resolved,'utf8')):load(resolved+'.ts',overrides);}return nativeRequire(name);},module,module.exports);return module.exports;}
const read=file=>readFileSync(path.join(root,file),'utf8');

const pg=load('lib/pg-d1.ts');
test('SQL rewriting: placeholders, INSERT OR IGNORE, json_each, presentation JSON and publication expiry',()=>{
 assert.equal(pg.pgQuery('SELECT * FROM users WHERE id=? AND email=?'),'SELECT * FROM users WHERE id=$1 AND email=$2');
 assert.equal(pg.pgQuery('INSERT OR IGNORE INTO favorites(user_id,listing_id) VALUES(?,?)'),'INSERT INTO favorites(user_id,listing_id) VALUES($1,$2) ON CONFLICT DO NOTHING');
 assert.equal(pg.pgQuery('INSERT INTO favorites(a) VALUES(?) ON CONFLICT(a) DO NOTHING'),'INSERT INTO favorites(a) VALUES($1) ON CONFLICT(a) DO NOTHING');
 assert.match(pg.pgQuery('SELECT 1 FROM listings l WHERE EXISTS(SELECT 1 FROM json_each(l.amenities) WHERE value=?)'),/jsonb_array_elements_text\(l\.amenities::jsonb\) WHERE value=\$1/);
 assert.match(pg.pgQuery("SELECT json_extract(l.presentation,'$.land.zoning') FROM listings l"),/l\.presentation::jsonb->'land'->>'zoning'/);
 const q=pg.pgQuery("SELECT l.id FROM listings l WHERE l.status='published' AND l.city=?");assert.match(q,/l\.expires_at IS NULL OR l\.expires_at>'/);assert.match(q,/l\.city=\$1$/);
 assert.equal(pg.pgQuery("UPDATE listings SET status='published' WHERE id=?"),"UPDATE listings SET status='published' WHERE id=$1");
});

function fakeClient(){const calls=[];return {calls,client:{async query(text,values){calls.push({kind:'query',text,values:[...values]});return [{n:1,text}];},async transaction(queries){calls.push({kind:'transaction',queries:queries.map(q=>({text:q.text,values:[...q.values]}))});return queries.map((q,i)=>[{i}]);}}};}
test('D1 surface: bind/first/all/run and batch as one transaction in order',async()=>{
 const {calls,client}=fakeClient(),db=pg.pgD1(client);
 assert.deepEqual((await db.prepare('SELECT * FROM t WHERE a=? AND b=?').bind('x').bind(2).all()).results,[{n:1,text:'SELECT * FROM t WHERE a=$1 AND b=$2'}]);
 assert.deepEqual(calls[0].values,['x',2]);
 assert.equal((await db.prepare('SELECT 1').first()).n,1);
 assert.deepEqual(await db.prepare('DELETE FROM t WHERE a=?').bind(null).run(),{success:true});
 const result=await db.batch([db.prepare('UPDATE a SET x=? WHERE id=?').bind(1,'a'),db.prepare('INSERT OR IGNORE INTO b(x) VALUES(?)').bind(true)]);
 assert.deepEqual(result,[[{i:0}],[{i:1}]]);
 assert.deepEqual(calls.at(-1),{kind:'transaction',queries:[{text:'UPDATE a SET x=$1 WHERE id=$2',values:[1,'a']},{text:'INSERT INTO b(x) VALUES($1)',values:[true]}]});
 const empty=pg.pgD1({async query(){return [];},async transaction(){return [];}});assert.equal(await empty.prepare('SELECT 1').first(),null);
});

test('TCP adapter rewrites SQLite-style queries for PostgreSQL and enforces listing expiry',async()=>{
 const pgCalls=[];let began=0;const tx={unsafe:async(text,values)=>{pgCalls.push({text,values});return [{ok:1}];}};
 const fakePostgres=()=>({...tx,begin:async fn=>{began++;return fn(tx);}});
 const node=load('lib/postgres-driver-node.ts',{postgres:fakePostgres});
 const source="SELECT l.id FROM listings l WHERE l.status='published' AND l.id=?";
 await node.postgresDriver('postgres://db/test').prepare(source).bind('a').all();
 const norm=t=>t.replace(/'\d{4}-\d\d-\d\dT[^']+'/g,"'T'");assert.match(norm(pgCalls[0].text),/expires_at/);assert.match(pgCalls[0].text,/l\.id=\$1$/);
 assert.deepEqual(pgCalls[0].values,['a']);
 const out=await node.postgresDriver('postgres://db/test').batch([node.postgresDriver('postgres://db/test').prepare('UPDATE t SET a=? WHERE b=?').bind(undefined,1)]);
 assert.equal(began,1);assert.deepEqual(pgCalls.at(-1),{text:'UPDATE t SET a=$1 WHERE b=$2',values:[null,1]});assert.deepEqual(out,[[{ok:1}]]);
});

test('TCP batch: a failing statement rejects the whole transaction',async()=>{
 const node=load('lib/postgres-driver-node.ts',{postgres:()=>({})});const seen=[];
 const tx={unsafe:async text=>{seen.push(text);if(text.includes('fail'))throw Error('constraint');return [];}};
 const client=node.postgresClient({unsafe:tx.unsafe,begin:async fn=>{try{return await fn(tx);}catch(e){seen.push('ROLLBACK');throw e;}}});
 await assert.rejects(()=>client.transaction([{text:'ok',values:[]},{text:'fail',values:[]},{text:'never',values:[]}]),/constraint/);
 assert.deepEqual(seen,['ok','fail','ROLLBACK']);
});

test('one database driver: TCP PostgreSQL in the Node build; Neon is gone from the code',()=>{
 assert.equal(pg.databaseDriver('postgres://u:p@postgres:5432/app',true),'postgres');
 assert.equal(pg.databaseDriver('postgres://u:p@postgres:5432/app',false),'none');
 assert.equal(pg.databaseDriver('',true),'none');
 assert.equal(nativeRequire('node:fs').existsSync(path.join(root,'lib/neon-d1.ts')),false);
 assert.equal(JSON.parse(read('package.json')).dependencies['@neondatabase/serverless'],undefined);
 assert.doesNotMatch(read('lib/server.ts'),/neonD1|neon-d1/);
});

test('Cloudflare bundle never sees postgres.js: only the Node-aliased module imports it',()=>{
 assert.match(read('lib/postgres-driver.ts'),/export const postgresDriver[\s\S]*?\| null = null;/);
 assert.doesNotMatch(read('lib/postgres-driver.ts'),/from\s+["']postgres["']/);
 assert.equal(load('lib/postgres-driver.ts').postgresDriver,null);
 assert.match(read('next.config.ts'),/"@\/lib\/postgres-driver":\s*"\.\/lib\/postgres-driver-node\.ts"/);
 assert.match(read('lib/server.ts'),/from "@\/lib\/postgres-driver"/);
 const files=dir=>(nativeRequire('node:fs').readdirSync(path.join(root,dir),{withFileTypes:true})).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.(ts|tsx)$/.test(e.name)?[path.join(dir,e.name).replaceAll('\\','/')]:[]);
 const importers=['app','lib','components'].flatMap(files).filter(f=>/from\s+["']postgres["']|require\(["']postgres["']\)/.test(read(f)));
 assert.deepEqual(importers,['lib/postgres-driver-node.ts']);
 assert.deepEqual(['app','lib','components'].flatMap(files).filter(f=>/(import|from)[^;\n]*postgres-driver-node/.test(read(f))),[]);
});

function sqlite(){const sql=new DatabaseSync(':memory:');return {sql,prepare(query){return {values:[],bind(...values){this.values=values;return this;},async first(){return sql.prepare(query).get(...this.values)||null;},async all(){return {results:sql.prepare(query).all(...this.values)};},async run(){return sql.prepare(query).run(...this.values);}};},async batch(statements){sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};}
test('former D1 tables are created on first use in the main database (no D1 migration needed)',async()=>{
 const ops=load('lib/operations.ts'),cache=load('lib/translation-cache.ts'),assistant=load('lib/assistant-server.ts'),service=load('lib/translation-service.ts');
 const db=sqlite(),original=globalThis.fetch;globalThis.fetch=async(url,init)=>{const input=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({items:input.texts.map(text=>({text:'T: '+text,source:'tr'}))})}]}}],usageMetadata:{promptTokenCount:3,candidatesTokenCount:4}});};
 try{
  const doc={kind:'listing',id:'fresh',fields:{title:'Deniz manzaralı daire'}};
  assert.equal((await cache.readTranslations(db,doc,'en')).complete,false);
  assert.equal((await cache.prepareTranslations(db,{GEMINI_API_KEY:'k'},doc,'en')).status,'ready');
  assert.equal((await cache.readTranslations(db,doc,'en')).complete,true);
  const record=await assistant.reserveAssistantUsage(db,'client',400,new Date('2026-11-03T10:00:00Z'));await record({input:10,output:5});
  await ops.recordOperation(db,'http','500');await ops.recordOperation(null,'http','500');
  await service.pauseTranslationService(db,'provider_quota');assert.ok((await service.translationServicePause(db)).retryAt>Date.now());
  const tables=db.sql.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r=>r.name);
  assert.deepEqual(tables,['ai_monthly_usage','ai_usage_limits','content_translations','operations_events','translation_leases','translation_service_state','translation_usage']);
 }finally{globalThis.fetch=original;db.sql.close();}
 // Millisecond timestamps overflow PostgreSQL INTEGER.
 // PostgreSQL cannot type a bare parameter in a SELECT list.
 assert.match(read('lib/operations.ts'),/SELECT CAST\(\? AS TEXT\),COALESCE/);
 assert.match(read('lib/operations.ts'),/lease_until BIGINT/);assert.match(read('lib/translation-service.ts'),/blocked_until BIGINT/);
 for(const file of ['app/api/translations/route.ts','app/api/admin/translations/route.ts','app/api/assistant/route.ts','app/api/messages/route.ts','lib/translation-runtime.ts','lib/operations-runtime.ts'])assert.doesNotMatch(read(file),/\.DB\b/,file);
});

function storage(responses){const calls=[];const original=globalThis.fetch;globalThis.fetch=async(request)=>{const r=request instanceof Request?request:new Request(request);calls.push({method:r.method,url:r.url,headers:Object.fromEntries(r.headers),body:r.method==='PUT'?new Uint8Array(await r.arrayBuffer()):null});const next=responses.shift();return typeof next==='function'?next(r):next;};return {calls,restore:()=>{globalThis.fetch=original;}};}
const settings={R2_ENDPOINT:'https://abc123.eu.r2.cloudflarestorage.com',R2_ACCESS_KEY_ID:'id',R2_SECRET_ACCESS_KEY:'secret'};
test('private bucket over the S3 API: configuration, get/head/put/delete/list',async()=>{
 const {s3PrivateBucket}=load('lib/private-bucket.ts',{'./runtime':{env:{}}});
 assert.equal(s3PrivateBucket({}),null);
 assert.throws(()=>s3PrivateBucket({...settings,R2_ENDPOINT:'https://evil.example'}),/invalid/);
 const bucket=s3PrivateBucket(settings);
 const meta={'content-type':'application/pdf','content-length':'3',etag:'"abc"','last-modified':'Tue, 03 Nov 2026 10:00:00 GMT','x-amz-meta-owner':'u1'};
 const s=storage([new Response('pdf',{headers:meta}),new Response(null,{status:404}),new Response(null,{headers:meta}),new Response(null,{status:412}),new Response(null,{headers:meta}),new Response(null,{headers:{etag:'"new"'}}),new Response(null,{status:204}),new Response(null,{status:404}),
  new Response('<?xml version="1.0"?><ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>n&amp;2</NextContinuationToken><Contents><Key>private/a b.pdf</Key><Size>3</Size><ETag>&quot;abc&quot;</ETag><LastModified>2026-11-03T10:00:00.000Z</LastModified></Contents></ListBucketResult>')]);
 try{
  const object=await bucket.get('private/office-verifications/u1/doc.pdf');assert.equal(await object.text(),'pdf');assert.equal(object.size,3);assert.equal(object.httpMetadata.contentType,'application/pdf');assert.equal(object.httpEtag,'"abc"');
  assert.equal(s.calls[0].url,'https://abc123.eu.r2.cloudflarestorage.com/exxel-estate-private/private/office-verifications/u1/doc.pdf');assert.match(s.calls[0].headers.authorization,/^AWS4-HMAC-SHA256 Credential=id\//);
  assert.equal(await bucket.get('missing.jpg'),null);
  const head=await bucket.head('k');assert.equal(head.customMetadata.owner,'u1');assert.equal(head.uploaded.toISOString(),'2026-11-03T10:00:00.000Z');const h=new Headers();head.writeHttpMetadata(h);assert.equal(h.get('content-type'),'application/pdf');
  const changed=await bucket.get('k',{onlyIf:{etagMatches:'old'}});assert.equal(s.calls[3].headers['if-match'],'"old"');assert.equal('body' in changed,false);assert.equal(changed.etag,'abc');
  const put=await bucket.put('captures/u/j/x.jpg',new Uint8Array([1,2,3]),{httpMetadata:{contentType:'image/jpeg'}});assert.equal(s.calls[5].method,'PUT');assert.equal(s.calls[5].headers['content-type'],'image/jpeg');assert.deepEqual([...s.calls[5].body],[1,2,3]);assert.equal(put.etag,'new');assert.equal(put.size,3);
  await bucket.delete(['a.jpg','b.jpg']);assert.deepEqual(s.calls.slice(6,8).map(c=>[c.method,c.url.split('/').pop()]),[['DELETE','a.jpg'],['DELETE','b.jpg']]);
  const page=await bucket.list({limit:500,cursor:'c1',prefix:'private/'});const url=new URL(s.calls[8].url);
  assert.equal(url.searchParams.get('max-keys'),'500');assert.equal(url.searchParams.get('continuation-token'),'c1');assert.equal(url.searchParams.get('prefix'),'private/');assert.equal(url.searchParams.get('list-type'),'2');
  assert.deepEqual(page.objects.map(o=>[o.key,o.size,o.httpEtag,o.uploaded.toISOString()]),[['private/a b.pdf',3,'"abc"','2026-11-03T10:00:00.000Z']]);assert.equal(page.truncated,true);assert.equal(page.cursor,'n&2');
  await assert.rejects(()=>bucket.get('../secret'),/Invalid object key/);
 }finally{s.restore();}
});
test('private bucket: always the S3 adapter',()=>{
 assert.match(read('lib/server.ts'),/export const bucket = \(\) => privateBucket\(\);/);
 const {privateBucket}=load('lib/private-bucket.ts',{'./runtime':{env:{...settings,R2_PRIVATE_BUCKET_NAME:'other-bucket'}}});assert.equal(typeof privateBucket().get,'function');
 assert.equal(load('lib/private-bucket.ts',{'./runtime':{env:{}}}).privateBucket(),null);
});

const secret='s'.repeat(40);
function cronRoute(env,jobs={}){const calls=[];const route=load('app/api/cron/[job]/route.ts',{'@/lib/runtime':{env},'@/lib/cron-auth':load('lib/cron-auth.ts',{'./server':{sha256:async v=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))).toString('hex')}}),'@/lib/scheduled-jobs':{CRON_JOBS:['health','daily','backup'],backupJob:async s=>{calls.push(['backup',s]);return jobs.backup??{status:'ok',ms:1};},healthJob:async s=>{calls.push(['health',s]);return jobs.health||{checks:[{name:'database',ok:true}],alert:'healthy'};},dailyJobs:s=>{calls.push(['daily',s]);return {promotions:Promise.resolve(jobs.promotions??true),digest:Promise.resolve(true),videos:Promise.resolve(jobs.videos??true),backup:Promise.resolve(jobs.backup??{status:'skipped',reason:'r',ms:0})};}}});return {route,calls};}
const cron=(route,job,token,method='GET')=>route[method](new Request('https://site.test/api/cron/'+job,{method,headers:token===undefined?{}:{Authorization:token}}),{params:Promise.resolve({job})});
test('cron endpoint: disabled without a long CRON_SECRET, 401 on wrong token, runs the shared jobs',async()=>{
 for(const env of [{},{CRON_SECRET:''},{CRON_SECRET:'short'}]){const {route,calls}=cronRoute(env);assert.equal((await cron(route,'health','Bearer short')).status,404);assert.equal(calls.length,0);}
 const {route,calls}=cronRoute({CRON_SECRET:secret,ALERT_EMAIL:'ops@example.invalid'});
 assert.equal((await cron(route,'unknown','Bearer '+secret)).status,404);
 for(const token of [undefined,'','Bearer ','Bearer '+secret.slice(1),'Bearer '+secret+'x',secret,'Basic '+secret])assert.equal((await cron(route,'health',token)).status,401,String(token));
 assert.equal(calls.length,0);
 const health=await cron(route,'health','Bearer '+secret);assert.equal(health.status,200);assert.equal(health.headers.get('cache-control'),'no-store');assert.equal((await health.json()).ok,true);
 const daily=await cron(route,'daily','Bearer '+secret,'POST');assert.equal(daily.status,200);assert.deepEqual(await daily.json(),{job:'daily',ok:true,promotions:true,digest:true,videos:true,backup:{status:'skipped',reason:'r',ms:0}});
 assert.deepEqual(calls.map(c=>c[0]),['health','daily']);assert.equal(calls[0][1].ALERT_EMAIL,'ops@example.invalid');
 const failing=cronRoute({CRON_SECRET:secret},{health:{checks:[{name:'database',ok:false}],alert:'alerted'},promotions:false});
 assert.equal((await cron(failing.route,'health','Bearer '+secret)).status,503);assert.equal((await cron(failing.route,'daily','Bearer '+secret)).status,500);
 const videoFailure=cronRoute({CRON_SECRET:secret},{videos:false});assert.equal((await cron(videoFailure.route,'daily','Bearer '+secret)).status,500);
 const backupFailure=cronRoute({CRON_SECRET:secret},{backup:{status:'failed',error:'x',ms:1}});assert.equal((await cron(backupFailure.route,'daily','Bearer '+secret)).status,500);
 const manual=await cron(backupFailure.route,'backup','Bearer '+secret,'POST');assert.equal(manual.status,500);assert.deepEqual(await manual.json(),{job:'backup',ok:false,backup:{status:'failed',error:'x',ms:1}});assert.equal(backupFailure.calls.filter(c=>c[0]==='backup').length,1);
 const manualOk=cronRoute({CRON_SECRET:secret});assert.equal((await cron(manualOk.route,'backup','Bearer '+secret)).status,200);assert.equal((await cron(manualOk.route,'backup','Bearer wrong')).status,401);
});
test('the Cloudflare build is gone: no Worker, wrangler or vinext; Node is the only runtime',()=>{
 const fs=nativeRequire('node:fs');
 for(const file of ['wrangler.jsonc','vite.config.ts','build/sites-worker.ts','cloudflare-env.d.ts','scripts/run-framework.mjs','db/index.ts'])assert.equal(fs.existsSync(path.join(root,file)),false,file);
 const pkg=JSON.parse(read('package.json'));for(const name of ['wrangler','vinext','vite','@cloudflare/workers-types','@cloudflare/vite-plugin'])assert.equal(pkg.devDependencies[name]??pkg.dependencies[name],undefined,name);
 assert.doesNotMatch(JSON.stringify(pkg.scripts),/wrangler|vinext|deploy/);
 assert.doesNotMatch(read('lib/runtime.ts'),/cloudflare:workers/);assert.doesNotMatch(read('next.config.ts'),/EXXEL_NODE_BUILD|cloudflare:workers/);
});
test('liveness endpoint answers without touching database or storage',async()=>{
 const live=load('app/api/health/live/route.ts');assert.doesNotMatch(read('app/api/health/live/route.ts'),/import/);
 const r=live.GET();assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(live.HEAD().status,200);
});

// Startup migrations (instrumentation.ts -> lib/postgres-migrations.ts) for the Mittwald PostgreSQL.
function fakeMigrationSql(applied=[],failOn=null){const log=[];const run=(where)=>async(text,values=[])=>{log.push([where,text.trim().split(/\s+/).slice(0,3).join(' '),...values]);if(failOn&&text.includes(failOn))throw Error('boom');if(/^SELECT version FROM schema_migrations/.test(text))return applied.map(version=>({version}));return [];};
 return {log,sql:{unsafe:run('sql'),begin:async work=>{log.push(['BEGIN']);try{const out=await work({unsafe:run('tx')});log.push(['COMMIT']);return out;}catch(e){log.push(['ROLLBACK']);throw e;}}}};}
const quiet={info(){},warn(){}};
test('startup migrations: baseline 018, valid names only, skip applied, apply in order',async()=>{
 const m=load('lib/postgres-migrations.ts');assert.equal(m.MIGRATION_BASELINE,18);
 const files=['017_lead_notes.sql','020_c.sql','001_core.sql','018_individual_listing_45_days.sql','019_b.sql','19_bad.sql','021_Bad.sql','022_x.sql.bak','README.md'];
 assert.deepEqual(m.pendingMigrations(files,['019_b.sql']),['018_individual_listing_45_days.sql','020_c.sql']);
 const {log,sql}=fakeMigrationSql(['019_b.sql']);const read=[];const warned=[];
 const applied=await m.applyMigrations(sql,files,async f=>{read.push(f);return 'SELECT '+f.slice(0,3)+'; CREATE FUNCTION f() RETURNS void AS $$ BEGIN END $$ LANGUAGE plpgsql;';},{info(){},warn:w=>warned.push(w)});
 assert.deepEqual(applied,['018_individual_listing_45_days.sql','020_c.sql']);assert.deepEqual(read,applied);
 assert.deepEqual(warned.map(w=>w.split(' ').pop()),['19_bad.sql','021_Bad.sql']);
 assert.deepEqual(log,[['sql','SELECT pg_advisory_lock($1)',m.MIGRATION_LOCK_KEY],['sql','CREATE TABLE IF'],['sql','SELECT version FROM'],
  ['BEGIN'],['tx','SELECT 018; CREATE'],['tx','INSERT INTO schema_migrations(version)','018_individual_listing_45_days.sql'],['COMMIT'],
  ['BEGIN'],['tx','SELECT 020; CREATE'],['tx','INSERT INTO schema_migrations(version)','020_c.sql'],['COMMIT'],
  ['sql','SELECT pg_advisory_unlock($1)',m.MIGRATION_LOCK_KEY]]);
 // File text goes through without parameters (simple protocol: several statements and $$ bodies).
 const up=fakeMigrationSql(['018_individual_listing_45_days.sql','020_c.sql','019_b.sql']);assert.deepEqual(await m.applyMigrations(up.sql,files,async()=>{throw Error('no read');},quiet),[]);assert.equal(up.log.filter(e=>e[0]==='BEGIN').length,0);assert.equal(up.log.at(-1)[1],'SELECT pg_advisory_unlock($1)');
});
test('startup migrations: a failing file rolls back, stops later files and releases the lock',async()=>{
 const m=load('lib/postgres-migrations.ts');const {log,sql}=fakeMigrationSql([],'BROKEN');
 await assert.rejects(()=>m.applyMigrations(sql,['018_a.sql','019_b.sql','020_c.sql'],async f=>f==='019_b.sql'?'BROKEN':'SELECT 1',quiet),/boom/);
 assert.deepEqual(log.filter(e=>e[0]==='BEGIN'||e[0]==='COMMIT'||e[0]==='ROLLBACK').map(e=>e[0]),['BEGIN','COMMIT','BEGIN','ROLLBACK']);
 assert.ok(!log.some(e=>e.includes('020_c.sql')));assert.equal(log.at(-1)[1],'SELECT pg_advisory_unlock($1)');
});
test('startup migrations: runner only in the Node build, skipped without a TCP database, never throws',async()=>{
 assert.equal(load('lib/postgres-driver.ts').runStartupMigrations,null);
 const instrumentation=read('instrumentation.ts');assert.match(instrumentation,/process\.env\.NEXT_RUNTIME !== "nodejs"/);assert.match(instrumentation,/import\("@\/lib\/postgres-driver"\)/);assert.doesNotMatch(instrumentation,/(import|from)[^;\n]*(postgres-driver-node|["']postgres["'])/);
 assert.match(read('Dockerfile'),/COPY --from=build --chown=node:node \/app\/postgres\/migrations \.\/postgres\/migrations/);
 let connected=0;const node=load('lib/postgres-driver-node.ts',{postgres:()=>{connected++;throw Error('ECONNREFUSED');}});
 const original={info:console.info,error:console.error};const lines=[];console.info=l=>lines.push(l);console.error=l=>lines.push(l);
 try{
  await node.runStartupMigrations({});assert.equal(connected,0);
  await node.runStartupMigrations({DATABASE_URL:'postgres://u:p@postgres:5432/app'});assert.equal(connected,1);
 }finally{console.info=original.info;console.error=original.error;}
 assert.match(lines[0],/skipped/);assert.match(lines[1],/failed.*ECONNREFUSED.*keeps running/);assert.ok(!lines.join('\n').includes('u:p@'));
 for(const f of nativeRequire("node:fs").readdirSync(path.join(root,'postgres/migrations')))assert.match(f,/^\d{3}_[a-z0-9_]+\.sql$/,f);
});
