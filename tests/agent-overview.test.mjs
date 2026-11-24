// Hesabım › Genel Bakış for estate agents (lib/agent-overview.ts, components/AgentOverview.tsx, 2026-11-23).
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {DatabaseSync} from 'node:sqlite';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url);
const compile=file=>ts.transpileModule(readFileSync(path.join(root,file),'utf8'),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const crm={exports:{}};new Function('require','module','exports',compile('lib/crm-stats.ts'))(native,crm,crm.exports);
const m={exports:{}};new Function('require','module','exports',compile('lib/agent-overview.ts'))(name=>name==='./crm-stats'?crm.exports:native(name),m,m.exports);const O=m.exports;
const read=file=>readFileSync(path.join(root,file),'utf8');

const at=new Date('2026-11-23T12:00:00Z'),ago=d=>new Date(at.getTime()-d*86400000).toISOString(),ahead=d=>new Date(at.getTime()+d*86400000).toISOString();
const AGENT='a',OTHER='o';
function database(){const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE users(id TEXT,name TEXT);
CREATE TABLE listings(id TEXT,owner_id TEXT,title TEXT,city TEXT,district TEXT,property_type TEXT,purpose TEXT,price INTEGER,currency TEXT,status TEXT,images TEXT,description TEXT,published_at TEXT,created_at TEXT,updated_at TEXT,expires_at TEXT);
CREATE TABLE listing_view_daily(listing_id TEXT,day TEXT,visitor_hash TEXT,created_at TEXT,PRIMARY KEY(listing_id,day,visitor_hash));CREATE TABLE favorites(user_id TEXT,listing_id TEXT,created_at TEXT);
CREATE TABLE messages(id TEXT,listing_id TEXT,sender_id TEXT,recipient_id TEXT,body TEXT,created_at TEXT);
CREATE TABLE appointments(id TEXT,listing_id TEXT,buyer_id TEXT,seller_id TEXT,slot_at TEXT,status TEXT,created_at TEXT);`);
 return {sql,prepare(query){return {values:[],bind(...values){this.values=values;return this;},async first(){return sql.prepare(query).get(...this.values)||null;},async all(){return {results:sql.prepare(query).all(...this.values)};},async run(){return sql.prepare(query).run(...this.values);}};}};}
function seed(db){
 const users=[[AGENT,'Selin Arslan'],[OTHER,'Başka Emlakçı'],['b1','Ayşe Demir'],['b2','Markus Weber']];for(const u of users)db.sql.prepare('INSERT INTO users VALUES(?,?)').run(...u);
 const L=(id,owner,status,price,expires,images='["/p1.jpg","/p2.jpg"]')=>db.sql.prepare('INSERT INTO listings VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,owner,'İlan '+id,'İzmir','Karşıyaka','daire','satilik',price,'TRY',status,images,'Açıklama '.repeat(40),ago(30),ago(40),ago(1),expires);
 L('top',AGENT,'published',8450000,ahead(40));L('soon',AGENT,'published',5000000,ahead(3));L('wait',AGENT,'pending',1,null);L('old',AGENT,'expired',1,ago(2));L('draft',AGENT,'draft',1,null);L('theirs',OTHER,'published',1,ahead(40));
 for(let i=0;i<12;i++)db.sql.prepare('INSERT INTO listing_view_daily VALUES(?,?,?,?)').run('top',ago(i%5).slice(0,10),'v'+i,ago(i%5));
 for(let i=0;i<3;i++)db.sql.prepare('INSERT INTO listing_view_daily VALUES(?,?,?,?)').run('soon',ago(1).slice(0,10),'w'+i,ago(1));
 for(let i=0;i<50;i++)db.sql.prepare('INSERT INTO listing_view_daily VALUES(?,?,?,?)').run('theirs',ago(1).slice(0,10),'x'+i,ago(1));
 const msg=(listing,from,to,ageDays)=>db.sql.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?)').run(Math.random().toString(36),listing,from,to,'merhaba',ago(ageDays));
 msg('top','b1',AGENT,2);msg('soon','b2',AGENT,3);msg('soon',AGENT,'b2',2.5);msg('theirs','b1',OTHER,1);
 const appt=(id,listing,buyer,slot,status)=>db.sql.prepare('INSERT INTO appointments VALUES(?,?,?,?,?,?,?)').run(id,listing,buyer,AGENT,slot,status,ago(1));
 appt('ap1','top','b1',ahead(1),'confirmed');appt('ap2','soon','b2',ahead(2),'requested');appt('ap3','top','b2',ago(1),'confirmed');appt('ap4','top','b1',ahead(30),'confirmed');appt('ap5','top','b2',ahead(3),'cancelled');
 return db;
}

test('overview: only the agent\'s own data; counts, top listing, days left, reminders and customers',async()=>{
 const db=seed(database());
 const o=await O.agentOverview(db,AGENT,30,at,{newRequests:async()=>4});
 assert.deepEqual(o.counts,{published:2,pending:1,expired:1,drafts:1});
 assert.equal(o.totals.views,15,'views of the agent\'s listings only');
 assert.equal(o.top.id,'top');assert.equal(o.top.photo,'/p1.jpg');assert.equal(o.top.daysLeft,40);
 assert.deepEqual(o.listings.map(l=>l.id).sort(),['old','soon','top','wait'],'drafts and other agents\' listings stay out of the table');
 assert.equal(o.listings.find(l=>l.id==='soon').daysLeft,3);assert.equal(o.listings.find(l=>l.id==='wait').daysLeft,null);
 assert.deepEqual(o.appointments.map(a=>[a.id,a.buyerName,a.status]),[['ap1','Ayşe Demir','confirmed'],['ap2','Markus Weber','requested']],'next 14 days, open ones only, soonest first');
 assert.deepEqual(o.reminders,{unanswered:1,pendingAppointments:1,expiringSoon:1,drafts:1,newRequests:4});
 assert.deepEqual(o.customers.map(c=>[c.name,c.listingId,c.waiting]),[['Ayşe Demir','top',true],['Markus Weber','soon',false]],'latest first; answered conversations are not waiting');
});

test('overview: an agent without listings gets zeros, no top listing and no failure',async()=>{
 const db=database();
 const o=await O.agentOverview(db,'nobody',30,at);
 assert.equal(o.top,null);assert.deepEqual(o.counts,{published:0,pending:0,expired:0,drafts:0});assert.equal(o.totals.views,0);
 assert.deepEqual(o.listings,[]);assert.deepEqual(o.customers,[]);assert.equal(o.reminders.newRequests,0);
});

test('overview: missing optional tables do not break the panel',async()=>{
 const db=seed(database());db.sql.exec('DROP TABLE appointments');
 const o=await O.agentOverview(db,AGENT,30,at);assert.deepEqual(o.appointments,[]);assert.equal(o.reminders.pendingAppointments,0);assert.equal(o.counts.published,2);
});

test('wiring: agents and the admin account get the dashboard; the route serves only the signed-in account',()=>{
 const dashboard=read('components/Dashboard.tsx');assert.match(dashboard,/const proOverview=kind==="agent"\|\|Boolean\(user\.isAdmin\)/);assert.match(dashboard,/<AgentOverview name=\{user\.name\} open=\{openOverview\}\/>/);
 const route=read('app/api/crm/overview/route.ts');assert.match(route,/agentOverview\(database as unknown as CrmDatabase, String\(user\.id\)/);assert.match(route,/if \(!user\?\.email_verified\) return error/);
 assert.match(read('app/hesabim/page.tsx'),/import "\.\.\/overview\.css"/);
 // Nothing invented: no income, expenses or closed-deal figures.
 assert.doesNotMatch(read('components/AgentOverview.tsx'),/Gelir|Gider|income|expenses|Total Closed/);
});

test('bell: a notification list (each unread conversation, appointments, buyer requests, saved-search and price alerts) plus standing to-dos without a badge',()=>{
 const bell=read('components/NotificationBell.tsx');
 for(const source of ['/api/messages','/api/appointments','/api/lead-board?count=1','/api/discovery','/api/crm/overview'])assert.ok(bell.includes(source),source);
 assert.match(bell,/role="dialog"/);assert.match(bell,/event\.key === "Escape"/);assert.match(bell,/useLiveEvents\(true/);
 assert.match(bell,/searchParams\.get\("bildirim"\) !== "1"/,'the site header bell opens the list');
 assert.match(bell,/const total = unreadMessages \+ data\.appointments\.length \+ data\.requests \+ data\.alerts\.length;/,'to-dos do not light the badge');
 const dashboard=read('components/Dashboard.tsx');assert.match(dashboard,/<NotificationBell userId=\{user\.id\}/);
 assert.match(dashboard,/id==="aramalar"\?"profil":id==="randevular"&&items\.some\(i=>i\.id==="crm"\)\?"crm"/);
});
