import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import ts from 'typescript';
const transpile=p=>ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const link=(name,stubs)=>{let code=transpile(name);for(const [from,to] of Object.entries(stubs)){assert.ok(code.includes(from),from);code=code.replaceAll(from,JSON.stringify(to));}return url(code);};
const totpUrl=url(transpile('totp'));
const T=await import(totpUrl);
const A=await import(link('admin-totp',{'"./totp"':totpUrl}));
const P=await import(link('phone-verification',{'"./totp"':totpUrl,'"./phone"':url(transpile('phone'))}));
const S=await import(link('sms',{'"./runtime"':'data:text/javascript,'+encodeURIComponent('export const env={};')}));

function database(){
 const sql=new DatabaseSync(':memory:');
 const db={prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}};
 return {sql,db};
}
const KEY='k'.repeat(40),USER='11111111-1111-4111-8111-111111111111';

test('TOTP matches the RFC 6238 SHA-1 test vectors',async()=>{
 const secret=T.base32Encode(new TextEncoder().encode('12345678901234567890'));
 const vectors=[[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']];
 for(const [seconds,code] of vectors)assert.equal(await T.totp(secret,seconds*1000,8),code,String(seconds));
 assert.equal(await T.totp(secret,59000),'287082');
 assert.deepEqual(T.base32Decode(T.base32Encode(new Uint8Array([1,2,3,250]))),new Uint8Array([1,2,3,250]));
});

test('verifyTotp accepts one step of drift and rejects replays and malformed codes',async()=>{
 const secret=T.generateTotpSecret(),now=1_800_000_000_000,step=T.totpStep(now);
 const code=await T.totp(secret,now),previous=await T.totp(secret,now-30_000),old=await T.totp(secret,now-90_000);
 assert.equal(await T.verifyTotp(secret,code,now),step);
 assert.equal(await T.verifyTotp(secret,previous,now),step-1);
 assert.equal(await T.verifyTotp(secret,old,now),null);
 assert.equal(await T.verifyTotp(secret,code,now,step),null,'same step is a replay');
 assert.equal(await T.verifyTotp(secret,'12345',now),null);
 assert.match(T.otpauthUri(secret,'admin@example.com'),/^otpauth:\/\/totp\/estatemarket24%3Aadmin%40example\.com\?secret=[A-Z2-7]+&issuer=estatemarket24&algorithm=SHA1&digits=6&period=30$/);
});

test('secrets are encrypted with AES-GCM bound to the user',async()=>{
 const sealed=await T.encryptSecret('JBSWY3DPEHPK3PXP',KEY,'admin_totp:a');
 assert.match(sealed,/^v1\./);assert.ok(!sealed.includes('JBSWY3DPEHPK3PXP'));
 assert.notEqual(sealed,await T.encryptSecret('JBSWY3DPEHPK3PXP',KEY,'admin_totp:a'),'fresh IV each time');
 assert.equal(await T.decryptSecret(sealed,KEY,'admin_totp:a'),'JBSWY3DPEHPK3PXP');
 await assert.rejects(T.decryptSecret(sealed,'x'.repeat(40),'admin_totp:a'));
 await assert.rejects(T.decryptSecret(sealed,KEY,'admin_totp:b'),'cannot be moved to another user');
});

test('admin 2FA enrolment, login, replay, recovery codes, lockout and disable',async()=>{
 const {sql,db}=database();let now=1_800_000_000_000;
 assert.deepEqual(await A.twoFactorStatus(db,USER),{enabled:false,enabledAt:null,recoveryCodesLeft:0});
 const {secret,uri}=await A.startEnrolment(db,KEY,USER,'admin@example.com',now);
 assert.ok(uri.includes(secret));
 const stored=sql.prepare('SELECT secret_encrypted FROM admin_totp').get().secret_encrypted;assert.ok(!stored.includes(secret),'secret not stored in clear');
 await assert.rejects(A.confirmEnrolment(db,KEY,USER,'000000',now),e=>e instanceof A.TwoFactorError);
 const {recoveryCodes}=await A.confirmEnrolment(db,KEY,USER,await T.totp(secret,now),now);
 assert.equal(recoveryCodes.length,10);assert.ok(!sql.prepare('SELECT recovery_codes FROM admin_totp').get().recovery_codes.includes(recoveryCodes[0]));
 await assert.rejects(A.startEnrolment(db,KEY,USER,'admin@example.com',now),e=>e.status===409);
 // The code used to confirm enrolment cannot be replayed for login.
 await assert.rejects(A.verifySecondFactor(db,KEY,USER,await T.totp(secret,now),now),e=>e instanceof A.TwoFactorError);
 now+=30_000;const code=await T.totp(secret,now);
 assert.equal(await A.verifySecondFactor(db,KEY,USER,code,now),'totp');
 await assert.rejects(A.verifySecondFactor(db,KEY,USER,code,now),'replay rejected');
 assert.equal(await A.verifySecondFactor(db,KEY,USER,recoveryCodes[0].toLowerCase(),now),'recovery');
 await assert.rejects(A.verifySecondFactor(db,KEY,USER,recoveryCodes[0],now),'recovery code works once');
 assert.equal((await A.twoFactorStatus(db,USER)).recoveryCodesLeft,9);
 // Five failures lock the check, even for a correct code, until the window passes.
 sql.prepare('UPDATE admin_totp SET failed_attempts=0,failed_window_started_at=NULL').run();
 for(let i=0;i<5;i++)await assert.rejects(A.verifySecondFactor(db,KEY,USER,'000000',now),e=>e.status===400);
 now+=30_000;
 await assert.rejects(A.verifySecondFactor(db,KEY,USER,await T.totp(secret,now),now),e=>e.status===429);
 now+=16*60_000;
 const fresh=await A.regenerateRecoveryCodes(db,KEY,USER,await T.totp(secret,now),now);
 assert.equal(fresh.length,10);
 await assert.rejects(A.verifySecondFactor(db,KEY,USER,recoveryCodes[1],now+30_000),'old recovery codes invalid');
 now+=60_000;
 await A.disableTwoFactor(db,KEY,USER,fresh[0],now);
 assert.equal((await A.twoFactorStatus(db,USER)).enabled,false);
});

test('the 2FA cookie is bound to the session and gates pending admins',async()=>{
 const {db}=database(),now=1_800_000_000_000,factory=()=>db;
 const header=(await A.admin2faCookie(KEY,USER,'session-a',now)).split(';')[0];
 assert.match(header,/^em24_admin_2fa=\d+\.[0-9a-f]{64}$/);
 assert.equal(await A.validAdmin2faCookie(header,KEY,USER,'session-a',now),true);
 assert.equal(await A.validAdmin2faCookie(header,KEY,USER,'session-b',now),false,'other session');
 assert.equal(await A.validAdmin2faCookie(header,KEY,'other-user','session-a',now),false);
 assert.equal(await A.validAdmin2faCookie(header,KEY,USER,'session-a',now+13*3600_000),false,'expired');
 assert.equal(await A.admin2faPending(factory,USER,'session-a','',undefined,now),false,'no key: feature off');
 assert.equal(await A.admin2faPending(factory,USER,'session-a','',KEY,now),true,'not enrolled: 2FA is mandatory, enrolment comes first');
 const {secret}=await A.startEnrolment(db,KEY,USER,'a@example.com',now);
 assert.equal(await A.admin2faPending(factory,USER,'session-a','',KEY,now),true,'enrolment not confirmed yet');
 await A.confirmEnrolment(db,KEY,USER,await T.totp(secret,now),now);
 assert.equal(await A.admin2faPending(factory,USER,'session-a','',KEY,now),true);
 assert.equal(await A.admin2faPending(factory,USER,'session-a','x=1; '+header,KEY,now),false);
 assert.equal(await A.admin2faPending(()=>({prepare(){throw Error('down');}}),USER,'s','',KEY,now),true,'database errors fail closed');
});

test('phone verification: code flow, hashing, attempts and expiry',async()=>{
 const {sql,db}=database();let now=1_800_000_000_000;const sent=[];const send=async(to,text)=>{sent.push({to,text});};
 await assert.rejects(P.sendPhoneCode(db,{userId:USER,phone:'123',secret:'s'.repeat(20),send,nowMs:now}),e=>e instanceof P.PhoneVerificationError&&e.status===400);
 const result=await P.sendPhoneCode(db,{userId:USER,phone:'0532 123 45 67',secret:'s'.repeat(20),send,nowMs:now});
 assert.equal(result.phone,'+905321234567');assert.equal(sent[0].to,'+905321234567');
 const code=sent[0].text.match(/\b(\d{6})\b/)[1];
 assert.ok(!sql.prepare('SELECT code_hash FROM phone_verifications').get().code_hash.includes(code));
 await assert.rejects(P.verifyPhoneCode(db,{userId:USER,code:'12a',secret:'s'.repeat(20),nowMs:now}),/6 haneli/);
 const wrong=code==='000000'?'111111':'000000';
 await assert.rejects(P.verifyPhoneCode(db,{userId:USER,code:wrong,secret:'s'.repeat(20),nowMs:now}),/Kod hatalı/);
 assert.equal(await P.phoneVerified(db,USER,'+905321234567'),false);
 assert.equal(await P.verifyPhoneCode(db,{userId:USER,code,secret:'s'.repeat(20),nowMs:now+1000}),'+905321234567');
 assert.equal(await P.phoneVerified(db,USER,'+905321234567'),true);
 assert.equal(await P.phoneVerified(db,USER,'+905329999999'),false,'a changed phone is not verified');
 assert.deepEqual([...await P.verifiedPhoneUserIds(db,[{id:USER,phone:'+905321234567'},{id:'other',phone:'+905321234567'}])],[USER]);
 await assert.rejects(P.verifyPhoneCode(db,{userId:USER,code,secret:'s'.repeat(20),nowMs:now+2000}),e=>e.status===410,'used code');
 // Max 5 attempts per code.
 now+=61_000;await P.sendPhoneCode(db,{userId:USER,phone:'+905329999999',secret:'s'.repeat(20),send,nowMs:now});
 const second=sent.at(-1).text.match(/\b(\d{6})\b/)[1],bad=second==='000000'?'111111':'000000';
 for(let i=0;i<5;i++)await assert.rejects(P.verifyPhoneCode(db,{userId:USER,code:bad,secret:'s'.repeat(20),nowMs:now}),e=>e.status===400);
 await assert.rejects(P.verifyPhoneCode(db,{userId:USER,code:second,secret:'s'.repeat(20),nowMs:now}),e=>e.status===429);
 // Expiry after 10 minutes.
 now+=61_000;await P.sendPhoneCode(db,{userId:USER,phone:'+905329999999',secret:'s'.repeat(20),send,nowMs:now});
 const third=sent.at(-1).text.match(/\b(\d{6})\b/)[1];
 await assert.rejects(P.verifyPhoneCode(db,{userId:USER,code:third,secret:'s'.repeat(20),nowMs:now+10*60_000+1}),e=>e.status===410);
});

test('phone verification rate limits: cooldown, hourly, daily, per phone, failed sends',async()=>{
 const {db}=database();let now=1_800_000_000_000;const send=async()=>{};const secret='s'.repeat(20);
 const go=(phone='+905321234567',userId=USER,s=send)=>P.sendPhoneCode(db,{userId,phone,secret,send:s,nowMs:now});
 await go();
 await assert.rejects(go(),e=>e.status===429&&e.retryAfter===60,'60 s cooldown');
 now+=61_000;await go();now+=61_000;await go();now+=61_000;
 await assert.rejects(go(),/Bir saat/,'3 per hour');
 now+=3600_000;await go('+905320000001');now+=61_000;await go('+905320000002');now+=61_000;await go('+905320000003');
 now+=3600_000;await go('+905320000004');now+=61_000;await go('+905320000005');now+=61_000;await go('+905320000006');
 now+=3600_000;await go('+905320000007');now+=61_000;
 await assert.rejects(go('+905320000008'),/Bugün/,'10 per user per day');
 // Another user: 5 codes per phone per day (user 1 already sent 3 to +905321234567 today).
 const other='22222222-2222-4222-8222-222222222222';
 await go('+905321234567',other);now+=61_000;await go('+905321234567',other);now+=61_000;
 await assert.rejects(go('+905321234567',other),/Bu numaraya/,'5 per phone per day');
 const failing=async()=>{throw Error('provider down');};now+=61_000;
 await assert.rejects(go('+905339999999',other,failing),e=>e.status===502);
});

test('SMS providers send the documented request formats',async()=>{
 const calls=[];const fetcher=async(input,init)=>{calls.push({input,init});return Response.json(input.includes('netgsm')?{code:'00',jobid:'123'}:{sid:'SM1'},{status:input.includes('netgsm')?200:201});};
 assert.equal(S.smsProvider({},fetcher),null);
 assert.equal(S.smsProvider({SMS_PROVIDER:'netgsm',NETGSM_USERCODE:'8501234567'},fetcher),null,'incomplete config');
 const netgsm=S.smsProvider({SMS_PROVIDER:'netgsm',NETGSM_USERCODE:'8501234567',NETGSM_PASSWORD:'pw',NETGSM_HEADER:'EXXEL'},fetcher);
 await netgsm.send('+905321234567','Kod 123456');
 assert.equal(calls[0].input,'https://api.netgsm.com.tr/sms/rest/v2/send');
 assert.equal(calls[0].init.headers.Authorization,'Basic '+btoa('8501234567:pw'));
 assert.deepEqual(JSON.parse(calls[0].init.body),{msgheader:'EXXEL',encoding:'TR',iysfilter:'0',messages:[{msg:'Kod 123456',no:'905321234567'}]});
 const twilio=S.smsProvider({SMS_PROVIDER:'twilio',TWILIO_ACCOUNT_SID:'AC'+'a'.repeat(32),TWILIO_AUTH_TOKEN:'tok',TWILIO_FROM:'+15550001111'},fetcher);
 await twilio.send('+905321234567','Kod 123456');
 assert.equal(calls[1].input,`https://api.twilio.com/2010-04-01/Accounts/AC${'a'.repeat(32)}/Messages.json`);
 assert.equal(new URLSearchParams(calls[1].init.body).get('To'),'+905321234567');
 assert.equal(new URLSearchParams(calls[1].init.body).get('From'),'+15550001111');
 const failing=S.smsProvider({SMS_PROVIDER:'netgsm',NETGSM_USERCODE:'u',NETGSM_PASSWORD:'p',NETGSM_HEADER:'H'},async()=>Response.json({code:'30'}));
 await assert.rejects(failing.send('+905321234567','x'),/Netgsm error 30/);
 assert.equal(S.smsReady(),false,'no provider configured');
});
