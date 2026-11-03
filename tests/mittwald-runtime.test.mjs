// Node/Mittwald runtime pieces (docs/mittwald-migration.md): shared PostgreSQL rewriting and batch
// semantics for both drivers, driver selection, the former D1 tables on the main database, the
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

test('Neon HTTP adapter and TCP adapter share the same rewritten queries',async()=>{
 const neonCalls=[];const sql={query(q,v){neonCalls.push({q,v});return Promise.resolve([{ok:1}]);},transaction(items){return Promise.all(items);}};
 const {neonD1}=load('lib/neon-d1.ts',{'@neondatabase/serverless':{neon:()=>sql}});
 const pgCalls=[];let began=0;const tx={unsafe:async(text,values)=>{pgCalls.push({text,values});return [{ok:1}];}};
 const fakePostgres=()=>({...tx,begin:async fn=>{began++;return fn(tx);}});
 const node=load('lib/postgres-driver-node.ts',{postgres:fakePostgres});
 const source="SELECT l.id FROM listings l WHERE l.status='published' AND l.id=?";
 await neonD1('postgres://neon').prepare(source).bind('a').all();
 await node.postgresDriver('postgres://db/test').prepare(source).bind('a').all();
 const norm=t=>t.replace(/'\d{4}-\d\d-\d\dT[^']+'/g,"'T'");assert.equal(norm(pgCalls[0].text),norm(neonCalls[0].q));assert.match(pgCalls[0].text,/l\.id=\$1$/);
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

test('driver selection: TCP only in the Node build, Neon hosts keep HTTP unless forced',()=>{
 assert.equal(pg.databaseDriver('postgres://u:p@postgres:5432/app',undefined,false),'neon');
 assert.equal(pg.databaseDriver('postgres://u:p@postgres:5432/app','postgres',false),'neon');
 assert.equal(pg.databaseDriver('postgres://u:p@postgres:5432/app',undefined,true),'postgres');
 assert.equal(pg.databaseDriver('postgres://u:p@ep-x.eu-central-1.aws.neon.tech/db',undefined,true),'neon');
 assert.equal(pg.databaseDriver('postgres://u:p@ep-x.eu-central-1.aws.neon.tech/db','postgres',true),'postgres');
 assert.equal(pg.databaseDriver('postgres://u:p@postgres/app','neon',true),'neon');
});

test('Cloudflare bundle never sees postgres.js: only the Node-aliased module imports it',()=>{
 assert.match(read('lib/postgres-driver.ts'),/export const postgresDriver[\s\S]*?\| null = null;/);
 assert.doesNotMatch(read('lib/postgres-driver.ts'),/from\s+["']postgres["']/);
 assert.equal(load('lib/postgres-driver.ts').postgresDriver,null);
 assert.match(read('next.config.ts'),/"@\/lib\/postgres-driver":\s*"\.\/lib\/postgres-driver-node\.ts"/);
 assert.match(read('lib/server.ts'),/from "@\/lib\/postgres-driver"/);
 const files=dir=>(nativeRequire('node:fs').readdirSync(path.join(root,dir),{withFileTypes:true})).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.(ts|tsx)$/.test(e.name)?[path.join(dir,e.name).replaceAll('\\','/')]:[]);
 const importers=['app','lib','components','build'].flatMap(files).filter(f=>/from\s+["']postgres["']|require\(["']postgres["']\)/.test(read(f)));
 assert.deepEqual(importers,['lib/postgres-driver-node.ts']);
 assert.deepEqual(['app','lib','components','build'].flatMap(files).filter(f=>/(import|from)[^;\n]*postgres-driver-node/.test(read(f))),[]);
});

function sqlite(){const sql=new DatabaseSync(':memory:');return {sql,prepare(query){return {values:[],bind(...values){this.values=values;return this;},async first(){return sql.prepare(query).get(...this.values)||null;},async all(){return {results:sql.prepare(query).all(...this.values)};},async run(){return sql.prepare(query).run(...this.values);}};},async batch(statements){sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};}
test('former D1 tables are created on first use in the main database (no D1 migration needed)',async()=>{
 const ops=load('lib/operations.ts'),cache=load('lib/translation-cache.ts'),assistant=load('lib/assistant-server.ts'),service=load('lib/translation-service.ts');
 const db=sqlite(),original=globalThis.fetch;globalThis.fetch=async(url,init)=>{const body=JSON.parse(init.body);return Response.json({translations:body.text.map(text=>({text:'T: '+text,detected_source_language:'TR'}))});};
 try{
  const doc={kind:'listing',id:'fresh',fields:{title:'Deniz manzaralı daire'}};
  assert.equal((await cache.readTranslations(db,doc,'en')).complete,false);
  assert.equal((await cache.prepareTranslations(db,{DEEPL_API_KEY:'k:fx'},doc,'en')).status,'ready');
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
 for(const file of ['app/api/translations/route.ts','app/api/admin/translations/route.ts','app/api/assistant/route.ts','app/api/messages/route.ts','lib/translation-runtime.ts','lib/operations-runtime.ts','build/sites-worker.ts'])assert.doesNotMatch(read(file),/\.DB\b/,file);
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
test('private bucket: binding first, S3 adapter only without it',()=>{
 assert.match(read('lib/server.ts'),/export const bucket = \(\) => \(env as SiteEnv\)\.BUCKET \?\? privateBucket\(\);/);
 const {privateBucket}=load('lib/private-bucket.ts',{'./runtime':{env:{...settings,R2_PRIVATE_BUCKET_NAME:'other-bucket'}}});assert.equal(typeof privateBucket().get,'function');
 assert.equal(load('lib/private-bucket.ts',{'./runtime':{env:{}}}).privateBucket(),null);
});

const secret='s'.repeat(40);
function cronRoute(env,jobs={}){const calls=[];const route=load('app/api/cron/[job]/route.ts',{'@/lib/runtime':{env},'@/lib/cron-auth':load('lib/cron-auth.ts',{'./server':{sha256:async v=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))).toString('hex')}}),'@/lib/scheduled-jobs':{CRON_JOBS:['health','daily'],healthJob:async s=>{calls.push(['health',s]);return jobs.health||{checks:[{name:'database',ok:true}],alert:'healthy'};},dailyJobs:s=>{calls.push(['daily',s]);return {promotions:Promise.resolve(jobs.promotions??true),digest:Promise.resolve(true)};}}});return {route,calls};}
const cron=(route,job,token,method='GET')=>route[method](new Request('https://site.test/api/cron/'+job,{method,headers:token===undefined?{}:{Authorization:token}}),{params:Promise.resolve({job})});
test('cron endpoint: disabled without a long CRON_SECRET, 401 on wrong token, runs the shared jobs',async()=>{
 for(const env of [{},{CRON_SECRET:''},{CRON_SECRET:'short'}]){const {route,calls}=cronRoute(env);assert.equal((await cron(route,'health','Bearer short')).status,404);assert.equal(calls.length,0);}
 const {route,calls}=cronRoute({CRON_SECRET:secret,ALERT_EMAIL:'ops@example.invalid'});
 assert.equal((await cron(route,'unknown','Bearer '+secret)).status,404);
 for(const token of [undefined,'','Bearer ','Bearer '+secret.slice(1),'Bearer '+secret+'x',secret,'Basic '+secret])assert.equal((await cron(route,'health',token)).status,401,String(token));
 assert.equal(calls.length,0);
 const health=await cron(route,'health','Bearer '+secret);assert.equal(health.status,200);assert.equal(health.headers.get('cache-control'),'no-store');assert.equal((await health.json()).ok,true);
 const daily=await cron(route,'daily','Bearer '+secret,'POST');assert.equal(daily.status,200);assert.deepEqual(await daily.json(),{job:'daily',ok:true,promotions:true,digest:true});
 assert.deepEqual(calls.map(c=>c[0]),['health','daily']);assert.equal(calls[0][1].ALERT_EMAIL,'ops@example.invalid');
 const failing=cronRoute({CRON_SECRET:secret},{health:{checks:[{name:'database',ok:false}],alert:'alerted'},promotions:false});
 assert.equal((await cron(failing.route,'health','Bearer '+secret)).status,503);assert.equal((await cron(failing.route,'daily','Bearer '+secret)).status,500);
});
test('Cloudflare cron and the endpoint share one implementation',()=>{
 const worker=read('build/sites-worker.ts');assert.match(worker,/healthJob\(settings\)/);assert.match(worker,/dailyJobs\(settings\)/);assert.doesNotMatch(worker,/runHealthChecks|sendDailyDigests|expirePromotions/);
 assert.match(read('wrangler.jsonc'),/"7 \* \* \* \*"/);
});
test('liveness endpoint answers without touching database or storage',async()=>{
 const live=load('app/api/health/live/route.ts');assert.doesNotMatch(read('app/api/health/live/route.ts'),/import/);
 const r=live.GET();assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(live.HEAD().status,200);
});
