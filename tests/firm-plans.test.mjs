// Monthly packages for service firms and contractors (lib/firm-plans.ts, docs/firm-plans.md).
import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import ts from 'typescript';
const source=p=>'data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}).replace(/from "\.\/([\w-]+)"/g,(_,dep)=>`from "${source(dep)}"`)).toString('base64');
const load=p=>import(source(p));
const plans=await load('firm-plans');
const {createOrder,fulfillOrder,expirePromotions,CATALOG}=await load('orders');
const {chatPost,chatGet}=await load('messaging-service');

const U={customer:'11111111-1111-4111-8111-111111111111',firm:'22222222-2222-4222-8222-222222222222',other:'33333333-3333-4333-8333-333333333333',builder:'44444444-4444-4444-8444-444444444444'};
function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,agent_status TEXT,company TEXT,phone TEXT,whatsapp_enabled INTEGER DEFAULT 0);
  CREATE TABLE listings(id TEXT,owner_id TEXT,status TEXT,title TEXT,featured INTEGER DEFAULT 0,expires_at TEXT);
  CREATE TABLE service_firms(id TEXT PRIMARY KEY,owner_id TEXT,name TEXT,status TEXT,featured INTEGER DEFAULT 0);
  CREATE TABLE contractor_firms(id TEXT PRIMARY KEY,owner_id TEXT,name TEXT,status TEXT,featured INTEGER DEFAULT 0);
  CREATE TABLE messages(id TEXT PRIMARY KEY,listing_id TEXT,sender_id TEXT,recipient_id TEXT,body TEXT,created_at TEXT);`);
 sql.exec(`INSERT INTO users(id,name) VALUES('${U.customer}','Kunde'),('${U.firm}','Usta'),('${U.other}','Başka'),('${U.builder}','Müteahhit');
  INSERT INTO service_firms VALUES('svc-1','${U.firm}','Boya Usta','approved',0),('svc-2','${U.other}','Taslak','pending',0);
  INSERT INTO contractor_firms VALUES('ctr-1','${U.builder}','Yapı AŞ','approved',0);`);
 const db={prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}};
 return {sql,db};
}

test('limits per tier; while packages are switched off every firm gets the Pro limits without the featured place',()=>{
 assert.deepEqual([plans.FIRM_LIMITS.service.free.photos,plans.FIRM_LIMITS.service.plus.photos,plans.FIRM_LIMITS.service.pro.photos],[1,5,20]);
 assert.deepEqual([plans.FIRM_LIMITS.contractor.free.projects,plans.FIRM_LIMITS.contractor.plus.projects,plans.FIRM_LIMITS.contractor.pro.projects],[1,10,30]);
 assert.equal(plans.FIRM_LIMITS.service.free.messaging,false);assert.equal(plans.FIRM_LIMITS.service.plus.messaging,true);
 const off=plans.firmLimits('service','free',false);assert.equal(off.photos,20);assert.equal(off.messaging,true);assert.equal(off.featured,false);
 assert.equal(plans.firmLimits('service','free',true).photos,1);
 assert.equal(plans.firmPlansEnabled({FIRM_PLANS:'1'}),true);assert.equal(plans.firmPlansEnabled({}),false);assert.equal(plans.firmPlansEnabled({FIRM_PLANS:'true'}),false);
 // A year costs ten months, and the catalog matches the price table.
 for(const kind of ['service','contractor'])for(const tier of ['plus','pro']){assert.equal(CATALOG[`${kind}-${tier}`].amount,plans.FIRM_PRICES[kind][tier]);assert.equal(CATALOG[`${kind}-${tier}-year`].amount,plans.FIRM_PRICES[kind][tier]*10);assert.equal(CATALOG[`${kind}-${tier}-year`].days,365);}
});

test('land requests: none on the free package, a day later on Plus, at once on Pro',()=>{
 const at=new Date('2026-11-16T12:00:00Z');
 assert.equal(plans.landCutoff(plans.FIRM_LIMITS.contractor.free,at),null);
 assert.equal(plans.landCutoff(plans.FIRM_LIMITS.contractor.plus,at),'2026-11-15T12:00:00.000Z');
 assert.equal(plans.landCutoff(plans.FIRM_LIMITS.contractor.pro,at),undefined);
});

test('a paid order sets the package; the same package extends, Pro features the firm until it ends',async()=>{const f=fixture();try{
 const t0=new Date('2026-11-16T10:00:00Z');
 await assert.rejects(()=>createOrder(f.db,{id:U.firm,role:'buyer',accountKind:'contractor'},{item:'service-plus'},'bank_transfer',t0),e=>e.status===403);
 const a=await createOrder(f.db,{id:U.firm,role:'buyer',accountKind:'service'},{item:'service-pro'},'bank_transfer',t0);assert.equal(a.amount,990);
 const r1=await fulfillOrder(f.db,'admin',a.id,'',t0);assert.equal(r1.planEndsAt,'2026-12-16T10:00:00.000Z');
 assert.deepEqual(await plans.firmPlan(f.db,U.firm,'service',t0),{tier:'pro',endsAt:'2026-12-16T10:00:00.000Z'});
 assert.equal((await plans.firmPlan(f.db,U.firm,'contractor',t0)).tier,'free');
 assert.equal(f.sql.prepare("SELECT featured FROM service_firms WHERE id='svc-1'").get().featured,1);
 const b=await createOrder(f.db,{id:U.firm,role:'buyer',accountKind:'service'},{item:'service-pro'},'bank_transfer',t0);
 assert.equal((await fulfillOrder(f.db,'admin',b.id,'',new Date('2026-11-20T10:00:00Z'))).planEndsAt,'2027-01-15T10:00:00.000Z');
 await expirePromotions(f.db,new Date('2027-01-10T00:00:00Z'));assert.equal(f.sql.prepare("SELECT featured FROM service_firms WHERE id='svc-1'").get().featured,1);
 await expirePromotions(f.db,new Date('2027-01-16T00:00:00Z'));
 assert.equal(f.sql.prepare("SELECT featured FROM service_firms WHERE id='svc-1'").get().featured,0);
 assert.equal((await plans.firmPlan(f.db,U.firm,'service',new Date('2027-01-16T00:00:00Z'))).tier,'free');
}finally{f.sql.close()}});

test('switching from Pro to Plus starts the new package now and removes the featured place',async()=>{const f=fixture();try{
 const t0=new Date('2026-11-16T10:00:00Z');
 await plans.grantFirmPlan(f.db,U.builder,'contractor-pro',30,'o1',t0);assert.equal(f.sql.prepare("SELECT featured FROM contractor_firms").get().featured,1);
 const r=await plans.grantFirmPlan(f.db,U.builder,'contractor-plus',30,'o2',new Date('2026-11-20T10:00:00Z'));
 assert.equal(r.endsAt,'2026-12-20T10:00:00.000Z');assert.equal(f.sql.prepare("SELECT featured FROM contractor_firms").get().featured,0);
 await assert.rejects(()=>plans.grantFirmPlan(f.db,U.builder,'contractor-gold',30,'o3',t0));
}finally{f.sql.close()}});

test('firm threads: a member writes to an approved firm, the firm answers only existing threads',async()=>{const f=fixture();try{
 const key=plans.firmThreadKey('service','svc-1');assert.deepEqual(plans.parseFirmThread(key),{kind:'service',firmId:'svc-1'});assert.equal(plans.parseFirmThread('firm:x:1'),null);
 const customer={id:U.customer,admin:false},firm={id:U.firm,admin:false},other={id:U.other,admin:false};
 // The firm owner cannot open a thread with anyone.
 await assert.rejects(()=>chatPost(f.db,firm,{listingId:key,peerId:U.customer,message:'Merhaba'}),e=>e.status===403);
 const sent=await chatPost(f.db,customer,{listingId:key,message:'Guten Tag, streichen Sie auch Fassaden?'});
 assert.equal(sent.peerId,U.firm);
 await chatPost(f.db,firm,{listingId:key,peerId:U.customer,message:'Evet, dış cephe de boyuyoruz.'});
 // Only the firm's owner is a valid peer; an unapproved firm takes no new threads.
 await assert.rejects(()=>chatPost(f.db,other,{listingId:key,peerId:U.customer,message:'Ben de buradayım'}),e=>e.status===403);
 await assert.rejects(()=>chatPost(f.db,customer,{listingId:plans.firmThreadKey('service','svc-2'),message:'Merhaba'}),e=>e.status===403);
 await assert.rejects(()=>chatPost(f.db,customer,{listingId:plans.firmThreadKey('service','svc-9'),peerId:U.firm,message:'Merhaba'}),e=>e.status===404);
 const list=await chatGet(f.db,firm,new URLSearchParams());assert.equal(list.conversations.length,1);assert.equal(list.conversations[0].listing_id,key);
 const thread=await chatGet(f.db,customer,new URLSearchParams({listingId:key,peerId:U.firm}));assert.equal(thread.messages.length,2);
}finally{f.sql.close()}});

test('firm threads: a firm may write first to a member whose request reached it (2026-11-25)',async()=>{const f=fixture();try{
 const firm={id:U.firm,admin:false},key=plans.firmThreadKey('service','svc-1');
 f.sql.exec("CREATE TABLE service_quote_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL);CREATE TABLE service_quote_recipients(request_id TEXT NOT NULL,firm_id TEXT NOT NULL)");
 // No request from this member yet: still refused.
 await assert.rejects(()=>chatPost(f.db,firm,{listingId:key,peerId:U.customer,message:'Talebiniz hakkında'}),e=>e.status===403);
 f.sql.exec(`INSERT INTO service_quote_requests VALUES('q1','${U.customer}');INSERT INTO service_quote_recipients VALUES('q1','svc-1')`);
 const sent=await chatPost(f.db,firm,{listingId:key,peerId:U.customer,message:'Merhaba, keşif için ne zaman uygunsunuz?'});assert.equal(sent.peerId,U.customer);
 // A request to another firm does not open a thread for this one, nor for other members.
 await assert.rejects(()=>chatPost(f.db,firm,{listingId:key,peerId:U.other,message:'Merhaba'}),e=>e.status===403);
}finally{f.sql.close()}});
