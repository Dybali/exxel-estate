import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {DatabaseSync} from 'node:sqlite';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url),cache=new Map();
function load(file){const full=path.resolve(root,file);if(cache.has(full))return cache.get(full);const m={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(name.startsWith('.')||name.startsWith('@/')){const p=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return p.endsWith('.json')?JSON.parse(readFileSync(p,'utf8')):load(p+'.ts');}return native(name);},m,m.exports);cache.set(full,m.exports);return m.exports;}
const B=load('lib/translation-batch.ts'),C=load('lib/translation-cache.ts');

// Nightly batch translation of XML imports (lib/translation-batch.ts) with a mocked Gemini Batch API.
function database(){const sql=new DatabaseSync(':memory:');return {sql,prepare(query){return {values:[],bind(...values){this.values=values;return this;},async first(){return sql.prepare(query).get(...this.values)||null;},async all(){return {results:sql.prepare(query).all(...this.values)};},async run(){return sql.prepare(query).run(...this.values);}};},async batch(statements){for(const s of statements)await s.run();}};}
const settings={GEMINI_API_KEY:'fixture-key'};
const doc=(id,title)=>({kind:'listing',id,fields:{title,description:'Deniz manzaralı, havuzlu site içinde 3+1 daire.'}});
const source=listings=>async id=>{const item=listings[id];if(item===undefined)return null;if(item==='waiting')return 'waiting';return ['en','de'].map(locale=>({locale,doc:item}));};
const answer=(texts,prefix)=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({items:texts.map(t=>({text:prefix+t,source:'tr'}))})}]}}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:20}});

test('submit: one request per listing and language, queue cleared, waiting listings kept, one job at a time',async()=>{
 const db=database(),calls=[];
 const fetcher=async(url,init)=>{calls.push({url,body:JSON.parse(init.body),headers:init.headers});return Response.json({name:'batches/abc123'});};
 for(const id of ['a','b','w','gone'])await B.queueBatchTranslation(db,id);
 const result=await B.submitTranslationBatch(db,settings,source({a:doc('a','Villa A'),b:doc('b','Villa B'),w:'waiting'}),fetcher);
 assert.equal(result.status,'submitted');assert.equal(result.name,'batches/abc123');assert.equal(result.requests,4);
 assert.match(calls[0].url,/models\/gemini-3\.5-flash-lite:batchGenerateContent$/);assert.equal(calls[0].headers['x-goog-api-key'],'fixture-key');
 const requests=calls[0].body.batch.input_config.requests.requests;
 assert.deepEqual(requests.map(r=>r.metadata.key),['0','1','2','3']);
 assert.deepEqual(JSON.parse(requests[0].request.contents[0].parts[0].text),{target:'en',texts:['Villa A','Deniz manzaralı, havuzlu site içinde 3+1 daire.']});
 assert.deepEqual(requests[0].request.generationConfig.thinkingConfig,{thinkingLevel:'minimal'});
 assert.deepEqual(db.sql.prepare('SELECT listing_id FROM translation_batch_queue').all().map(r=>r.listing_id),['w'],'only the listing waiting for review stays');
 assert.ok(db.sql.prepare("SELECT characters FROM translation_usage WHERE key LIKE 'day:%'").get().characters>0);
 assert.equal((await B.submitTranslationBatch(db,settings,source({}),fetcher)).status,'busy');assert.equal(calls.length,1);
});

test('submit: already translated languages are skipped; nothing to do leaves no job; caps and billing are respected',async()=>{
 const db=database();let calls=0;const fetcher=async()=>{calls++;return Response.json({name:'batches/x'});};
 const d=doc('a','Villa A');
 // English already in the cache (e.g. a visitor opened it): only German is requested.
 const segments=await (load('lib/translation.ts')).translationSegments(d,'en');await C.readTranslations(db,d,'en');
 for(const s of segments)db.sql.prepare('INSERT INTO content_translations(key,translated_text,detected_language,created_at) VALUES(?,?,?,?)').run(s.key,'EN '+s.text,'tr','2026-11-12');
 await B.queueBatchTranslation(db,'a');
 let body;const capture=async(url,init)=>{body=JSON.parse(init.body);return Response.json({name:'batches/one'});};
 assert.equal((await B.submitTranslationBatch(db,settings,source({a:d}),capture)).requests,1);
 assert.equal(JSON.parse(body.batch.input_config.requests.requests[0].request.contents[0].parts[0].text).target,'de');
 const empty=database();await B.queueBatchTranslation(empty,'gone');
 assert.equal((await B.submitTranslationBatch(empty,settings,source({}),fetcher)).status,'empty');assert.equal(calls,0);
 const capped=database();await B.queueBatchTranslation(capped,'a');
 assert.equal((await B.submitTranslationBatch(capped,{...settings,TRANSLATION_DAILY_CHAR_LIMIT:'10'},source({a:d}),fetcher)).status,'daily_limit');assert.equal(calls,0);
 assert.equal(capped.sql.prepare('SELECT COUNT(*) AS n FROM translation_batch_queue').get().n,1,'stays queued for tomorrow');
 const free=database();await B.queueBatchTranslation(free,'a');
 const billing=await B.submitTranslationBatch(free,settings,source({a:d}),async()=>Response.json({error:{code:400,status:'FAILED_PRECONDITION'}},{status:400}));
 assert.equal(billing.status,'billing_required');assert.equal(free.sql.prepare('SELECT COUNT(*) AS n FROM translation_batch_queue').get().n,1);
 assert.equal((await B.submitTranslationBatch(free,{},source({a:d}),fetcher)).status,'not_configured');
});

test('poll: a finished job fills the translation cache (either response shape); running jobs wait; failed jobs requeue',async()=>{
 for(const shape of ['response','dest']){
  const db=database(),d=doc('a','Villa A');let submitted;
  await B.queueBatchTranslation(db,'a');
  await B.submitTranslationBatch(db,settings,source({a:d}),async(url,init)=>{submitted=JSON.parse(init.body).batch.input_config.requests.requests;return Response.json({name:'batches/job1'});});
  let state='JOB_STATE_RUNNING';
  const fetcher=async url=>{assert.match(url,/\/v1beta\/batches\/job1$/);const inlined=submitted.map(r=>({metadata:r.metadata,response:answer(JSON.parse(r.request.contents[0].parts[0].text).texts,JSON.parse(r.request.contents[0].parts[0].text).target+': ')})).reverse();
   return Response.json({name:'batches/job1',metadata:{state},...(state.endsWith('SUCCEEDED')?{[shape]:{inlinedResponses:{inlinedResponses:inlined}}}:{})});};
  assert.deepEqual(await B.pollTranslationBatches(db,settings,fetcher),{checked:1,saved:0});
  assert.equal((await C.readTranslations(db,d,'de')).complete,false);
  state='JOB_STATE_SUCCEEDED';
  assert.deepEqual(await B.pollTranslationBatches(db,settings,fetcher),{checked:1,saved:4});
  const de=await C.readTranslations(db,d,'de');assert.equal(de.complete,true);assert.equal(de.fields.title,'de: Villa A');
  assert.equal((await C.readTranslations(db,d,'en')).fields.title,'en: Villa A');
  assert.deepEqual(await B.pollTranslationBatches(db,settings,fetcher),{checked:0,saved:0},'finished jobs are not asked again');
 }
 const db=database();await B.queueBatchTranslation(db,'a');
 await B.submitTranslationBatch(db,settings,source({a:doc('a','Villa A')}),async()=>Response.json({name:'batches/bad'}));
 await B.pollTranslationBatches(db,settings,async()=>Response.json({name:'batches/bad',state:'BATCH_STATE_EXPIRED'}));
 assert.equal(db.sql.prepare("SELECT state FROM translation_batch_jobs").get().state,'EXPIRED');
 assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM translation_batch_queue').get().n,1,'listings go back to the queue');
});

test('response helpers read every documented location',()=>{
 assert.equal(B.batchState({metadata:{state:'JOB_STATE_SUCCEEDED'}}),'SUCCEEDED');assert.equal(B.batchState({state:'BATCH_STATE_RUNNING'}),'RUNNING');
 const r=[{metadata:{key:'0'}}];
 for(const data of [{response:{inlinedResponses:{inlinedResponses:r}}},{response:{inlinedResponses:r}},{dest:{inlinedResponses:r}},{metadata:{output:{inlinedResponses:{inlinedResponses:r}}}}])assert.deepEqual(B.batchResponses(data),r);
 assert.deepEqual(B.batchResponses({}),[]);
});

test('without billing: the queue waits for one nightly attempt, then a few listings an hour are translated directly; billing brings the batch back',async()=>{
 const db=database(),d=doc('a','Villa A'),done=[];
 const translate=async(item,locale)=>{done.push(item.id+':'+locale);return 'done';};
 const night=new Date('2026-11-13T06:00:00Z'),hour=new Date('2026-11-13T07:00:00Z');
 assert.equal((await B.translateQueueDirectly(db,settings,source({a:d}),translate,hour)).status,'batch','nothing direct while the batch works');
 for(const id of ['a','b','w','gone'])await B.queueBatchTranslation(db,id,new Date('2026-11-12T20:00:00Z'));
 const refused=async()=>Response.json({error:{code:400,status:'FAILED_PRECONDITION'}},{status:400});
 assert.equal((await B.submitTranslationBatch(db,settings,source({a:d,b:doc('b','Villa B'),w:'waiting'}),refused,night)).status,'billing_required');
 assert.equal((await B.batchMode(db)).mode,'direct');
 await B.queueBatchTranslation(db,'late',new Date('2026-11-13T06:30:00Z'));
 const result=await B.translateQueueDirectly(db,settings,source({a:d,b:doc('b','Villa B'),w:'waiting',late:doc('late','Villa C')}),translate,hour);
 assert.deepEqual(result,{status:'done',listings:2});
 assert.deepEqual(done,['a:en','a:de','b:en','b:de']);
 assert.deepEqual(db.sql.prepare('SELECT listing_id FROM translation_batch_queue ORDER BY listing_id').all().map(r=>r.listing_id),['late','w'],'newer listings wait for the next nightly attempt');
 // A cap or a provider error stops the run and keeps the listing queued.
 const stopped=database();await B.queueBatchTranslation(stopped,'a',new Date('2026-11-12T20:00:00Z'));await B.submitTranslationBatch(stopped,settings,source({a:d}),refused,night);
 assert.deepEqual(await B.translateQueueDirectly(stopped,settings,source({a:d}),async()=>'stop',hour),{status:'stopped',listings:0});
 assert.equal(stopped.sql.prepare('SELECT COUNT(*) AS n FROM translation_batch_queue').get().n,1);
 // Billing enabled: the next night's job is accepted and the hourly direct translation stops.
 assert.equal((await B.submitTranslationBatch(db,settings,source({late:doc('late','Villa C'),w:'waiting'}),async()=>Response.json({name:'batches/ok'}),new Date('2026-11-14T06:00:00Z'))).status,'submitted');
 assert.equal((await B.batchMode(db)).mode,'batch');
});
