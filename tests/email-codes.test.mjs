// Own e-mail code system (docs/auth.md): codes on SQLite (same SQL as PostgreSQL), the code e-mail in
// several languages, the recovery route (enumeration-safe send, password reset, e-mail verification)
// with a captured transport, Google sign-in behind the Mittwald proxy, and that Neon Auth is gone.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),nativeRequire=createRequire(import.meta.url);
function load(file,overrides={}){const full=path.resolve(root,file),module={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(overrides[name])return overrides[name];if(name.startsWith('.')||name.startsWith('@/')){const resolved=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return load(resolved+'.ts',overrides);}return nativeRequire(name);},module,module.exports);return module.exports;}
const read=file=>readFileSync(path.join(root,file),'utf8');
const C=load('lib/email-codes.ts'),M=load('lib/auth-email.ts');
const SECRET='test-secret-0123456789abcdef';

function database(){
 const sql=new DatabaseSync(':memory:');
 const wrap=q=>{let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)},_exec(){return sql.prepare(q).run(...values)}};};
 const db={prepare:wrap,async batch(list){sql.exec('BEGIN');try{for(const s of list)s._exec();sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}}};
 return {sql,db};
}
const T0=Date.parse('2026-11-09T10:00:00Z');
const issue=(db,extra={})=>C.issueEmailCode(db,{email:'Ayse@Example.com ',purpose:'reset',userId:'u1',secret:SECRET,nowMs:T0,...extra});
const consume=(db,code,extra={})=>C.consumeEmailCode(db,{email:'ayse@example.com',purpose:'reset',code,secret:SECRET,nowMs:T0+1000,...extra});
const wrong=code=>code==='000000'?'111111':'000000';

test('codes are 6 random digits, stored only as an HMAC, valid once and only for their purpose',async()=>{
 const {sql,db}=database();
 const {code,expiresAt}=await issue(db);
 assert.match(code,/^\d{6}$/);assert.equal(expiresAt,new Date(T0+15*60000).toISOString());
 const row=sql.prepare('SELECT * FROM email_codes').get();
 assert.equal(row.email,'ayse@example.com');assert.equal(row.purpose,'reset');assert.equal(row.user_id,'u1');assert.equal(row.attempts,0);assert.equal(row.consumed_at,null);
 assert.match(row.code_hash,/^[0-9a-f]{64}$/);
 for(const [column,value] of Object.entries(row))if(column!=='id'&&column!=='code_hash')assert.ok(!String(value).includes(code),'plaintext code stored in '+column);
 assert.notEqual(row.code_hash,code);assert.ok(!Object.values(row).includes(code));
 await assert.rejects(consume(db,code,{purpose:'verify'}),e=>e instanceof C.EmailCodeError&&e.message===C.INVALID_CODE,'a reset code does not verify an e-mail');
 await assert.rejects(consume(db,code,{secret:'another-secret-0123456789'}),e=>e.message===C.INVALID_CODE,'a different server secret does not match');
 assert.deepEqual(await consume(db,code),{userId:'u1'});
 await assert.rejects(consume(db,code),e=>e.message===C.INVALID_CODE,'single use');
 await assert.rejects(consume(db,'12a456'),e=>e.status===400&&/6 haneli/.test(e.message));
 assert.equal(new Set(Array.from({length:200},()=>C.generateEmailCode())).size>150,true);
});

test('codes expire after 15 minutes',async()=>{
 const {db}=database();const {code}=await issue(db);
 await assert.rejects(consume(db,code,{nowMs:T0+15*60000}),e=>e.message===C.INVALID_CODE);
 const again=database();const fresh=await issue(again.db);assert.deepEqual(await consume(again.db,fresh.code,{nowMs:T0+15*60000-1}),{userId:'u1'});
});

test('five wrong attempts invalidate the code, even for the right one afterwards',async()=>{
 const {sql,db}=database();const {code}=await issue(db);
 for(let i=1;i<=4;i++)await assert.rejects(consume(db,wrong(code)),e=>e.status===400&&e.message===C.INVALID_CODE);
 await assert.rejects(consume(db,wrong(code)),e=>e.status===429&&e.message===C.TOO_MANY_ATTEMPTS);
 await assert.rejects(consume(db,code),e=>e.message===C.INVALID_CODE);
 assert.equal(sql.prepare('SELECT attempts FROM email_codes').get().attempts,5);
 // Parallel guesses cannot exceed the limit either.
 const other=database();const fresh=await issue(other.db);
 const results=await Promise.allSettled(Array.from({length:10},()=>consume(other.db,wrong(fresh.code))));
 assert.equal(results.filter(r=>r.status==='rejected').length,10);
 assert.ok(other.sql.prepare('SELECT attempts FROM email_codes').get().attempts<=5);
});

test('60 s resend cooldown; a new code invalidates the older one; purposes and addresses are separate',async()=>{
 const {db}=database();const first=await issue(db);
 await assert.rejects(issue(db,{nowMs:T0+30_000}),e=>e.status===429&&e.retryAfter===30);
 await issue(db,{purpose:'verify',nowMs:T0+30_000});await issue(db,{email:'other@example.com',nowMs:T0+30_000});
 const second=await issue(db,{nowMs:T0+60_000});
 await assert.rejects(consume(db,first.code,{nowMs:T0+61_000}),e=>e.message===C.INVALID_CODE);
 assert.deepEqual(await consume(db,second.code,{nowMs:T0+61_000}),{userId:'u1'});
 await C.revokeEmailCode(db,(await issue(db,{nowMs:T0+200_000})).id,T0+200_000);
});

test('the code e-mail is branded, localised (tr default, RTL for Arabic) and carries no link',()=>{
 const tr=M.authCodeEmail('reset','042917','xx');
 assert.equal(tr.subject,'EstateMarket24 şifre sıfırlama kodunuz');
 assert.match(tr.html,/ESTATEMARKET24/);assert.match(tr.html,/042917/);assert.match(tr.html,/font-size:34px/);
 assert.match(tr.html,/15 dakika/);assert.match(tr.html,/Bu işlemi siz yapmadıysanız bu e-postayı yok sayın\./);assert.match(tr.html,/Your password reset code/);
 assert.doesNotMatch(tr.html,/href=/);assert.match(tr.text,/042917/);
 const de=M.authCodeEmail('verify','123456','de');
 assert.equal(de.subject,'Ihr EstateMarket24-Bestätigungscode');assert.match(de.html,/15 Minuten gültig/);assert.match(de.html,/lang="de" dir="ltr"/);assert.doesNotMatch(de.html,/Kod 15 dakika/);
 const ar=M.authCodeEmail('verify','123456','ar');assert.match(ar.html,/dir="rtl"/);assert.match(ar.subject,/EstateMarket24/);
 const words=load('lib/auth-email-translations.ts').authEmailWords;
 for(const [key,row] of Object.entries(words))for(const locale of ['de','fr','en','ar','fa','ru','nl'])assert.ok(row[locale]?.trim(),locale+': '+key);
 assert.throws(()=>M.authCodeEmail('verify','<b>','tr'));
});

// ---- Recovery route with a captured e-mail transport ----
const sha=async value=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');
function routeFixture({ready=true}={}){
 const {sql,db}=database();
 sql.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE,password_hash TEXT,email_verified INTEGER,name TEXT,role TEXT,agent_status TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);CREATE TABLE auth_limits(key TEXT PRIMARY KEY,failures INTEGER,window_started_at TEXT);
  INSERT INTO users VALUES('u1','ayse@example.com','pbkdf2$100000$old$hash',0,'Ayşe','buyer','none');INSERT INTO users VALUES('u2','mehmet@example.com','pbkdf2$100000$keep$hash',1,'Mehmet','agent','approved');
  INSERT INTO sessions VALUES('s-ayse-1','u1','2099-01-01T00:00:00Z');INSERT INTO sessions VALUES('s-ayse-2','u1','2099-01-01T00:00:00Z');INSERT INTO sessions VALUES('s-mehmet','u2','2099-01-01T00:00:00Z');`);
 const mails=[],pending=[],logs=[];
 const server={
  db:()=>db,now:()=>new Date().toISOString(),sameOrigin:()=>true,clientIp:()=>'203.0.113.9',sha256:sha,
  error:(message,status=400)=>Response.json({error:message},{status}),ok:(data,init)=>Response.json(data,init),
  body:async request=>request.json(),passwordHash:async password=>'pbkdf2$100000$new$'+(await sha('pw:'+password)),
  sessionCookie:(token,clear=false)=>`excell_session=${clear?'':token}; ${clear?'Max-Age=0':'Max-Age=2592000'}`,
  currentUser:async request=>{const token=(request.headers.get('cookie')||'').match(/excell_session=([^;]+)/)?.[1];return token?sql.prepare('SELECT u.id,u.email,u.email_verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').get(token)||null:null;},
 };
 const codesServer={authCodeSecret:()=>ready?SECRET:null,emailCodeDB:()=>db,emailCodesReady:()=>ready,sendCodeEmail:async(to,purpose,code,locale)=>{mails.push({to,purpose,code,locale,...M.authCodeEmail(purpose,code,locale)});}};
 const route=load('app/api/account/recovery/route.ts',{'@/lib/runtime':{waitUntil:p=>pending.push(p)},'@/lib/server':server,'@/lib/email-codes-server':codesServer});
 const post=async(json,cookie)=>{const r=await route.POST(new Request('https://p-r9al26.project.space/api/account/recovery',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie:'excell_session='+cookie}:{})},body:JSON.stringify(json)}));await Promise.all(pending.splice(0));return {status:r.status,data:await r.json(),headers:r.headers};};
 return {sql,db,route,post,mails,logs};
}

test('reset send answers the same for existing and unknown addresses; only real accounts get a mail',async()=>{
 const f=routeFixture();
 const known=await f.post({action:'send',purpose:'reset',email:'AYSE@example.com',locale:'de'});
 const unknown=await f.post({action:'send',purpose:'reset',email:'nobody@example.com',locale:'de'});
 assert.equal(known.status,200);assert.deepEqual(known.data,unknown.data);assert.equal(unknown.status,200);
 assert.equal(f.mails.length,1);assert.equal(f.mails[0].to,'ayse@example.com');assert.equal(f.mails[0].locale,'de');assert.match(f.mails[0].subject,/Passwort/);
 // A resend inside the cooldown is silently skipped, so it also looks the same.
 const again=await f.post({action:'send',purpose:'reset',email:'ayse@example.com'});assert.equal(again.status,200);assert.deepEqual(again.data,known.data);assert.equal(f.mails.length,1);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM email_codes').get().n,1);
 // The per-e-mail limit (3 sends / 15 min) applies to unknown addresses too.
 await f.post({action:'send',purpose:'reset',email:'nobody@example.com'});await f.post({action:'send',purpose:'reset',email:'nobody@example.com'});
 assert.equal((await f.post({action:'send',purpose:'reset',email:'nobody@example.com'})).status,429);
 // Unknown address with a guessed code: the same "invalid code" answer.
 const guess=await f.post({action:'confirm',purpose:'reset',email:'nobody@example.com',otp:'123456',password:'NewPassword-2026',passwordConfirmation:'NewPassword-2026'});
 assert.equal(guess.status,400);assert.equal(guess.data.error,C.INVALID_CODE);
});

test('password reset sets a new hash, verifies the e-mail and closes every session of that account only',async()=>{
 const f=routeFixture();await f.post({action:'send',purpose:'reset',email:'ayse@example.com'});const code=f.mails[0].code;
 const mismatch=await f.post({action:'confirm',purpose:'reset',email:'ayse@example.com',otp:code,password:'NewPassword-2026',passwordConfirmation:'Other-2026-xx'});
 assert.equal(mismatch.status,400);assert.match(mismatch.data.error,/10 karakter/);
 assert.equal((await f.post({action:'confirm',purpose:'reset',email:'ayse@example.com',otp:code,password:'short',passwordConfirmation:'short'})).status,400);
 const done=await f.post({action:'confirm',purpose:'reset',email:'ayse@example.com',otp:code,password:'NewPassword-2026',passwordConfirmation:'NewPassword-2026'});
 assert.equal(done.status,200);assert.match(done.data.message,/Şifreniz yenilendi/);assert.match(done.headers.get('set-cookie'),/Max-Age=0/);
 const user=f.sql.prepare("SELECT password_hash,email_verified FROM users WHERE id='u1'").get();
 assert.equal(user.password_hash,'pbkdf2$100000$new$'+await sha('pw:NewPassword-2026'));assert.equal(user.email_verified,1);
 assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id='u1'").get().n,0);
 assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id='u2'").get().n,1);
 assert.equal(f.sql.prepare("SELECT password_hash FROM users WHERE id='u2'").get().password_hash,'pbkdf2$100000$keep$hash');
 const reuse=await f.post({action:'confirm',purpose:'reset',email:'ayse@example.com',otp:code,password:'Another-2026-pw',passwordConfirmation:'Another-2026-pw'});
 assert.equal(reuse.status,400);
});

test('e-mail verification needs the signed-in owner and sets email_verified',async()=>{
 const f=routeFixture();
 assert.equal((await f.post({action:'send',purpose:'verify'})).status,401);
 const sent=await f.post({action:'send',purpose:'verify',email:'mehmet@example.com',locale:'fr'},'s-ayse-1');
 assert.equal(sent.status,200);assert.equal(f.mails.length,1);assert.equal(f.mails[0].to,'ayse@example.com','the session e-mail is used, not the posted one');assert.equal(f.mails[0].purpose,'verify');
 const cooldown=await f.post({action:'send',purpose:'verify'},'s-ayse-1');assert.equal(cooldown.status,429);assert.ok(cooldown.data.retryAfter>0);
 assert.equal((await f.post({action:'confirm',purpose:'verify',otp:wrong(f.mails[0].code)},'s-ayse-1')).status,400);
 const ok=await f.post({action:'confirm',purpose:'verify',otp:f.mails[0].code},'s-ayse-1');
 assert.equal(ok.status,200);assert.equal(f.sql.prepare("SELECT email_verified FROM users WHERE id='u1'").get().email_verified,1);
 assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id='u1'").get().n,2,'verification keeps the sessions');
 // Already verified: nothing is sent.
 assert.equal((await f.post({action:'send',purpose:'verify'},'s-mehmet')).status,200);assert.equal(f.mails.length,1);
});

test('without a transport or secret the service reports itself unavailable',async()=>{
 const f=routeFixture({ready:false});
 assert.deepEqual(await (await f.route.GET()).json(),{enabled:false});
 assert.equal((await f.post({action:'send',purpose:'reset',email:'ayse@example.com'})).status,503);
 assert.deepEqual(await (await routeFixture().route.GET()).json(),{enabled:true});
});

test('the code secret prefers EMAIL_CODE_SECRET, falls back to DATABASE_URL, and phone codes share it',()=>{
 const S=load('lib/email-codes-server.ts',{'./runtime':{env:{}},'./server':{db:()=>null},'./email':{emailReady:()=>false,sendEmail:async()=>({sent:false,reason:'x'})}});
 assert.equal(S.authCodeSecret({EMAIL_CODE_SECRET:'x'.repeat(32),DATABASE_URL:'postgres://u:p@postgres/db'}),'x'.repeat(32));
 assert.match(S.authCodeSecret({EMAIL_CODE_SECRET:'short',DATABASE_URL:'postgres://u:p@postgres/db'}),/^derived-from-database-url:/);
 assert.equal(S.authCodeSecret({}),null);
 const source=read('lib/phone-verification-server.ts');assert.match(source,/PHONE_CODE_SECRET/);assert.match(source,/authCodeSecret\(settings\)/);
});

test('no plaintext code is logged by the code paths',()=>{
 for(const file of ['lib/email-codes.ts','lib/email-codes-server.ts','lib/auth-email.ts','app/api/account/recovery/route.ts'])assert.doesNotMatch(read(file),/console\./,file);
});

// ---- Google sign-in behind the Mittwald proxy ----
function googleFixture(){
 const {sql,db}=database();
 sql.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE,password_hash TEXT,email_verified INTEGER,name TEXT,role TEXT,agent_status TEXT,company TEXT,avatar_url TEXT,created_at TEXT);CREATE TABLE oauth_accounts(provider TEXT,provider_user_id TEXT,user_id TEXT,created_at TEXT,PRIMARY KEY(provider,provider_user_id),UNIQUE(user_id,provider));CREATE TABLE oauth_flows(state_hash TEXT PRIMARY KEY,code_verifier TEXT,role TEXT,next_path TEXT,link_user_id TEXT,expires_at TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);
  INSERT INTO users VALUES('u-verified','ayse@example.com','pbkdf2$100000$keep$hash',1,'Ayşe','agent','approved','Ofis',NULL,'2026-01-01');INSERT INTO users VALUES('u-unverified','new@example.com','pbkdf2$100000$x$y',0,'Yeni','buyer','none',NULL,NULL,'2026-01-01');`);
 const env={GOOGLE_CLIENT_ID:'client-id',GOOGLE_CLIENT_SECRET:'client-secret',GOOGLE_REDIRECT_URI:'https://p-r9al26.project.space/api/auth/callback/google'};
 const realServer=load('lib/server.ts',{'./runtime':{env},'./d1-publication':{},'./listing-policy':{},'./price-history':{},'./listing-location':{},'./listings':{PUBLIC_DEMO_LISTINGS:[]},'./neon-d1':{},'./pg-d1':{},'@/lib/postgres-driver':{},'./private-bucket':{},'./admin-totp':{}});
 const server={...realServer,db:()=>db,currentUser:async()=>null,createSession:async userId=>{const token='tok-'+userId;sql.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await sha(token),userId,'2099-01-01');return token;}};
 const auth=load('lib/google-auth.ts',{'./runtime':{env}});
 const start=load('app/api/auth/google/route.ts',{'@/lib/server':server,'@/lib/google-auth':auth});
 const callback=load('app/api/auth/callback/google/route.ts',{'@/lib/server':server,'@/lib/google-auth':auth});
 const proxied=(pathAndQuery,headers={})=>new Request('http://site:3000'+pathAndQuery,{headers:{'x-forwarded-proto':'https','x-forwarded-host':'p-r9al26.project.space',...headers}});
 return {sql,start,callback,proxied};
}
async function runGoogle(f,profile){
 const begin=await f.start.GET(f.proxied('/api/auth/google?role=buyer&next=%2Fhesabim'));
 assert.equal(begin.status,302);const location=new URL(begin.headers.get('location'));
 assert.equal(location.origin,'https://accounts.google.com');assert.equal(location.searchParams.get('redirect_uri'),'https://p-r9al26.project.space/api/auth/callback/google');assert.equal(location.searchParams.get('scope'),'openid email profile');
 const state=location.searchParams.get('state');
 const realFetch=globalThis.fetch;globalThis.fetch=async url=>String(url).includes('token')?Response.json({access_token:'at'}):Response.json(profile);
 try{return await f.callback.GET(f.proxied('/api/auth/callback/google?code=abc&state='+state,{cookie:'exxel_google_flow='+state}));}finally{globalThis.fetch=realFetch;}
}

test('Google status and redirects use the public origin behind the proxy, not request.url',async()=>{
 const f=googleFixture();
 assert.deepEqual(await (await f.start.GET(f.proxied('/api/auth/google?status=1'))).json(),{enabled:true});
 assert.deepEqual(await (await f.start.GET(new Request('http://site:3000/api/auth/google?status=1'))).json(),{enabled:false});
 const bad=await f.callback.GET(f.proxied('/api/auth/callback/google?code=x&state=y'));
 assert.equal(bad.headers.get('location'),'https://p-r9al26.project.space/giris?google=invalid');
});

test('Google links a verified local account with the same e-mail, never an unverified one',async()=>{
 const f=googleFixture();
 const linked=await runGoogle(f,{sub:'g-1',email:'Ayse@Example.com',email_verified:true,name:'A',picture:'https://lh3.googleusercontent.com/a'});
 assert.equal(linked.headers.get('location'),'https://p-r9al26.project.space/hesabim');
 assert.equal(f.sql.prepare("SELECT user_id FROM oauth_accounts WHERE provider='google' AND provider_user_id='g-1'").get().user_id,'u-verified');
 const user=f.sql.prepare("SELECT password_hash,role,agent_status,avatar_url FROM users WHERE id='u-verified'").get();
 assert.equal(user.password_hash,'pbkdf2$100000$keep$hash');assert.equal(user.role,'agent');assert.equal(user.agent_status,'approved');assert.equal(user.avatar_url,'https://lh3.googleusercontent.com/a');
 assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id='u-verified'").get().n,1);
 const refused=await runGoogle(f,{sub:'g-2',email:'new@example.com',email_verified:true});
 assert.equal(refused.headers.get('location'),'https://p-r9al26.project.space/giris?google=unverified');
 assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM oauth_accounts WHERE provider_user_id='g-2'").get().n,0);
 const unverifiedGoogle=await runGoogle(f,{sub:'g-3',email:'ayse@example.com',email_verified:false});
 assert.match(unverifiedGoogle.headers.get('location'),/google=identity/);
 const created=await runGoogle(f,{sub:'g-4',email:'fresh@example.com',email_verified:true,name:'Fresh'});
 assert.equal(created.status,302);assert.equal(f.sql.prepare("SELECT password_hash,email_verified FROM users WHERE email='fresh@example.com'").get().password_hash,'google-only');
});

test('Neon Auth is gone from the code, the dependencies and the configuration',()=>{
 for(const file of ['lib/neon-mail-auth.ts','lib/neon-identities.ts'])assert.equal(existsSync(path.join(root,file)),false,file);
 const pkg=JSON.parse(read('package.json'));assert.equal(pkg.dependencies['@neondatabase/auth'],undefined);assert.ok(pkg.dependencies['@neondatabase/serverless'],'the Neon driver stays');
 const walk=dir=>readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
 for(const file of [...walk('app'),...walk('components'),...walk('lib'),...walk('build'),'wrangler.jsonc','.env.example','proxy.ts','next.config.ts'].filter(f=>/\.(tsx?|jsonc|example)$/.test(f)))
  assert.doesNotMatch(read(file),/neon-mail-auth|neon-identities|@neondatabase\/auth|NEON_AUTH_|neonMailAuth|linkNeonAccount/,file);
});
