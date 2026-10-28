import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import ts from 'typescript';
const load=p=>import('data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));
const {createOrder,fulfillOrder,cancelOrder,userOrders,adminOrders,expirePromotions,CATALOG}=await load('orders');
const {bankTransfer}=await load('payment-providers');
function fixture(){const sql=new DatabaseSync(':memory:');sql.exec("CREATE TABLE users(id TEXT,name TEXT,email TEXT);CREATE TABLE listings(id TEXT,owner_id TEXT,status TEXT,title TEXT,featured INTEGER DEFAULT 0);CREATE TABLE agent_plan_grants(id TEXT PRIMARY KEY,user_id TEXT,plan_id TEXT,listing_limit INTEGER,starts_at TEXT,ends_at TEXT,revoked_at TEXT,note TEXT,granted_by TEXT,created_at TEXT);CREATE UNIQUE INDEX one_active ON agent_plan_grants(user_id) WHERE revoked_at IS NULL");
 sql.exec("INSERT INTO users VALUES('u1','Owner','o@example.com'),('a1','Agent','a@example.com');INSERT INTO listings VALUES('l1','u1','published','Flat',0),('l2','u1','pending','Draft',0),('l3','a1','published','Other',0)");
 const db={prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}};return {sql,db};}
const owner={id:'u1',role:'individual'},agent={id:'a1',role:'agent'};
test('featuring is limited to the owner\'s published listings and one open order per item',async()=>{const f=fixture();try{
 const order=await createOrder(f.db,owner,{item:'featured-7',listingId:'l1'},'bank_transfer');assert.match(order.reference,/^EM24-[A-Z2-9]{6}$/);assert.equal(order.amount,CATALOG['featured-7'].amount);
 await assert.rejects(()=>createOrder(f.db,owner,{item:'featured-7',listingId:'l1'},'bank_transfer'),e=>e.status===409);
 await assert.rejects(()=>createOrder(f.db,owner,{item:'featured-7',listingId:'l2'},'bank_transfer'),/yayındaki/);
 await assert.rejects(()=>createOrder(f.db,owner,{item:'featured-7',listingId:'l3'},'bank_transfer'),e=>e.status===404);
 await assert.rejects(()=>createOrder(f.db,owner,{item:'plan-prestige'},'bank_transfer'),e=>e.status===403);
 await assert.rejects(()=>createOrder(f.db,owner,{item:'free-money'},'bank_transfer'),/Geçersiz ürün/);}finally{f.sql.close()}});
test('confirming payment features the listing, extends an active period and cannot run twice',async()=>{const f=fixture();try{
 const t0=new Date('2026-10-28T10:00:00Z');const a=await createOrder(f.db,owner,{item:'featured-7',listingId:'l1'},'bank_transfer',t0);
 const r1=await fulfillOrder(f.db,'admin',a.id,'',t0);assert.equal(r1.featuredUntil,'2026-11-04T10:00:00.000Z');assert.equal(f.sql.prepare("SELECT featured FROM listings WHERE id='l1'").get().featured,1);
 await assert.rejects(()=>fulfillOrder(f.db,'admin',a.id,'',t0),e=>e.status===409);
 const b=await createOrder(f.db,owner,{item:'featured-30',listingId:'l1'},'bank_transfer',t0);const r2=await fulfillOrder(f.db,'admin',b.id,'',new Date('2026-10-30T10:00:00Z'));assert.equal(r2.featuredUntil,'2026-12-04T10:00:00.000Z');
 const mine=await userOrders(f.db,'u1');assert.equal(mine.length,2);assert.ok(mine.every(o=>o.status==='fulfilled'));
 await expirePromotions(f.db,new Date('2026-12-01T00:00:00Z'));assert.equal(f.sql.prepare("SELECT featured FROM listings WHERE id='l1'").get().featured,1);
 await expirePromotions(f.db,new Date('2026-12-05T00:00:00Z'));assert.equal(f.sql.prepare("SELECT featured FROM listings WHERE id='l1'").get().featured,0);}finally{f.sql.close()}});
test('plan orders replace the active grant and keep the remaining time',async()=>{const f=fixture();try{
 const t0=new Date('2026-10-28T10:00:00Z');const a=await createOrder(f.db,agent,{item:'plan-professional'},'bank_transfer',t0);await fulfillOrder(f.db,'admin',a.id,'',t0);
 const b=await createOrder(f.db,agent,{item:'plan-prestige'},'bank_transfer',t0);await fulfillOrder(f.db,'admin',b.id,'',new Date('2026-11-07T10:00:00Z'));
 const grants=f.sql.prepare("SELECT plan_id,ends_at,revoked_at FROM agent_plan_grants ORDER BY created_at").all();assert.equal(grants.length,2);assert.ok(grants[0].revoked_at);assert.equal(grants[1].plan_id,'prestige');assert.equal(grants[1].ends_at,'2026-12-27T10:00:00.000Z');}finally{f.sql.close()}});
test('users cancel only their own open orders; admins list by status',async()=>{const f=fixture();try{
 const a=await createOrder(f.db,owner,{item:'featured-7',listingId:'l1'},'bank_transfer');await assert.rejects(()=>cancelOrder(f.db,{id:'a1',admin:false},a.id),e=>e.status===409);
 await cancelOrder(f.db,{id:'u1',admin:false},a.id);assert.equal((await adminOrders(f.db,'cancelled')).length,1);assert.equal((await adminOrders(f.db,'awaiting_payment')).length,0);}finally{f.sql.close()}});
test('bank transfer needs an account name and a valid Turkish IBAN',()=>{assert.equal(bankTransfer({}),null);assert.equal(bankTransfer({BANK_ACCOUNT_NAME:'X',BANK_IBAN:'DE89370400440532013000'}),null);assert.equal(bankTransfer({BANK_ACCOUNT_NAME:'Exxel',BANK_IBAN:'tr33 0006 1005 1978 6457 8413 26'}).iban,'TR33 0006 1005 1978 6457 8413 26');});
