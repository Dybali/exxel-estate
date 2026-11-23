// E-mail transports (docs/email-notifications.md): provider selection (Resend → SMTP → none), the
// Mittwald sender rule, Reply-To defaults, TLS options for 465/587, a real MIME message through
// nodemailer's stream transport, refusal to authenticate without TLS, safe logging, the Cloudflare
// stand-in, the admin reply API for contact messages and the admin test e-mail.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import {emailUrl,dataUrl} from './email-module.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),nativeRequire=createRequire(import.meta.url);
const read=file=>readFileSync(path.join(root,file),'utf8');
function load(file,overrides={}){const full=path.resolve(root,file),module={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(overrides[name])return overrides[name];if(name.startsWith('.')||name.startsWith('@/')){const resolved=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return load(resolved+'.ts',overrides);}return nativeRequire(name);},module,module.exports);return module.exports;}

const config=load('lib/email-smtp-config.ts');
const SMTP={SMTP_HOST:'mail.agenturserver.de',SMTP_PORT:'465',SMTP_USER:'noreply@estatemarket24.com',SMTP_PASSWORD:'s3cret-Pass!word',EMAIL_FROM:'EstateMarket24 <noreply@estatemarket24.com>',CONTACT_EMAIL:'info@estatemarket24.com'};
// Captures console output so tests can prove what is (not) logged.
async function captureLogs(fn){const lines=[],saved={};for(const k of ['log','info','warn','error','debug']){saved[k]=console[k];console[k]=(...a)=>lines.push(a.map(String).join(' '));}try{const result=await fn();return {result,logs:lines.join('\n')};}finally{Object.assign(console,saved);}}

test('SMTP options: implicit TLS on 465, required STARTTLS on 587, certificates verified, pooled with timeouts',()=>{
 const tls465=config.smtpOptions(SMTP);
 assert.equal(tls465.host,'mail.agenturserver.de');assert.equal(tls465.port,465);assert.equal(tls465.secure,true);assert.equal(tls465.requireTLS,false);
 assert.equal(tls465.tls.rejectUnauthorized,true);assert.equal(tls465.tls.minVersion,'TLSv1.2');assert.equal(tls465.tls.servername,'mail.agenturserver.de');
 assert.equal(tls465.pool,true);assert.ok(tls465.maxConnections<=3);assert.ok(tls465.connectionTimeout<=10000&&tls465.greetingTimeout<=10000&&tls465.socketTimeout<=30000);
 assert.equal(tls465.logger,false);assert.equal(tls465.debug,false);
 const starttls=config.smtpOptions({...SMTP,SMTP_PORT:'587'});
 assert.equal(starttls.secure,false);assert.equal(starttls.requireTLS,true);assert.equal(starttls.ignoreTLS,false);assert.equal(starttls.tls.rejectUnauthorized,true);
 assert.equal(config.smtpOptions({...SMTP,SMTP_PORT:''}).port,465,'465 is the default');
 assert.equal(config.smtpOptions({...SMTP,SMTP_PORT:'abc'}),null);assert.equal(config.smtpOptions({...SMTP,SMTP_PORT:'70000'}),null);
 for(const missing of ['SMTP_HOST','SMTP_USER','SMTP_PASSWORD'])assert.equal(config.smtpOptions({...SMTP,[missing]:''}),null,missing);
});

test('sender rule: the authenticated mailbox is the From address, EMAIL_FROM keeps the display name',()=>{
 assert.deepEqual(config.smtpFrom(SMTP),{name:'EstateMarket24',address:'noreply@estatemarket24.com'});
 assert.deepEqual(config.smtpFrom({...SMTP,EMAIL_FROM:'EstateMarket24 <bildirim@exxelestate.com>'}),{name:'EstateMarket24',address:'noreply@estatemarket24.com'});
 assert.deepEqual(config.smtpFrom({...SMTP,EMAIL_FROM:'"Estate, Market" <NoReply@EstateMarket24.com>'}),{name:'Estate, Market',address:'noreply@estatemarket24.com'});
 assert.deepEqual(config.smtpFrom({...SMTP,EMAIL_FROM:''}),{name:'EstateMarket24',address:'noreply@estatemarket24.com'});
 // A classic Mittwald login (p123456p1) is not an address: EMAIL_FROM is used as given.
 assert.deepEqual(config.smtpFrom({...SMTP,SMTP_USER:'p123456p1'}),{name:'EstateMarket24',address:'noreply@estatemarket24.com'});
 assert.equal(config.smtpFrom({...SMTP,SMTP_USER:'p123456p1',EMAIL_FROM:''}),null);
 // Header injection through the display name is not possible.
 assert.deepEqual(config.smtpFrom({...SMTP,EMAIL_FROM:'Evil\r\nBcc: x@y.z <noreply@estatemarket24.com>'}),{name:'EstateMarket24',address:'noreply@estatemarket24.com'});
 assert.equal(config.parseMailAddress('Evil\r\nBcc: x@y.z <a@b.co>'),null);
 assert.deepEqual(config.parseMailAddress('Ev"il <x> <a@b.co>'),{name:'Ev il x',address:'a@b.co'});
 assert.deepEqual(config.parseMailAddress('"Ev\\"il" <a@b.co>'),{name:'Ev\\ il',address:'a@b.co'});
});

test('Reply-To: explicit value, else EMAIL_REPLY_TO, else CONTACT_EMAIL; List-Unsubscribe only with a URL',()=>{
 assert.equal(config.replyToAddress(SMTP),'info@estatemarket24.com');
 assert.equal(config.replyToAddress({...SMTP,EMAIL_REPLY_TO:'Destek <destek@estatemarket24.com>'}),'destek@estatemarket24.com');
 assert.equal(config.replyToAddress(SMTP,'Visitor@Example.com'),'visitor@example.com');
 assert.equal(config.replyToAddress(SMTP,'not an address'),'info@estatemarket24.com');
 assert.equal(config.replyToAddress({}),undefined);
 assert.deepEqual(config.unsubscribeHeaders(),{});
 assert.deepEqual(config.unsubscribeHeaders('https://s/u?t=1'),{'List-Unsubscribe':'<https://s/u?t=1>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'});
 assert.equal(config.recipientDomain('Ayse@Example.COM'),'example.com');
});

const fakeSlot=()=>{const sent=[];globalThis.__smtpSent=sent;const url=dataUrl('export const smtpSend=async(settings,mail)=>{globalThis.__smtpSent.push({settings,mail});return {sent:true,provider:"smtp",messageId:"<m1@test>"};};');return {sent,url};};

test('provider selection: Resend first, then SMTP (Node build only), else not configured',async()=>{
 const cloudflare=await import(emailUrl());
 const {sent,url}=fakeSlot();const node=await import(emailUrl(url));
 assert.equal(cloudflare.emailProvider({}),null);assert.equal(node.emailProvider({}),null);
 assert.equal(cloudflare.emailProvider(SMTP),null,'the Cloudflare build has no SMTP transport');assert.equal(cloudflare.emailReady(SMTP),false);
 assert.equal(node.emailProvider(SMTP),'smtp');assert.equal(node.emailReady(SMTP),true);
 assert.equal(node.emailProvider({...SMTP,RESEND_API_KEY:'re_x'}),'resend');assert.equal(cloudflare.emailProvider({RESEND_API_KEY:'re_x',EMAIL_FROM:'a@b.co'}),'resend');
 assert.equal(node.emailProvider({...SMTP,SMTP_PASSWORD:''}),null);
 assert.deepEqual(await cloudflare.sendEmail(SMTP,{to:'a@example.com',subject:'s',html:'h',text:'t'}),{sent:false,reason:'not_configured'});
 // SMTP: same signature for every caller; sender rule, reply-to default and unsubscribe header applied.
 const result=await node.sendEmail({...SMTP,EMAIL_FROM:'EstateMarket24 <other@estatemarket24.com>'},{to:'a@example.com',subject:'Konu',html:'<p>h</p>',text:'t',unsubscribeUrl:'https://s/u'});
 assert.deepEqual(result,{sent:true,provider:'smtp',messageId:'<m1@test>'});
 assert.deepEqual(sent[0].mail,{from:{name:'EstateMarket24',address:'noreply@estatemarket24.com'},to:'a@example.com',replyTo:'info@estatemarket24.com',subject:'Konu',html:'<p>h</p>',text:'t',headers:{'List-Unsubscribe':'<https://s/u>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}});
 await node.sendEmail(SMTP,{to:'a@example.com',subject:'s',html:'h',text:'t',replyTo:'visitor@example.org'});assert.equal(sent[1].mail.replyTo,'visitor@example.org');assert.deepEqual(sent[1].mail.headers,{});
 assert.deepEqual(await node.sendEmail(SMTP,{to:'bad',subject:'s',html:'h',text:'t'}),{sent:false,reason:'invalid_recipient'});
 // Resend keeps its request shape, plus reply_to.
 const calls=[];const savedFetch=globalThis.fetch;globalThis.fetch=async(u,init)=>{calls.push({u,body:JSON.parse(init.body)});return new Response('{"id":"re_1"}',{status:200});};
 try{
  const viaResend=await node.sendEmail({...SMTP,RESEND_API_KEY:'re_x'},{to:'a@example.com',subject:'s',html:'h',text:'t',unsubscribeUrl:'https://s/u'});
  assert.deepEqual(viaResend,{sent:true,provider:'resend',messageId:'re_1'});assert.equal(sent.length,2,'SMTP not used when Resend is set');
  assert.equal(calls[0].u,'https://api.resend.com/emails');assert.equal(calls[0].body.from,SMTP.EMAIL_FROM);assert.equal(calls[0].body.reply_to,'info@estatemarket24.com');assert.equal(calls[0].body.headers['List-Unsubscribe'],'<https://s/u>');
 }finally{globalThis.fetch=savedFetch;}
});

const nodemailer=nativeRequire('nodemailer');
const smtpNode=()=>load('lib/email-smtp-node.ts');

test('nodemailer produces a multipart message with the mailbox sender, Reply-To and List-Unsubscribe; logs hold no secrets',async()=>{
 const mod=smtpNode();let options;
 mod.setSmtpFactory(o=>{options=o;return nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});});
 const mail={from:config.smtpFrom(SMTP),to:'ayse@example.com',replyTo:'info@estatemarket24.com',subject:'Re: estatemarket24: Genel soru',html:'<p>Gizli içerik BODYMARK</p>',text:'Gizli içerik BODYMARK',headers:config.unsubscribeHeaders('https://s/u')};
 const {result,logs}=await captureLogs(()=>mod.smtpSend(SMTP,mail));
 assert.equal(result.sent,true);assert.equal(result.provider,'smtp');assert.match(result.messageId,/^<.+@.+>$/);
 assert.equal(options.secure,true);assert.equal(options.auth.user,'noreply@estatemarket24.com');
 assert.match(logs,/\[email\] smtp sent/);assert.match(logs,/"to":"example\.com"/);
 for(const secret of [SMTP.SMTP_PASSWORD,'BODYMARK','ayse@'])assert.ok(!logs.includes(secret),`log must not contain ${secret}`);
 // Inspect the produced message through a second send that returns the raw MIME.
 let raw='';mod.setSmtpFactory(()=>{const t=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});return {sendMail:async m=>{const info=await t.sendMail(m);raw=info.message.toString();return info;},close(){}};});
 await captureLogs(()=>mod.smtpSend(SMTP,mail));
 assert.match(raw,/^From: EstateMarket24 <noreply@estatemarket24\.com>$/m);assert.match(raw,/^Reply-To: info@estatemarket24\.com$/m);assert.match(raw,/^To: ayse@example\.com$/m);
 assert.match(raw,/^List-Unsubscribe: <https:\/\/s\/u>$/m);assert.match(raw,/^List-Unsubscribe-Post: List-Unsubscribe=One-Click$/m);
 assert.match(raw,/^Content-Type: multipart\/alternative;/m);assert.match(raw,/^Content-Type: text\/plain; charset=utf-8$/m);assert.match(raw,/^Content-Type: text\/html; charset=utf-8$/m);
 mod.setSmtpFactory(null);
});

test('SMTP failures return a reason and log only codes, never the password or the server text',async()=>{
 const mod=smtpNode();
 mod.setSmtpFactory(()=>({sendMail:async()=>{const e=new Error(`Invalid login: 535 Authentication failed for ${SMTP.SMTP_USER} with ${SMTP.SMTP_PASSWORD}`);e.code='EAUTH';e.responseCode=535;e.command='AUTH PLAIN';throw e;},close(){}}));
 const {result,logs}=await captureLogs(()=>mod.smtpSend(SMTP,{from:config.smtpFrom(SMTP),to:'a@example.com',subject:'s',html:'h',text:'t',headers:{}}));
 assert.deepEqual(result,{sent:false,reason:'smtp_auth'});
 assert.match(logs,/"code":"EAUTH"/);assert.match(logs,/"responseCode":535/);assert.match(logs,/"command":"AUTH"/);
 assert.ok(!logs.includes(SMTP.SMTP_PASSWORD));assert.ok(!logs.includes('Invalid login'));
 mod.setSmtpFactory(()=>({sendMail:async()=>{const e=new Error('connect');e.code='ETIMEDOUT';throw e;},close(){}}));
 assert.deepEqual((await captureLogs(()=>mod.smtpSend(SMTP,{from:config.smtpFrom(SMTP),to:'a@example.com',subject:'s',html:'h',text:'t',headers:{}}))).result,{sent:false,reason:'smtp_connection'});
 mod.setSmtpFactory(null);
 assert.deepEqual(await mod.smtpSend({...SMTP,SMTP_HOST:''},{from:config.smtpFrom(SMTP),to:'a@example.com',subject:'s',html:'h',text:'t',headers:{}}),{sent:false,reason:'not_configured'});
});

test('port 587 without STARTTLS: the real nodemailer transport refuses and never sends AUTH in plain text',async()=>{
 const commands=[];
 const server=net.createServer(socket=>{socket.write('220 sink ESMTP\r\n');let buffer='';socket.on('data',d=>{buffer+=d;let i;while((i=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+2);commands.push(line.split(' ')[0].toUpperCase());if(/^(EHLO|HELO)/i.test(line))socket.write('250-sink\r\n250 AUTH PLAIN LOGIN\r\n');else if(/^QUIT/i.test(line)){socket.end('221 bye\r\n');}else socket.write('502 no\r\n');}});socket.on('error',()=>{});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port,mod=smtpNode();
 const settings={...SMTP,SMTP_HOST:'127.0.0.1',SMTP_PORT:String(port)};
 assert.equal(config.smtpOptions(settings).requireTLS,true);
 try{
  const {result,logs}=await captureLogs(()=>mod.smtpSend(settings,{from:config.smtpFrom(settings),to:'a@example.com',subject:'s',html:'h',text:'t',headers:{}}));
  assert.equal(result.sent,false);assert.ok(!commands.includes('AUTH'),'no AUTH without TLS');assert.ok(!commands.includes('MAIL'));
  assert.ok(!logs.includes(SMTP.SMTP_PASSWORD));
 }finally{mod.setSmtpFactory(null);server.close();}
});

test('Cloudflare stand-in: no SMTP slot, nodemailer only behind the Node alias',()=>{
 assert.equal(load('lib/email-smtp.ts').smtpSend,null);
 assert.doesNotMatch(read('lib/email-smtp.ts'),/^import (?!type)/m);
 assert.match(read('next.config.ts'),/"@\/lib\/email-smtp":\s*"\.\/lib\/email-smtp-node\.ts"/);
 assert.match(read('lib/email.ts'),/from "@\/lib\/email-smtp"/);
 const files=dir=>readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]).filter(f=>/\.(ts|tsx)$/.test(f));
 const code=f=>read(f).replace(/\/\/.*$/gm,'');
 assert.deepEqual(['app','lib','components'].flatMap(files).filter(f=>/email-smtp-node|from "nodemailer"/.test(code(f))&&!f.endsWith('email-smtp-node.ts')),[]);
 // Client components import lib/contact.ts; it must not reach the transports.
 assert.doesNotMatch(read('lib/contact.ts'),/from "\.\/email"/);
});

// --- Admin reply API -------------------------------------------------------------------------
function sqliteDb(){const sql=new DatabaseSync(':memory:');return {sql,db:{prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}}};}
function routeHarness(file,{user,env,slot,origin='https://site.test'}={}){
 const {sql,db}=sqliteDb();const state={user,env:{SITE_URL:'https://site.test',...env}};
 const server={
  currentUser:async()=>state.user,isAdmin:u=>Boolean(u&&!u.admin_2fa_pending&&u.role==='admin'),
  sameOrigin:r=>{const o=r.headers.get('origin');return !o||o===origin;},
  error:(message,status=400)=>Response.json({error:message},{status}),ok:(data,init)=>Response.json(data,init),
  body:async r=>{const v=await r.json();if(!v||typeof v!=='object')throw Error('bad');return v;},
 };
 const sent=[];globalThis.__routeSmtp=sent;
 const smtpSlot={smtpSend:slot===null?null:async(settings,mail)=>{sent.push(mail);if(globalThis.__routeSmtpFail)return {sent:false,reason:'smtp_error'};return {sent:true,provider:'smtp',messageId:'<id@x>'};}};
 const runtime={get env(){return state.env;},waitUntil(){}};
 const overrides={'@/lib/server':server,'@/lib/runtime':runtime,'./runtime':runtime,'@/lib/contact-server':{contactDB:()=>db},'@/lib/email-smtp':smtpSlot};
 return {sql,db,state,sent,route:load(file,overrides),contact:load('lib/contact.ts',overrides)};
}
const admin={id:'admin-1',name:'Yönetici Bir',email:'admin@estatemarket24.com',email_verified:1,role:'admin'};
const post=(url,data,origin='https://site.test')=>new Request(url,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(data)});
const visitor={name:'Ayşe Yılmaz',email:'ayse@example.com',subject:'general',message:'Merhaba,\n<b>ilan</b> hakkında bilgi almak istiyorum.',consent:true,locale:'de'};

test('admin reply: same origin, admin with confirmed 2FA, configured e-mail and valid input required',async()=>{
 const h=routeHarness('app/api/admin/contact/reply/route.ts',{user:admin,env:SMTP});
 try{
  const saved=await h.contact.submitContact(h.db,visitor);
  const status=async(req)=>(await h.route.POST(req)).status;
  assert.equal(await status(post('https://site.test/api/admin/contact/reply',{id:saved.id,text:'Merhaba'},'https://evil.test')),403);
  h.state.user=null;assert.equal(await status(post('https://site.test/x',{id:saved.id,text:'Merhaba'})),403);
  h.state.user={...admin,role:'agent'};assert.equal(await status(post('https://site.test/x',{id:saved.id,text:'Merhaba'})),403);
  h.state.user={...admin,admin_2fa_pending:true};assert.equal(await status(post('https://site.test/x',{id:saved.id,text:'Merhaba'})),403);
  h.state.user={...admin,email_verified:0};assert.equal(await status(post('https://site.test/x',{id:saved.id,text:'Merhaba'})),403);
  h.state.user=admin;
  assert.equal(await status(post('https://site.test/x',{id:'nope',text:'Merhaba'})),400);
  const short=await h.route.POST(post('https://site.test/x',{id:saved.id,text:' a '}));assert.equal(short.status,400);assert.equal((await short.json()).error,'Yanıt metnini yazın.');
  assert.equal(await status(post('https://site.test/x',{id:saved.id,text:'x'.repeat(5001)})),400);
  assert.equal(await status(post('https://site.test/x',{id:crypto.randomUUID(),text:'Merhaba'})),404);
  assert.equal(h.sent.length,0);
  h.state.env={SITE_URL:'https://site.test'};
  const off=await h.route.POST(post('https://site.test/x',{id:saved.id,text:'Merhaba'}));assert.equal(off.status,503);assert.match((await off.json()).error,/yapılandırılmamış/);
 }finally{h.sql.close();}
});

test('admin reply: sent to the visitor with quoted original, stored with admin and time, message handled',async()=>{
 const h=routeHarness('app/api/admin/contact/reply/route.ts',{user:admin,env:{...SMTP,EMAIL_FROM:'EstateMarket24 <noreply@estatemarket24.com>'}});
 try{
  const saved=await h.contact.submitContact(h.db,visitor,null,new Date('2026-11-02T08:00:00Z'));
  const response=await h.route.POST(post('https://site.test/x',{id:saved.id,text:'Merhaba Ayşe,\r\nilan hâlâ satılık. <i>Teşekkürler</i>'}));
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  const {message}=await response.json();
  assert.equal(h.sent.length,1);const mail=h.sent[0];
  assert.equal(mail.to,'ayse@example.com');assert.equal(mail.subject,'Re: estatemarket24: Genel soru / General question');
  assert.equal(mail.replyTo,'info@estatemarket24.com');assert.deepEqual(mail.from,{name:'EstateMarket24',address:'noreply@estatemarket24.com'});
  assert.ok(mail.html.includes('ESTATEMARKET24'),'branded layout');assert.ok(mail.html.includes('&lt;i&gt;Teşekkürler'));assert.ok(!mail.html.includes('<i>'));assert.ok(mail.html.includes('&lt;b&gt;ilan&lt;/b&gt;'),'original quoted and escaped');
  assert.ok(mail.html.indexOf('Teşekkürler')<mail.html.indexOf('bilgi almak'),'reply above the quote');
  assert.match(mail.text,/^Merhaba Ayşe,\nilan hâlâ satılık/);assert.match(mail.text,/2026-11-02 08:00 UTC/);assert.match(mail.text,/^> Merhaba,$/m);assert.match(mail.text,/^> <b>ilan<\/b> hakkında/m);
  assert.equal(message.status,'handled');assert.equal(message.replies.length,1);assert.equal(message.replies[0].body,'Merhaba Ayşe,\nilan hâlâ satılık. <i>Teşekkürler</i>');assert.equal(message.replies[0].adminName,'Yönetici Bir');
  const row=h.sql.prepare('SELECT * FROM contact_replies').get();assert.equal(row.admin_id,'admin-1');assert.equal(row.provider,'smtp');assert.equal(row.provider_message_id,'<id@x>');assert.match(row.created_at,/^\d{4}-\d\d-\d\dT/);
  const msg=h.sql.prepare('SELECT status,handled_by FROM contact_messages WHERE id=?').get(saved.id);assert.deepEqual({...msg},{status:'handled',handled_by:'admin-1'});
  // The admin list shows the replies under the message.
  const list=await h.contact.adminContactMessages(h.db,'all');assert.equal(list.messages[0].replies[0].body,message.replies[0].body);
  // A failed send stores nothing.
  globalThis.__routeSmtpFail=true;
  try{const failed=await h.route.POST(post('https://site.test/x',{id:saved.id,text:'İkinci yanıt'}));assert.equal(failed.status,502);}finally{globalThis.__routeSmtpFail=false;}
  assert.equal(h.sql.prepare('SELECT COUNT(*) AS n FROM contact_replies').get().n,1);
 }finally{h.sql.close();}
});

test('admin reply: at most 30 replies per administrator per hour',async()=>{
 const h=routeHarness('app/api/admin/contact/reply/route.ts',{user:admin,env:SMTP});
 try{
  const saved=await h.contact.submitContact(h.db,visitor);const send=async()=>({sent:true,provider:'smtp'});
  const t0=new Date('2026-11-05T10:00:00Z');
  for(let i=0;i<30;i++)await h.contact.replyToContact(h.db,admin,{id:saved.id,text:'Yanıt '+i},send,'https://site.test',new Date(t0.getTime()+i*1000));
  await assert.rejects(h.contact.replyToContact(h.db,admin,{id:saved.id,text:'Bir tane daha'},send,'https://site.test',new Date(t0.getTime()+60000)),e=>e.status===429);
  await h.contact.replyToContact(h.db,{id:'admin-2'},{id:saved.id,text:'Başka yönetici'},send,'https://site.test',new Date(t0.getTime()+60000));
  await h.contact.replyToContact(h.db,admin,{id:saved.id,text:'Bir saat sonra'},send,'https://site.test',new Date(t0.getTime()+3601000));
  await assert.rejects(h.contact.replyToContact(h.db,admin,{id:saved.id,text:'Yok'},async()=>({sent:false,reason:'not_configured'}),'https://site.test',new Date(t0.getTime()+3602000)),e=>e.status===503);
 }finally{h.sql.close();}
});

test('admin test e-mail: admin only, to the admin\'s own address, rate limited, clear error when not configured',async()=>{
 const h=routeHarness('app/api/admin/email-test/route.ts',{user:admin,env:SMTP});
 try{
  h.state.user={...admin,role:'agent'};assert.equal((await h.route.POST(post('https://site.test/api/admin/email-test',{}))).status,403);assert.equal((await h.route.GET(new Request('https://site.test/api/admin/email-test'))).status,403);
  h.state.user=admin;
  assert.equal((await h.route.POST(post('https://site.test/x',{},'https://evil.test'))).status,403);
  assert.deepEqual(await (await h.route.GET(new Request('https://site.test/x'))).json(),{provider:'smtp',to:'admin@estatemarket24.com'});
  const ok=await h.route.POST(post('https://site.test/x',{}));assert.equal(ok.status,200);assert.deepEqual(await ok.json(),{sent:true,provider:'smtp',to:'admin@estatemarket24.com'});
  assert.equal(h.sent[0].to,'admin@estatemarket24.com');assert.match(h.sent[0].subject,/test/);assert.match(h.sent[0].text,/smtp/);
  for(let i=0;i<4;i++)assert.equal((await h.route.POST(post('https://site.test/x',{}))).status,200);
  assert.equal((await h.route.POST(post('https://site.test/x',{}))).status,429);
  h.state.env={SITE_URL:'https://site.test'};
  const off=await h.route.POST(post('https://site.test/x',{}));assert.equal(off.status,503);assert.equal((await off.json()).error,'E-posta gönderimi yapılandırılmamış.');
  assert.deepEqual(await (await h.route.GET(new Request('https://site.test/x'))).json(),{provider:null,to:'admin@estatemarket24.com'});
 }finally{h.sql.close();}
});
