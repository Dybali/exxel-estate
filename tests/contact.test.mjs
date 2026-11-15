import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import ts from 'typescript';
const transpile=p=>ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
let code=transpile('contact');assert.ok(code.includes('"./email-layout"'));assert.ok(!code.includes('"./email"'),'lib/contact.ts must not import the e-mail transports (client components use it)');code=code.replace('"./email-layout"',JSON.stringify(url(transpile('email-layout'))));
const C=await import(url(code));

function fixture(){
 const sql=new DatabaseSync(':memory:');
 const db={prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}};
 return {sql,db};
}
const valid=(extra={})=>({name:'  Ayşe   Yılmaz ',email:'Ayse@Example.com',subject:'listing',message:'Bodrum’daki ilan hakkında bilgi almak istiyorum.',consent:true,locale:'de',...extra});
const rejects=(promise,status,pattern)=>assert.rejects(promise,e=>e instanceof C.ContactError&&e.status===status&&(!pattern||pattern.test(e.message)));

test('validation rejects missing or malformed fields and normalises the rest',async()=>{
 const {sql,db}=fixture();try{
  await rejects(C.submitContact(db,valid({name:'A'})),400,/Adınızı/);
  await rejects(C.submitContact(db,valid({name:'x'.repeat(101)})),400,/Adınızı/);
  await rejects(C.submitContact(db,valid({email:'ayse@'})),400,/e-posta/);
  await rejects(C.submitContact(db,valid({email:'a b@example.com'})),400,/e-posta/);
  await rejects(C.submitContact(db,valid({subject:'spam'})),400,/konu/);
  await rejects(C.submitContact(db,valid({subject:'__proto__'})),400,/konu/);
  await rejects(C.submitContact(db,valid({message:'kısa'})),400,/en az 10/);
  await rejects(C.submitContact(db,valid({message:'x'.repeat(2001)})),400,/2000/);
  // Answering a request needs no consent checkbox (the privacy notice is linked instead).
  assert.ok(C.validateContact(valid({consent:undefined})));
  const saved=await C.submitContact(db,valid({message:'x'.repeat(2000),locale:'xx'}),'user-1');
  assert.equal(saved.name,'Ayşe Yılmaz');assert.equal(saved.email,'ayse@example.com');assert.equal(saved.locale,'tr');assert.equal(saved.userId,'user-1');assert.equal(saved.status,'new');
  const row=sql.prepare('SELECT * FROM contact_messages').get();assert.equal(row.subject,'listing');assert.equal(row.message.length,2000);
 }finally{sql.close()}
});

test('honeypot submissions are accepted silently and not stored',async()=>{
 const {sql,db}=fixture();try{
  assert.equal(await C.submitContact(db,valid({website:'https://spam.example'})),null);
  assert.equal(await C.submitContact(db,{website:'x'}),null);
  await C.submitContact(db,valid({website:'   '}));
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM contact_messages').get().n,1);
 }finally{sql.close()}
});

test('rate limits: five per e-mail per day and thirty per hour overall',async()=>{
 const {sql,db}=fixture();try{
  const start=new Date('2026-11-02T08:00:00Z'),at=minutes=>new Date(start.getTime()+minutes*60000);
  for(let i=0;i<5;i++)await C.submitContact(db,valid(),null,at(i*30));
  await rejects(C.submitContact(db,valid({email:'AYSE@example.com'}),null,at(200)),429,/yarın/);
  // The window slides: 24 hours after the first message one more is allowed.
  await C.submitContact(db,valid(),null,at(24*60+1));
  // Overall hourly limit across different addresses.
  const later=minutes=>at(3*24*60+minutes);
  for(let i=0;i<30;i++)await C.submitContact(db,valid({email:`kisi${i}@example.com`}),null,later(i));
  await rejects(C.submitContact(db,valid({email:'yeni@example.com'}),null,later(40)),429,/biraz sonra/);
  await C.submitContact(db,valid({email:'yeni@example.com'}),null,later(61));
 }finally{sql.close()}
});

test('admin listing is newest first, filters by status and marks messages handled',async()=>{
 const {sql,db}=fixture();try{
  const empty=await C.adminContactMessages(db);assert.deepEqual(empty,{messages:[],newCount:0});
  const first=await C.submitContact(db,valid({subject:'general'}),null,new Date('2026-11-01T10:00:00Z'));
  const second=await C.submitContact(db,valid({email:'can@example.com',subject:'privacy'}),null,new Date('2026-11-02T10:00:00Z'));
  let list=await C.adminContactMessages(db);
  assert.deepEqual(list.messages.map(m=>m.id),[second.id,first.id]);assert.equal(list.newCount,2);
  const handled=await C.setContactHandled(db,'admin-1',first.id,true,new Date('2026-11-02T11:00:00Z'));
  assert.equal(handled.status,'handled');assert.equal(handled.handledAt,'2026-11-02T11:00:00.000Z');
  assert.equal(sql.prepare('SELECT handled_by FROM contact_messages WHERE id=?').get(first.id).handled_by,'admin-1');
  list=await C.adminContactMessages(db,'new');assert.deepEqual(list.messages.map(m=>m.id),[second.id]);assert.equal(list.newCount,1);
  list=await C.adminContactMessages(db,'handled');assert.deepEqual(list.messages.map(m=>m.id),[first.id]);
  const reopened=await C.setContactHandled(db,'admin-1',first.id,false);assert.equal(reopened.status,'new');assert.equal(reopened.handledAt,null);
  await assert.rejects(C.setContactHandled(db,'admin-1','not-an-id',true),e=>e.status===400);
  await assert.rejects(C.setContactHandled(db,'admin-1',crypto.randomUUID(),true),e=>e.status===404);
  await assert.rejects(C.setContactHandled(db,'admin-1',first.id,'yes'),e=>e.status===400);
 }finally{sql.close()}
});

test('admin notification escapes the visitor’s text',()=>{
 const notice=C.contactNotice({id:'1',name:'<b>Kötü</b>',email:'a@example.com',subject:'technical',message:'Satır 1\n<script>x</script>',locale:'en',userId:null,status:'new',createdAt:'',handledAt:null},'https://site.test');
 assert.match(notice.subject,/Teknik sorun/);assert.ok(!notice.html.includes('<script>'));assert.ok(notice.html.includes('&lt;b&gt;Kötü'));assert.ok(notice.html.includes('<br>'));assert.match(notice.text,/https:\/\/site\.test\/yonetim\?view=contact/);
});
