import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import ts from 'typescript';
const compile=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64');
const insights=await import(compile(readFileSync(new URL('../lib/admin-insights.ts',import.meta.url),'utf8')));
const {adminInsights,insightWindow,percentChange,parseInsightPeriod}=insights;
const NOW=new Date('2026-11-05T12:00:00.000Z');

const CORE=`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,email_verified INTEGER,name TEXT,role TEXT,agent_status TEXT,company TEXT,created_at TEXT);
CREATE TABLE agencies(id TEXT,owner_id TEXT,category TEXT);
CREATE TABLE listings(id TEXT PRIMARY KEY,owner_id TEXT,title TEXT,city TEXT,district TEXT,status TEXT,expires_at TEXT,created_at TEXT);
CREATE TABLE messages(id TEXT PRIMARY KEY,listing_id TEXT,sender_id TEXT,recipient_id TEXT,body TEXT,created_at TEXT);`;
const OPTIONAL=`CREATE TABLE listing_view_daily(listing_id TEXT,day TEXT,visitor_hash TEXT,created_at TEXT,PRIMARY KEY(listing_id,day,visitor_hash));
CREATE TABLE projects(id TEXT PRIMARY KEY,moderation TEXT);CREATE TABLE service_firms(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE project_reservations(id TEXT PRIMARY KEY,project_id TEXT,created_at TEXT);
CREATE TABLE orders(id TEXT PRIMARY KEY,user_id TEXT,amount INTEGER,currency TEXT,status TEXT,created_at TEXT,fulfilled_at TEXT);
CREATE TABLE office_verifications(user_id TEXT,state TEXT);CREATE TABLE listing_reports(id TEXT,listing_id TEXT,state TEXT);CREATE TABLE contact_messages(id TEXT,status TEXT);CREATE TABLE site_feedback(id TEXT,status TEXT);`;
// Current 7-day window: 2026-10-30T00:00Z … 2026-11-05T12:00Z. Previous: 2026-10-23T00:00Z … 2026-10-29T12:00Z.
const DATA=`INSERT INTO users VALUES
 ('admin','a@x.test',1,'Admin','admin','none',NULL,'2026-11-01T09:00:00.000Z'),
 ('ind1','i1@x.test',1,'Ilk Birey','individual','none',NULL,'2026-11-01T09:00:00.000Z'),
 ('ind2','i2@x.test',1,'Iki Birey','individual','none',NULL,'2026-10-24T09:00:00.000Z'),
 ('agt','g@x.test',1,'Emlak Ofisi','agent','pending','Ofis','2026-11-02T09:00:00.000Z'),
 ('dev','d@x.test',1,'Insaat','agent','approved','Yapi','2026-11-05T08:00:00.000Z'),
 ('buy','b@x.test',1,'Alici','buyer','none',NULL,'2026-10-29T13:00:00.000Z'),
 ('old','o@x.test',1,'Eski','buyer','none',NULL,'2026-01-01T09:00:00.000Z');
INSERT INTO agencies VALUES('ag1','agt','agency'),('ag2','dev','developer');
INSERT INTO listings VALUES
 ('l1','dev','Deniz manzarali','Antalya','Muratpasa','published',NULL,'2026-11-02T10:00:00.000Z'),
 ('l2','dev','Bahceli villa','Antalya','Kas','published','2026-12-01T00:00:00.000Z','2026-11-03T10:00:00.000Z'),
 ('l3','agt','Ofis kati','Izmir','Konak','pending',NULL,'2026-11-04T10:00:00.000Z'),
 ('l4','ind1','Eski ilan','Izmir','Urla','published','2026-11-01T00:00:00.000Z','2026-10-12T10:00:00.000Z'),
 ('l5','ind2','Gecen hafta','Ankara','Cankaya','published',NULL,'2026-10-25T10:00:00.000Z'),
 ('l6','ind2','Reddedilen','Ankara','Cankaya','rejected',NULL,'2026-10-31T10:00:00.000Z'),
 ('ex-1001','admin','Demo','Istanbul','Besiktas','published',NULL,'2026-11-02T10:00:00.000Z'),
 ('sample-konut-01','admin','Ornek','Istanbul','Kadikoy','pending',NULL,'2026-11-02T10:00:00.000Z');
INSERT INTO messages VALUES
 ('m1','l1','buy','dev','Merhaba','2026-11-02T11:00:00.000Z'),
 ('m2','l1','dev','buy','Buyrun','2026-11-02T12:00:00.000Z'),
 ('m3','l1','buy','dev','Tekrar','2026-11-03T12:00:00.000Z'),
 ('m4','l2','ind1','dev','Soru','2026-11-04T09:00:00.000Z'),
 ('m5','l5','buy','ind2','Eski talep','2026-10-25T11:00:00.000Z'),
 ('m6','l5','buy','ind2','Devam','2026-10-31T11:00:00.000Z'),
 ('m7','ex-1001','buy','admin','Demo mesaj','2026-11-02T11:00:00.000Z');
INSERT INTO listing_view_daily VALUES('l1','2026-11-02','a','x'),('l1','2026-11-02','b','x'),('l1','2026-11-03','a','x'),('l2','2026-11-05','a','x'),('l5','2026-10-25','a','x'),('l4','2026-10-30','c','x'),('ex-1001','2026-11-02','a','x'),('ex-1001','2026-11-03','a','x'),('ex-1001','2026-11-04','a','x'),('ex-1001','2026-11-05','a','x');
INSERT INTO projects VALUES('p1','published'),('p2','pending');
INSERT INTO service_firms VALUES('s1','pending'),('s2','pending'),('s3','approved'),('s4','suspended');
INSERT INTO project_reservations VALUES('r1','p1','2026-11-01T10:00:00.000Z'),('r2','p1','2026-10-24T10:00:00.000Z'),('r3','p1','2026-10-26T10:00:00.000Z'),('r4','sample-p','2026-11-01T10:00:00.000Z');
INSERT INTO orders VALUES('o1','agt',790,'TRY','fulfilled','2026-11-01T10:00:00.000Z','2026-11-02T10:00:00.000Z'),('o2','agt',250,'TRY','awaiting_payment','2026-11-03T10:00:00.000Z',NULL),('o3','dev',1490,'TRY','fulfilled','2026-10-24T10:00:00.000Z','2026-10-24T11:00:00.000Z');
INSERT INTO office_verifications VALUES('agt','pending'),('dev','approved');
INSERT INTO listing_reports VALUES('rep1','l1','open'),('rep2','l2','reviewing'),('rep3','l5','resolved'),('rep4','ex-1001','open');
INSERT INTO contact_messages VALUES('c1','new'),('c2','handled');
INSERT INTO site_feedback VALUES('f1','new'),('f2','new'),('f3','planned');`;

function fixture({optional=true}={}){const sql=new DatabaseSync(':memory:');sql.exec(CORE+(optional?OPTIONAL:'')+(optional?DATA:DATA.split('INSERT INTO listing_view_daily')[0]));
 // Fraud/duplicate flags live in presentation (lib/listing-risk.ts): one live flag counts; rejected and sample listings do not.
 sql.exec("ALTER TABLE listings ADD COLUMN presentation TEXT NOT NULL DEFAULT '{}';UPDATE listings SET presentation='{\"riskFlag\":\"high\"}' WHERE id IN ('l1','l6','sample-konut-01');UPDATE listings SET presentation='{\"risk\":{}}' WHERE id='l2'");
 const db={prepare(query){let values=[];return {bind(...v){values=v;return this;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){return sql.prepare(query).run(...values);}};}};return {sql,db};}

test('periods: UTC day windows, equal-length previous period, invalid values rejected',()=>{
 assert.equal(parseInsightPeriod(null),'7d');assert.equal(parseInsightPeriod('90d'),'90d');assert.equal(parseInsightPeriod('365d'),null);assert.equal(parseInsightPeriod('toString'),null);
 const today=insightWindow('today',NOW);assert.equal(today.start,'2026-11-05T00:00:00.000Z');assert.equal(today.previousStart,'2026-11-04T00:00:00.000Z');assert.equal(today.previousEnd,'2026-11-04T12:00:00.000Z');assert.deepEqual(today.buckets,['2026-11-05']);assert.equal(today.previousStartDay,'2026-11-04');assert.equal(today.previousEndDay,'2026-11-04');
 const week=insightWindow('7d',NOW);assert.equal(week.start,'2026-10-30T00:00:00.000Z');assert.equal(week.end,NOW.toISOString());assert.equal(week.previousStart,'2026-10-23T00:00:00.000Z');assert.equal(week.previousEnd,'2026-10-29T12:00:00.000Z');assert.equal(week.buckets.length,7);assert.equal(week.buckets[0],'2026-10-30');assert.equal(week.buckets[6],'2026-11-05');
 assert.equal(insightWindow('90d',NOW).buckets.length,90);
});

test('comparison math: percent change, zero baseline and decreases',()=>{
 assert.equal(percentChange(10,5),100);assert.equal(percentChange(5,10),-50);assert.equal(percentChange(0,0),0);assert.equal(percentChange(3,0),null);assert.equal(percentChange(1,3),-66.7);assert.equal(percentChange(0,4),-100);
});

test('aggregates each metric per period and excludes demo and sample listings',async()=>{
 const {sql,db}=fixture();try{
  const r=await adminInsights(db,'7d',NOW);const k=r.kpis;
  assert.deepEqual(r.unavailable,[]);
  // Users: admin is not counted; developer = agent with a developer company; buyer at 13:00 on 10-29 is after previousEnd.
  assert.deepEqual([k.users.current,k.users.previous,k.users.change],[3,1,200]);
  assert.deepEqual(k.users.byRole.individual,{current:1,previous:1,change:0});assert.equal(k.users.byRole.agent.current,1);assert.equal(k.users.byRole.developer.current,1);assert.deepEqual(k.users.byRole.buyer,{current:0,previous:0,change:0});
  // Listings: l1,l2,l3,l6 now (demo rows ignored); l5 before.
  assert.deepEqual([k.listings.current,k.listings.previous],[4,1]);assert.deepEqual(k.listings.published,{current:2,previous:1,change:100});assert.deepEqual(k.listings.pending,{current:1,previous:0,change:null});
  assert.equal(k.activeListings,3);// l1,l2,l5 (l4 expired, demo excluded)
  assert.deepEqual(k.expiredListings,{current:1,previous:0,change:null});
  assert.deepEqual(k.messages,{current:5,previous:1,change:400});// m1-m4,m6 ; m5 ; demo m7 excluded
  assert.deepEqual([k.conversations.current,k.conversations.previous],[2,1]);// l1 buy<->dev, l2 ; l5 started before
  assert.deepEqual([k.leads.current,k.leads.previous],[2,1]);
  assert.deepEqual(k.views,{current:5,previous:1,change:400});// day buckets 10-30..11-05 vs 10-23..10-29
  assert.deepEqual(k.reservations,{current:1,previous:2,change:-50});// r4 belongs to no stored project
  assert.deepEqual(k.orders.created,{current:2,previous:1,change:100});assert.deepEqual(k.orders.fulfilled,{current:1,previous:1,change:0});assert.deepEqual(k.orders.revenue,{current:790,previous:1490,change:-47});
  assert.deepEqual(Object.fromEntries(r.pending.map(p=>[p.kind,p.count])),{listings:1,suspicious:1,officeDocuments:1,companyApplications:1,projects:1,services:2,reports:2,contact:1,feedback:2,orders:1});
  assert.equal(r.pending.find(p=>p.kind==='reports').href,'/yonetim?view=reports');
  assert.equal(r.series.length,7);assert.deepEqual(r.series.find(d=>d.day==='2026-11-02'),{day:'2026-11-02',listings:1,users:1,messages:2});assert.equal(r.series.reduce((n,d)=>n+d.users,0),3);
  assert.deepEqual(r.top.viewed.map(v=>[v.id,v.views,v.live]),[['l1',3,true],['l2',1,true],['l4',1,false]]);
  assert.deepEqual(r.top.advertisers.map(a=>[a.id,a.kind,a.listings,a.active]),[['dev','developer',2,2],['agt','agent',1,0],['ind2','individual',1,0]]);
  assert.deepEqual(r.top.cities,[{city:'Antalya',listings:2},{city:'Ankara',listings:1}]);
  assert.ok(!JSON.stringify(r).includes('ex-1001')&&!JSON.stringify(r).includes('sample-'));
 }finally{sql.close();}
});

test('shorter and longer periods bound the same data differently',async()=>{
 const {sql,db}=fixture();try{
  const today=await adminInsights(db,'today',NOW);assert.equal(today.kpis.users.current,1);assert.equal(today.kpis.listings.current,0);assert.equal(today.kpis.views.current,1);assert.equal(today.series.length,1);
  const quarter=await adminInsights(db,'90d',NOW);assert.equal(quarter.kpis.users.current,5);assert.equal(quarter.kpis.listings.current,6);assert.equal(quarter.kpis.messages.current,6);assert.equal(quarter.series.length,90);
 }finally{sql.close();}
});

test('lazily created tables that do not exist yet are reported as unavailable, not as errors',async()=>{
 const {sql,db}=fixture({optional:false});try{
  const r=await adminInsights(db,'30d',NOW);
  assert.equal(r.kpis.views,null);assert.equal(r.kpis.orders,null);assert.equal(r.kpis.reservations,null);assert.equal(r.top.viewed,null);
  assert.ok(r.unavailable.includes('views')&&r.unavailable.includes('orders')&&r.unavailable.includes('pending.reports'));
  assert.equal(r.pending.find(p=>p.kind==='listings').count,1);assert.equal(r.pending.find(p=>p.kind==='orders').count,null);assert.equal(r.pending.find(p=>p.kind==='services').count,null);assert.equal(r.pending.find(p=>p.kind==='feedback').count,null);assert.equal(r.pending.find(p=>p.kind==='feedback').href,'/yonetim?view=feedback');
  assert.equal(r.kpis.listings.current,6);
 }finally{sql.close();}
});

test('the endpoint is admin-only, rejects pending 2FA and invalid periods, and is never cached',async()=>{
 const {sql,db}=fixture();globalThis.__insights={db,actor:null,insights};
 const prefix=`const ctx=globalThis.__insights,{adminInsights,parseInsightPeriod}=ctx.insights,db=()=>ctx.db,currentUser=async()=>ctx.actor,isAdmin=u=>Boolean(u&&!u.admin_2fa_pending&&u.role==='admin'),error=(message,status=400)=>Response.json({error:message},{status}),ok=(v,init)=>Response.json(v,init);\n`;
 const source=readFileSync(new URL('../app/api/admin/insights/route.ts',import.meta.url),'utf8').replace(/^import [\s\S]*?;\r?\n/gm,'');
 const {GET}=await import(compile(prefix+source));const get=q=>GET(new Request('https://site.test/api/admin/insights'+q));
 try{
  assert.equal((await get('')).status,403);
  globalThis.__insights.actor={id:'agt',role:'agent',email_verified:1};assert.equal((await get('?period=7d')).status,403);
  globalThis.__insights.actor={id:'admin',role:'admin',email_verified:0};assert.equal((await get('?period=7d')).status,403);
  globalThis.__insights.actor={id:'admin',role:'admin',email_verified:1,admin_2fa_pending:true};assert.equal((await get('?period=7d')).status,403);
  globalThis.__insights.actor={id:'admin',role:'admin',email_verified:1};
  assert.equal((await get('?period=1y')).status,400);
  const response=await get('?period=30d');assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  const data=await response.json();assert.equal(data.period,'30d');assert.equal(data.series.length,30);
 }finally{sql.close();delete globalThis.__insights;}
});
