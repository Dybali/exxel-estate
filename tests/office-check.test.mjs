import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {DatabaseSync} from 'node:sqlite';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url),cache=new Map();
function load(file){const full=path.resolve(root,file);if(cache.has(full))return cache.get(full);const m={exports:{}};new Function('require','module','exports',ts.transpileModule(readFileSync(full,'utf8'),{fileName:full,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(n=>n.startsWith('.')?load(path.resolve(path.dirname(full),n)+'.ts'):native(n),m,m.exports);cache.set(full,m.exports);return m.exports;}
const C=load('lib/office-check.ts'),D=load('lib/office-decision.ts');

// Automatic agent verification (lib/office-check.ts, lib/office-decision.ts), owner's decision 2026-11-13.
test('tax numbers: VKN and TCKN check digits',()=>{
 assert.equal(C.validVkn('123456789'),false);assert.equal(C.validVkn('12345678ab'),false);
 // A valid VKN changes into an invalid one when its check digit changes.
 const vkn=Array.from({length:1000},(_,i)=>String(4000000000+i*7919).slice(0,10)).find(v=>C.validVkn(v));
 assert.ok(vkn,'some valid VKN exists');assert.equal(C.validVkn(vkn.slice(0,9)+String((Number(vkn[9])+1)%10)),false);
 assert.equal(C.validTckn('10000000146'),true);assert.equal(C.validTckn('10000000147'),false);assert.equal(C.validTckn('01234567890'),false);
 assert.equal(C.validTaxNumber('100 000 001 46'),true);
});

test('business names match despite legal forms, case and Turkish letters',()=>{
 assert.ok(C.nameMatch('Örnek Emlak','ÖRNEK EMLAK GAYRİMENKUL LTD. ŞTİ.')>=0.6);
 assert.ok(C.nameMatch('Deniz Yıldızı Gayrimenkul','Deniz Yildizi Emlak Danismanlik')>=0.6);
 assert.ok(C.nameMatch('Mavi Ev Emlak','Kırmızı Çatı Gayrimenkul')<0.6);
 assert.equal(C.nameMatch('Emlak','Ltd Şti'),0,'only noise words');
});

const doc={document_type:'Taşınmaz Ticareti Yetki Belgesi',is_authority_certificate:true,business_name:'Örnek Emlak Gayrimenkul Ltd. Şti.',document_number:'3500-123',city:'İzmir',valid_until:'2028-08-15',tax_number:'',barcode:'',signs_of_editing:false,notes:''};
test('score: every check passing approves automatically; any doubt goes to the admin, nothing is rejected',()=>{
 const vkn=Array.from({length:5000},(_,i)=>String(1000000000+i*104729)).find(v=>C.validVkn(v));
 const entered={company:'Örnek Emlak',documentNumber:'3500123',taxNumber:vkn},today=new Date('2026-11-13');
 const ok=C.scoreApplication(entered,doc,{number:false,file:false},today);
 assert.equal(ok.decision,'auto_approved');assert.equal(ok.score,100);assert.equal(ok.validUntil,'2028-08-15');
 for(const [change,id] of [[{valid_until:'2026-01-01'},'valid_until'],[{valid_until:''},'valid_until'],[{document_number:'999'},'number_match'],[{business_name:'Başka Firma'},'name_match'],[{is_authority_certificate:false},'document_type'],[{signs_of_editing:true},'no_editing_signs'],[{tax_number:'1111111111'},'tax_number_match']]){
  const r=C.scoreApplication(entered,{...doc,...change},{number:false,file:false},today);
  assert.equal(r.decision,'review',id);assert.ok(r.checks.some(c=>c.id===id&&!c.ok),id);
 }
 assert.equal(C.scoreApplication(entered,doc,{number:true,file:false},today).decision,'review','number used by another account');
 assert.equal(C.scoreApplication(entered,doc,{number:false,file:true},today).decision,'review','same file elsewhere');
 assert.equal(C.scoreApplication({...entered,taxNumber:'123'},doc,{number:false,file:false},today).decision,'review','invalid tax number');
 const unread=C.scoreApplication(entered,null,{number:false,file:false},today);assert.equal(unread.decision,'review');assert.equal(unread.score,0);
});

function database(){const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,company TEXT,role TEXT,agent_status TEXT,email TEXT,email_verified INTEGER);CREATE TABLE agencies(owner_id TEXT,status TEXT);CREATE TABLE listings(id TEXT PRIMARY KEY,owner_id TEXT,status TEXT,review_note TEXT,expires_at TEXT,published_at TEXT,updated_at TEXT,reviewed_by TEXT,reviewed_at TEXT);CREATE TABLE listing_moderation_holds(listing_id TEXT,active INTEGER);CREATE TABLE admin_audit(id TEXT,actor_id TEXT,actor_name TEXT,action TEXT,target_id TEXT,summary TEXT,created_at TEXT);`);
 for(const q of load('lib/office-verification.ts').OFFICE_SCHEMA)sql.exec(q);
 return {sql,prepare(q){return {values:[],bind(...v){this.values=v;return this;},async first(){return sql.prepare(q).get(...this.values)||null;},async all(){return {results:sql.prepare(q).all(...this.values)};},async run(){return sql.prepare(q).run(...this.values);}};},async batch(list){sql.exec('BEGIN');try{for(const s of list)await s.run();sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}}};}
test('automatic check with a mocked OpenAI: approval publishes the first listing; a reused number waits for the admin',async()=>{
 const db=database(),vkn=Array.from({length:5000},(_,i)=>String(1000000000+i*104729)).find(v=>C.validVkn(v));
 db.sql.exec(`INSERT INTO users VALUES('a1','Örnek Emlak','agent','pending','a@x.test',1),('a2','Kopya Emlak','agent','pending','b@x.test',1);INSERT INTO agencies VALUES('a1','pending'),('a2','pending');INSERT INTO listings(id,owner_id,status) VALUES('l1','a1','pending');
  INSERT INTO office_verifications(user_id,document_id,document_number,company_snapshot,object_key,content_type,byte_size,state,version,created_at,updated_at) VALUES('a1','d1','3500123','Örnek Emlak','k','application/pdf',10,'pending',1,'now','now'),('a2','d2','3500123','Kopya Emlak','k2','application/pdf',10,'pending',1,'now','now');`);
 let request;const fetcher=async(url,init)=>{request=JSON.parse(init.body);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(doc)}}]});};
 const bytes=new TextEncoder().encode('%PDF-1.4 fake');
 const first=await C.checkOffice(db,{userId:'a1',documentId:'d1',company:'Örnek Emlak',documentNumber:'3500123',taxNumber:vkn,bytes,contentType:'application/pdf'},{OPENAI_API_KEY:'k'},fetcher,new Date('2026-11-13'));
 assert.equal(request.model,'gpt-6-luna');assert.equal(request.messages[1].content[0].type,'file');assert.equal(request.response_format.json_schema.strict,true);
 assert.equal(first.decision,'review','the same number is pending on another account');
 db.sql.exec("UPDATE office_verifications SET state='rejected' WHERE user_id='a2'");
 const second=await C.checkOffice(db,{userId:'a1',documentId:'d1',company:'Örnek Emlak',documentNumber:'3500123',taxNumber:vkn,bytes,contentType:'application/pdf'},{OPENAI_API_KEY:'k'},fetcher,new Date('2026-11-13'));
 assert.equal(second.decision,'auto_approved');
 const {published}=await D.decideOffice(db,{userId:'a1',state:'approved',note:'',version:1,actor:{id:'system',name:'Otomatik doğrulama'}});
 assert.deepEqual(published,['l1']);assert.equal(db.sql.prepare("SELECT status FROM listings WHERE id='l1'").get().status,'published');
 assert.equal(db.sql.prepare("SELECT agent_status FROM users WHERE id='a1'").get().agent_status,'approved');
 // The same file on another account is flagged.
 const copy=await C.checkOffice(db,{userId:'a2',documentId:'d2',company:'Kopya Emlak',documentNumber:'777',taxNumber:vkn,bytes,contentType:'application/pdf'},{OPENAI_API_KEY:'k'},fetcher,new Date('2026-11-13'));
 assert.ok(copy.checks.some(c=>c.id==='unique_file'&&!c.ok));
 // Without an OpenAI key nothing is read and the admin decides.
 assert.equal((await C.checkOffice(db,{userId:'a1',documentId:'d1',company:'x',documentNumber:'1',taxNumber:vkn,bytes,contentType:'application/pdf'},{},fetcher)).decision,'review');
});

test('expiry: one reminder within 30 days, approval withdrawn after the date',async()=>{
 const db=database();await C.ensureOfficeChecks(db);
 db.sql.exec(`INSERT INTO users VALUES('s','Soon','agent','approved','s@x.test',1),('e','Expired','agent','approved','e@x.test',1);INSERT INTO agencies VALUES('s','approved'),('e','approved');
  INSERT INTO office_verifications(user_id,document_id,document_number,company_snapshot,object_key,content_type,byte_size,state,version,created_at,updated_at) VALUES('s','ds','1','Soon','k','application/pdf',1,'approved',2,'n','n'),('e','de','2','Expired','k','application/pdf',1,'approved',2,'n','n');
  INSERT INTO office_checks(user_id,document_id,file_hash,score,decision,checks,extracted,valid_until,model,checked_at) VALUES('s','ds','h1',100,'auto_approved','[]','{}','2026-12-01','m','n'),('e','de','h2',100,'auto_approved','[]','{}','2026-11-01','m','n');`);
 const mails=[];const revoke=(id,note)=>D.revokeOffice(db,id,note,{id:'system',name:'Otomatik doğrulama'});
 const at=new Date('2026-11-13T06:00:00Z');
 assert.deepEqual(await C.officeExpiryJob(db,async(to)=>{mails.push(to);},revoke,at),{reminded:1,expired:1});
 assert.deepEqual(mails,['s@x.test']);
 assert.equal(db.sql.prepare("SELECT state FROM office_verifications WHERE user_id='e'").get().state,'rejected');
 assert.equal(db.sql.prepare("SELECT agent_status FROM users WHERE id='e'").get().agent_status,'rejected');
 assert.deepEqual(await C.officeExpiryJob(db,async(to)=>{mails.push(to);},revoke,at),{reminded:0,expired:0},'no second reminder');
 await assert.rejects(D.revokeOffice(db,'s','no',{id:'a',name:'A'}),/en az 5/);
});
