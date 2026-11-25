import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),nativeRequire=createRequire(import.meta.url);
function load(file){const full=path.resolve(root,file),module={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>name.startsWith('.')?load(path.resolve(path.dirname(full),name)+'.ts'):nativeRequire(name),module,module.exports);return module.exports;}
const {translateMessages,alreadyInLocale,MessageTranslationError}=load('lib/message-translations.ts');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const buyer=id(1),owner=id(2),stranger=id(3),settings={GEMINI_API_KEY:'fixture-key'};
function adapter(sql){return {sql,prepare(query){return {values:[],bind(...values){this.values=values;return this;},async first(){return sql.prepare(query).get(...this.values)||null;},async all(){return {results:sql.prepare(query).all(...this.values)};},async run(){return sql.prepare(query).run(...this.values);}};},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};}
function setup(){
 const main=new DatabaseSync(':memory:');main.exec(`PRAGMA foreign_keys=ON;CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE messages(id uuid PRIMARY KEY,listing_id text NOT NULL,sender_id uuid NOT NULL REFERENCES users(id),recipient_id uuid REFERENCES users(id),body text,created_at text);`);
 for(const user of [buyer,owner,stranger])main.prepare('INSERT INTO users VALUES(?)').run(user);
 const add=(n,from,to,body)=>main.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?)').run(id(n),'listing',from,to,body,new Date(Date.UTC(2026,9,29,10,n)).toISOString());
 add(10,buyer,owner,'Guten Tag, ist die Wohnung noch verfügbar?');add(11,owner,buyer,'Evet, daire hâlâ satılık. Ne zaman görüşmek istersiniz?');add(12,buyer,owner,'Hello, can I visit on Saturday?');
 const usage=new DatabaseSync(':memory:');usage.exec(readFileSync(path.join(root,'drizzle/0020_glorious_mariko_yashida.sql'),'utf8'));
 return {main,db:adapter(main),usage:adapter(usage)};
}
// Gemini mock: records {target,texts,context}; a text starting with Hello is English and comes back unchanged.
function provider(calls,language='de'){return async(url,options)=>{const request=JSON.parse(options.body),input=JSON.parse(request.contents[0].parts[0].text);calls.push({target:input.target,texts:input.texts,context:request.systemInstruction.parts[0].text});return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({items:input.texts.map(text=>({text:text.startsWith('Hello')?text:'['+input.target.toUpperCase()+'] '+text,source:text.startsWith('Hello')?'en':language}))})}]}}],usageMetadata:{promptTokenCount:5,candidatesTokenCount:7}});};}
async function withFetch(fetcher,run){const original=globalThis.fetch;globalThis.fetch=fetcher;try{return await run();}finally{globalThis.fetch=original;}}

test('recipient reads incoming messages in their language and the result is stored once',async()=>{const {db,usage,main}=setup(),calls=[];await withFetch(provider(calls),async()=>{
 const first=await translateMessages(db,usage,settings,owner,[id(10)],'tr');assert.equal(first.status,'ready');assert.equal(first.translations[id(10)].text,'[TR] Guten Tag, ist die Wohnung noch verfügbar?');assert.equal(first.translations[id(10)].source,'de');assert.equal(calls.length,1);assert.equal(calls[0].target,'tr');assert.match(calls[0].context,/Private chat/);
 const again=await translateMessages(db,usage,settings,owner,[id(10)],'tr');assert.deepEqual(again.translations,first.translations);assert.equal(calls.length,1);
 await translateMessages(db,usage,settings,owner,[id(10)],'en');assert.equal(calls.length,2);assert.equal(calls[1].target,'en');
 assert.ok(usage.sql.prepare("SELECT characters FROM translation_usage WHERE key LIKE 'day:%'").get().characters>0);
 main.prepare('DELETE FROM messages WHERE id=?').run(id(10));assert.equal(main.prepare('SELECT COUNT(*) n FROM message_translations').get().n,0);
});});
test('only messages the actor received are translated',async()=>{const {db,usage}=setup(),calls=[];await withFetch(provider(calls,'TR'),async()=>{
 assert.deepEqual((await translateMessages(db,usage,settings,stranger,[id(10),id(11)],'en')).translations,{});
 assert.deepEqual((await translateMessages(db,usage,settings,buyer,[id(10)],'en')).translations,{});assert.equal(calls.length,0);
 const r=await translateMessages(db,usage,settings,buyer,[id(10),id(11)],'de');assert.deepEqual(Object.keys(r.translations),[id(11)]);assert.equal(calls.length,1);assert.equal(calls[0].texts.length,1);
});});
test('messages already in the reader language are not shown as translations or sent again',async()=>{const {db,usage}=setup(),calls=[];await withFetch(provider(calls),async()=>{
 assert.deepEqual((await translateMessages(db,usage,settings,buyer,[id(11)],'tr')).translations,{});assert.equal(calls.length,0);
 assert.deepEqual((await translateMessages(db,usage,settings,owner,[id(12)],'en')).translations,{});assert.equal(calls.length,1);
 await translateMessages(db,usage,settings,owner,[id(12)],'en');assert.equal(calls.length,1);
 assert.equal(alreadyInLocale('Привет, квартира свободна?','ru'),true);assert.equal(alreadyInLocale('Hallo, ist sie frei?','tr'),false);
});});
test('provider failures fall back to the original text and pause further calls',async()=>{const {db,usage}=setup();let calls=0;await withFetch(async()=>{calls++;return new Response('',{status:456});},async()=>{
 assert.deepEqual(await translateMessages(db,usage,settings,owner,[id(10)],'tr'),{status:'unavailable',translations:{}});
 assert.equal((await translateMessages(db,usage,settings,owner,[id(10)],'tr')).status,'pending');assert.equal(calls,1);
});});
test('missing configuration does no work and invalid input is rejected',async()=>{const {db,usage}=setup();await withFetch(async()=>{throw Error('must not call');},async()=>{
 assert.equal((await translateMessages(db,usage,{},owner,[id(10)],'tr')).status,'unavailable');assert.equal((await translateMessages(db,undefined,settings,owner,[id(10)],'tr')).status,'unavailable');
 for(const [ids,locale] of [[[id(10)],'xx'],[['not-an-id'],'tr'],[[],'tr'],[Array.from({length:21},(_,n)=>id(100+n)),'tr'],['x','tr']])await assert.rejects(()=>translateMessages(db,usage,settings,owner,ids,locale),e=>e instanceof MessageTranslationError&&e.status===400);
});});
test('monthly allowance: 150 messages of 5 words each, only real translations count, then originals until next month',async()=>{const {db,usage}=setup(),calls=[];await withFetch(provider(calls),async()=>{
 const {messageQuota,messageWords,quotaResetsAt,quotaMonth}=load('lib/message-translations.ts');
 assert.equal(messageWords('Guten Tag, ist die Wohnung noch verfügbar?'),7);assert.equal(messageWords('👍 123'),1);
 // Istanbul month: 23:30 UTC on 30 November is already December in Türkiye.
 assert.equal(quotaMonth(new Date('2026-11-30T21:30:00Z')),'2026-12');assert.equal(quotaResetsAt(new Date('2026-11-25T10:00:00Z')),'2026-11-30T21:00:00.000Z');
 const at=new Date('2026-11-25T10:00:00Z');
 // A 1-message allowance (5 words): the 7-word German message is translated and uses it up.
 const first=await translateMessages(db,usage,settings,owner,[id(10)],'tr',{messages:1,at});assert.equal(first.status,'ready');assert.ok(first.translations[id(10)]);
 let q=await messageQuota(db,owner,1,at);assert.equal(q.used,1);assert.equal(q.remaining,0);
 // Stored translations stay free; a new message is refused while the allowance is used.
 assert.equal((await translateMessages(db,usage,settings,owner,[id(10)],'tr',{messages:1,at})).status,'ready');
 assert.equal((await translateMessages(db,usage,settings,owner,[id(10)],'en',{messages:1,at})).status,'quota');assert.equal(calls.length,1);
 // Next month the allowance is back.
 const next=new Date('2026-12-02T10:00:00Z');q=await messageQuota(db,owner,1,next);assert.equal(q.remaining,1);
 assert.equal((await translateMessages(db,usage,settings,owner,[id(10)],'en',{messages:1,at:next})).status,'ready');
});});
