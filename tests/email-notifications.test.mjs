import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import ts from 'typescript';import {emailUrl} from './email-module.mjs';
const compile=p=>'data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64');
const email=await import(emailUrl());
const source=readFileSync(new URL('../lib/email-notifications.ts',import.meta.url),'utf8').replace('from "./email"',`from "${emailUrl()}"`).replace('import { searchSql } from "./search-filters";','const searchSql=(q)=>({where:"l.status=\'published\' AND l.city=?",values:[new URLSearchParams(q).get("city")]});');
const notify=await import('data:text/javascript;base64,'+Buffer.from(ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));
const settings={RESEND_API_KEY:'re_test',EMAIL_FROM:'Test <a@example.com>',SITE_URL:'https://site.example'};
function fixture(){const sql=new DatabaseSync(':memory:');sql.exec("CREATE TABLE users(id TEXT,name TEXT,email TEXT,email_verified INTEGER);CREATE TABLE listings(id TEXT,title TEXT,status TEXT,city TEXT,published_at TEXT);CREATE TABLE saved_searches(user_id TEXT,name TEXT,query TEXT,enabled INTEGER);CREATE TABLE favorites(user_id TEXT,listing_id TEXT);CREATE TABLE price_history(listing_id TEXT,old_price INTEGER,new_price INTEGER,currency TEXT,changed_at TEXT)");
 sql.exec("INSERT INTO users VALUES('u1','Ayşe','ayse@example.com',1),('u2','Can','can@example.com',1),('u3','Unverified','x@example.com',0);INSERT INTO listings VALUES('l1','Sea <view> flat','published','İzmir','2026-10-28T08:00:00Z')");
 const db={prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}};return {sql,db};}
function mockFetch(){const calls=[];globalThis.fetch=async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return new Response('{}',{status:200});};return calls;}
test('without Resend settings nothing is sent',async()=>{const f=fixture();const calls=mockFetch();assert.equal(await notify.notifyNewMessage(f.db,{SITE_URL:'x'},{listingId:'l1',senderId:'u2',recipientId:'u1'}),'not_configured');assert.equal(calls.length,0);f.sql.close();});
test('a new message emails the recipient once per 30 minutes per conversation, escaping the listing title',async()=>{const f=fixture();const calls=mockFetch();const t0=new Date('2026-10-28T10:00:00Z');
 assert.equal(await notify.notifyNewMessage(f.db,settings,{listingId:'l1',senderId:'u2',recipientId:'u1'},t0),'sent');
 assert.equal(await notify.notifyNewMessage(f.db,settings,{listingId:'l1',senderId:'u2',recipientId:'u1'},new Date(t0.getTime()+10*60000)),'throttled');
 assert.equal(await notify.notifyNewMessage(f.db,settings,{listingId:'l1',senderId:'u2',recipientId:'u1'},new Date(t0.getTime()+31*60000)),'sent');
 assert.equal(calls.length,2);assert.deepEqual(calls[0].body.to,['ayse@example.com']);assert.match(calls[0].body.html,/Sea &lt;view&gt; flat/);assert.match(calls[0].body.headers['List-Unsubscribe'],/token=[a-f0-9]{48}&type=messages/);f.sql.close();});
test('opted-out and unverified recipients get no email',async()=>{const f=fixture();mockFetch();await notify.setEmailPreferences(f.db,'u1',{messages:false});assert.equal(await notify.notifyNewMessage(f.db,settings,{listingId:'l1',senderId:'u2',recipientId:'u1'}),'opted_out');assert.equal(await notify.notifyNewMessage(f.db,settings,{listingId:'l1',senderId:'u1',recipientId:'u3'}),'no_recipient');f.sql.close();});
test('unsubscribe link turns off only the chosen kind and rejects bad tokens',async()=>{const f=fixture();const p=await notify.emailPreferences(f.db,'u1');await notify.setEmailPreferences(f.db,'u1',{alerts:true});assert.equal(await notify.unsubscribe(f.db,p.token,'alerts'),true);const after=await notify.emailPreferences(f.db,'u1');assert.equal(after.alerts,false);assert.equal(after.messages,true);assert.equal(await notify.unsubscribe(f.db,'nope','all'),false);f.sql.close();});
test('daily digest is opt-in and only covers matches since the last digest',async()=>{const f=fixture();const calls=mockFetch();f.sql.exec("INSERT INTO saved_searches VALUES('u1','İzmir daireler','city=%C4%B0zmir',1),('u2','İzmir','city=%C4%B0zmir',1)");
 await notify.setEmailPreferences(f.db,'u1',{alerts:true},new Date('2026-10-28T07:00:00Z'));
 const first=await notify.sendDailyDigests(f.db,settings,new Date('2026-10-29T06:00:00Z'));assert.deepEqual(first,{users:1,sent:1});assert.match(calls[0].body.html,/İzmir daireler<\/a>: 1 yeni ilan/);
 const second=await notify.sendDailyDigests(f.db,settings,new Date('2026-10-30T06:00:00Z'));assert.deepEqual(second,{users:1,sent:0});f.sql.close();});
test('a digest that fails to send is retried the next day with the same listings',async()=>{const f=fixture();f.sql.exec("INSERT INTO saved_searches VALUES('u1','İzmir daireler','city=%C4%B0zmir',1)");
 await notify.setEmailPreferences(f.db,'u1',{alerts:true},new Date('2026-10-28T07:00:00Z'));
 globalThis.fetch=async()=>new Response('{"message":"down"}',{status:503});
 const failed=await notify.sendDailyDigests(f.db,settings,new Date('2026-10-29T06:00:00Z'));assert.deepEqual(failed,{users:1,sent:0});
 const calls=mockFetch();
 const retried=await notify.sendDailyDigests(f.db,settings,new Date('2026-10-30T06:00:00Z'));assert.deepEqual(retried,{users:1,sent:1});assert.match(calls[0].body.html,/İzmir daireler<\/a>: 1 yeni ilan/);f.sql.close();});

test('viewing appointments: request mails the seller, status changes mail the other party, each once',async()=>{
 const f=fixture();const calls=mockFetch();const t0=new Date('2026-11-24T10:00:00Z');
 f.sql.exec("CREATE TABLE appointments(id TEXT,listing_id TEXT,buyer_id TEXT,seller_id TEXT,slot_at TEXT,message TEXT,status TEXT)");
 // u2 (Can) asks to see u1's (Ayşe) listing; u3 is unverified.
 f.sql.exec("INSERT INTO appointments VALUES('a1','l1','u2','u1','2026-11-28T08:00:00Z','Cumartesi <sabah>?','requested'),('a2','l1','u3','u1','2026-11-29T08:00:00Z','','requested')");
 assert.equal(await notify.notifyAppointment(f.db,{SITE_URL:'x'},{appointmentId:'a1',actorId:'u2'},t0),'not_configured');
 assert.equal(await notify.notifyAppointment(f.db,settings,{appointmentId:'a1',actorId:'u2'},t0),'sent');
 assert.deepEqual(calls[0].body.to,['ayse@example.com']);assert.match(calls[0].body.subject,/^Yeni yer görme talebi \/ New viewing request: Sea <view> flat/);
 assert.match(calls[0].body.html,/Cumartesi &lt;sabah&gt;\?/);assert.match(calls[0].body.html,/Sea &lt;view&gt; flat/);assert.match(calls[0].body.html,/Can/);assert.match(calls[0].body.html,/hesabim\?tab=randevular/);
 assert.equal(await notify.notifyAppointment(f.db,settings,{appointmentId:'a1',actorId:'u2'},t0),'already_sent','the same status is mailed once');
 f.sql.exec("UPDATE appointments SET status='confirmed' WHERE id='a1'");
 assert.equal(await notify.notifyAppointment(f.db,settings,{appointmentId:'a1',actorId:'u1'},t0),'sent');assert.deepEqual(calls[1].body.to,['can@example.com']);assert.match(calls[1].body.subject,/Randevunuz onaylandı/);
 f.sql.exec("UPDATE appointments SET status='cancelled' WHERE id='a1'");
 assert.equal(await notify.notifyAppointment(f.db,settings,{appointmentId:'a1',actorId:'u2'},t0),'sent','the buyer cancels: the seller hears');assert.deepEqual(calls[2].body.to,['ayse@example.com']);
 f.sql.exec("UPDATE appointments SET status='completed' WHERE id='a1'");
 assert.equal(await notify.notifyAppointment(f.db,settings,{appointmentId:'a1',actorId:'u1'},t0),'no_email','done visits need no mail');
 f.sql.exec("UPDATE appointments SET status='confirmed' WHERE id='a2'");
 assert.equal(await notify.notifyAppointment(f.db,settings,{appointmentId:'a2',actorId:'u1'},t0),'no_recipient','unverified addresses get nothing');
 assert.equal(calls.length,3);
 f.sql.close();
});
