import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {DatabaseSync} from 'node:sqlite';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync(path.join(root,'lib/crm-stats.ts'),'utf8'),{fileName:'crm-stats.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const m={exports:{}};new Function('require','module','exports',code)(native,m,m.exports);const S=m.exports;

// CRM › İstatistikler (lib/crm-stats.ts): counting, funnel, trends, benchmarks and advice.
function database(){const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE listings(id TEXT,owner_id TEXT,title TEXT,city TEXT,property_type TEXT,status TEXT,images TEXT,description TEXT,published_at TEXT,created_at TEXT,updated_at TEXT);
CREATE TABLE listing_view_daily(listing_id TEXT,day TEXT,visitor_hash TEXT,created_at TEXT,PRIMARY KEY(listing_id,day,visitor_hash));CREATE TABLE favorites(user_id TEXT,listing_id TEXT,created_at TEXT);
CREATE TABLE messages(id TEXT,listing_id TEXT,sender_id TEXT,recipient_id TEXT,body TEXT,created_at TEXT);CREATE TABLE appointments(id TEXT,listing_id TEXT,created_at TEXT);`);
 return {sql,prepare(query){return {values:[],bind(...values){this.values=values;return this;},async first(){return sql.prepare(query).get(...this.values)||null;},async all(){return {results:sql.prepare(query).all(...this.values)};},async run(){return sql.prepare(query).run(...this.values);}};}};}
const at=new Date('2026-11-13T12:00:00Z'),day=n=>new Date(at.getTime()-n*86400000).toISOString();
const listing=(id,owner,extra={})=>({id,owner,title:'İlan '+id,city:'Antalya',type:'daire',status:'published',images:JSON.stringify(['a','b','c']),description:'kısa',published:day(90),...extra});
function seed(db,rows){for(const r of rows)db.sql.prepare('INSERT INTO listings VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(r.id,r.owner,r.title,r.city,r.type,r.status,r.images,r.description,r.published,r.published,r.published);}

test('events are counted once per visitor and day, never for the owner or unpublished listings',async()=>{
 const db=database();seed(db,[listing('a','owner'),listing('p','owner',{status:'pending'})]);
 assert.equal(await S.recordListingEvent(db,'a','phone','h1',null,'de',at),true);
 assert.equal(await S.recordListingEvent(db,'a','phone','h1',null,'de',at),false,'same visitor, same day');
 assert.equal(await S.recordListingEvent(db,'a','whatsapp','h1',null,'',at),true,'another kind counts');
 assert.equal(await S.recordListingEvent(db,'a','phone','h2','owner','',at),false,'the owner');
 assert.equal(await S.recordListingEvent(db,'p','phone','h3',null,'',at),false,'not published');
 assert.equal(await S.recordListingEvent(db,'a','share','h4',null,'',at),false,'unknown kind');
});

test('statistics: funnel, trend, languages, benchmark and advice, weakest listing first',async()=>{
 const db=database();
 seed(db,[listing('a','owner',{description:'x'.repeat(400),images:JSON.stringify(['1','2','3','4','5','6','7'])}),listing('b','owner'),listing('o1','other'),listing('o2','other'),listing('o3','other')]);
 const view=(id,n,daysAgo=1)=>{for(let i=0;i<n;i++)db.sql.prepare('INSERT INTO listing_view_daily VALUES(?,?,?,?)').run(id,day(daysAgo).slice(0,10),id+':'+daysAgo+':'+i,day(daysAgo));};
 view('a',60);view('b',2);view('o1',30);view('o2',30);view('o3',30);view('a',10,40);
 for(let i=0;i<24;i++)await S.recordListingEvent(db,'a','view','v'+i,null,i<12?'de':'tr',new Date(day(1)));
 for(let i=0;i<4;i++)await S.recordListingEvent(db,'a','phone','p'+i,null,'',new Date(day(1)));
 db.sql.prepare('INSERT INTO favorites VALUES(?,?,?)').run('u1','b',day(2));
 for(const [sender,when] of [['c1',day(3)],['c1',day(2)],['c2',day(2)]])db.sql.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),'a',sender,'owner','merhaba',when);
 db.sql.prepare('INSERT INTO appointments VALUES(?,?,?)').run('ap','a',day(1));
 const s=await S.crmStats(db,'owner',30,at);
 assert.equal(s.days,30);assert.equal(s.series.length,30);
 assert.deepEqual([s.totals.views,s.totals.phone,s.totals.messages,s.totals.favorites,s.totals.appointments,s.totals.contacts],[62,4,2,1,1,6],'two people wrote; repeated messages count once');
 assert.equal(s.previous.views,10,'the 30 days before');
 assert.deepEqual(s.languages,{de:12,tr:12});
 assert.equal(s.unanswered,2,'both writers wait for an answer');
 assert.deepEqual(s.listings.map(l=>l.id),['b','a'],'weakest first');
 const [b,a]=s.listings;
 assert.equal(a.benchmark,Math.round((62+90)/5*10)/10,'average of the five Antalya flats');
 assert.ok(b.insights.some(i=>i.code==='low_views'));assert.ok(b.insights.some(i=>i.code==='few_photos'&&i.value===3));assert.ok(b.insights.some(i=>i.code==='short_description'));
 assert.ok(a.insights.some(i=>i.code==='foreign_interest'&&i.value===50));assert.ok(a.insights.some(i=>i.code==='strong_conversion'));
 assert.ok(a.score>b.score);
 assert.deepEqual(await S.crmStats(database(),'nobody',7,at).then(r=>r.listings),[]);
});

test('advice rules and score',()=>{
 const base={id:'x',title:'t',city:'c',property_type:'d',status:'published',images:JSON.stringify(['1','2','3','4','5','6']),description:'x'.repeat(400),published_at:day(10),created_at:day(10)};
 const metrics={views:50,favorites:4,phone:0,whatsapp:0,messages:0,appointments:0,recentViews:5,languages:{}};
 assert.deepEqual(S.listingInsights(base,metrics,20,30,at).map(i=>i.code),['views_no_contact','favorites_no_contact','top_views'],'50 views against 20 for similar listings');
 assert.deepEqual(S.listingInsights({...base,status:'pending'},metrics,20,30,at).map(i=>i.code),['not_published']);
 assert.ok(S.listingInsights({...base,published_at:day(80)},{...metrics,views:0,favorites:0,recentViews:0},0,30,at).some(i=>i.code==='stale'));
 assert.equal(S.listingScore([{tone:'warn'},{tone:'tip'}]),72);assert.equal(S.listingScore([{tone:'good'}]),100);
});
