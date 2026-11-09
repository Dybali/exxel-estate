import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import ts from 'typescript';
const opts={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022};
const transpile=p=>ts.transpile(readFileSync(new URL('../'+p,import.meta.url),'utf8'),opts);
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
let code=transpile('lib/feedback.ts');
assert.ok(!code.includes('"./email"')&&!code.includes('"./server"'),'lib/feedback.ts must not import server-only modules (client components use it)');
code=code.replace('"./email-layout"',JSON.stringify(url(transpile('lib/email-layout.ts')))).replace('"./recovery-service"',JSON.stringify(url(transpile('lib/recovery-service.ts'))));
const F=await import(url(code));

function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE auth_limits(key TEXT PRIMARY KEY,failures INTEGER NOT NULL DEFAULT 0,window_started_at TEXT NOT NULL);CREATE TABLE admin_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,actor_name TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT NOT NULL,summary TEXT NOT NULL,created_at TEXT NOT NULL);");
 const db={prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}};
 return {sql,db};
}
const valid=(extra={})=>({kind:'idea',topic:'search',message:'  Harita aramasına okul filtresi eklenebilir mi?  ',rating:4,source:'widget',path:'/ilanlar?city=Antalya&q=secret#top',locale:'de',viewport:'mobile',fillMs:6000,website:'',...extra});
const ctx=(extra={})=>({ipHash:'a'.repeat(64),user:null,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',...extra});
const rejects=(promise,status,pattern)=>assert.rejects(promise,e=>e instanceof F.FeedbackError&&e.status===status&&(!pattern||pattern.test(e.message)));
const NOW=new Date('2026-11-09T10:00:00Z');

test('validation rejects bad input and normalises the rest',async()=>{
 const {sql,db}=fixture();try{
  await rejects(F.submitFeedback(db,valid({kind:'spam'}),ctx(),NOW),400,/türünü/);
  await rejects(F.submitFeedback(db,valid({kind:'__proto__'}),ctx(),NOW),400,/türünü/);
  await rejects(F.submitFeedback(db,valid({topic:'x'}),ctx(),NOW),400,/konu/);
  await rejects(F.submitFeedback(db,valid({message:'kısa'}),ctx(),NOW),400,/en az 10/);
  await rejects(F.submitFeedback(db,valid({message:'x'.repeat(2001)}),ctx(),NOW),400,/2000/);
  for(const rating of [0,6,2.5,'abc'])await rejects(F.submitFeedback(db,valid({rating}),ctx(),NOW),400,/1 ile 5/);
  await rejects(F.submitFeedback(db,valid({reply:true,email:'bad@'}),ctx(),NOW),400,/e-posta/);
  await rejects(F.submitFeedback(db,valid({reply:true,email:'a@example.com',consent:'true'}),ctx(),NOW),400,/onaylayın/);
  const saved=await F.submitFeedback(db,valid({reply:true,email:' Ayse@Example.COM ',consent:true,rating:'',locale:'xx',viewport:'tv',source:'evil'}),ctx(),NOW);
  assert.equal(saved.message,'Harita aramasına okul filtresi eklenebilir mi?');assert.equal(saved.email,'ayse@example.com');assert.equal(saved.rating,null);
  assert.equal(saved.locale,'tr');assert.equal(saved.viewport,'unknown');assert.equal(saved.source,'widget');assert.equal(saved.pagePath,'/ilanlar');assert.equal(saved.status,'new');
  // Without reply the e-mail is never stored, even when the field was filled.
  const anon=await F.submitFeedback(db,valid({email:'x@example.com'}),ctx(),NOW);assert.equal(anon.email,null);
  assert.equal(F.feedbackPath('//evil.example/x'),'/');assert.equal(F.feedbackPath('https://x.test/a'),'/');
 }finally{sql.close()}
});

test('honeypot is accepted silently; too-fast forms are rejected; neither is stored',async()=>{
 const {sql,db}=fixture();try{
  assert.equal(await F.submitFeedback(db,valid({website:'https://spam.example'}),ctx(),NOW),null);
  await rejects(F.submitFeedback(db,valid({fillMs:800}),ctx(),NOW),400,/hızlı/);
  await rejects(F.submitFeedback(db,valid({fillMs:undefined}),ctx(),NOW),400,/hızlı/);
  const count=sql.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='site_feedback'").get().n?sql.prepare('SELECT COUNT(*) AS n FROM site_feedback').get().n:0;
  assert.equal(count,0);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM auth_limits').get().n,0);
 }finally{sql.close()}
});

test('rate limits: 5 an hour and 20 a day per IP hash and per member',async()=>{
 const {sql,db}=fixture();try{
  const at=m=>new Date(NOW.getTime()+m*60000);
  for(let i=0;i<5;i++)await F.submitFeedback(db,valid(),ctx(),at(i));
  await rejects(F.submitFeedback(db,valid(),ctx(),at(10)),429,/çok fazla/);
  // Another IP is unaffected; after the hour window the first IP may send again.
  await F.submitFeedback(db,valid(),ctx({ipHash:'b'.repeat(64)}),at(11));
  await F.submitFeedback(db,valid(),ctx(),at(61));
  // Daily cap: spread over hours, the 21st in 24 hours is refused.
  const {sql:s2,db:d2}=fixture();try{
   for(let i=0;i<20;i++)await F.submitFeedback(d2,valid(),ctx(),at(i*61));
   await rejects(F.submitFeedback(d2,valid(),ctx(),at(20*61)),429);
  }finally{s2.close()}
  // A member is limited across IP addresses too.
  const {sql:s3,db:d3}=fixture();try{
   const user={id:'user-1',email:'m@example.com',role:'agent'};
   for(let i=0;i<5;i++)await F.submitFeedback(d3,valid(),ctx({ipHash:String(i).repeat(64),user}),at(i));
   await rejects(F.submitFeedback(d3,valid(),ctx({ipHash:'z'.repeat(64),user}),at(6)),429);
  }finally{s3.close()}
 }finally{sql.close()}
});

test('stored context: path, locale, viewport, UA family, member id and role; no raw IP or full UA',async()=>{
 const {sql,db}=fixture();try{
  const ip='203.0.113.7';
  const saved=await F.submitFeedback(db,valid({reply:true,email:'spoof@example.com',consent:true,source:'panel'}),ctx({ipHash:'f'.repeat(64),user:{id:'u-9',email:'owner@example.com',role:'company'}}),NOW);
  const row=sql.prepare('SELECT * FROM site_feedback WHERE id=?').get(saved.id);
  assert.equal(row.page_path,'/ilanlar');assert.equal(row.locale,'de');assert.equal(row.viewport,'mobile');assert.equal(row.user_agent,'Safari · iOS');
  assert.equal(row.user_id,'u-9');assert.equal(row.role,'company');assert.equal(row.source,'panel');assert.equal(row.created_at,NOW.toISOString());
  // A logged-in member's account address replaces whatever the form sent.
  assert.equal(row.email,'owner@example.com');
  const everything=JSON.stringify(sql.prepare('SELECT * FROM site_feedback').all())+JSON.stringify(sql.prepare('SELECT * FROM auth_limits').all());
  assert.ok(!everything.includes(ip)&&!everything.includes('Mozilla'));
  assert.equal(F.userAgentFamily('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0'),'Edge · Windows');
  assert.equal(F.userAgentFamily('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'),'Chrome · Android');
  assert.equal(F.userAgentFamily('Googlebot/2.1'),'bot');assert.equal(F.userAgentFamily(null),'other');
 }finally{sql.close()}
});

test('role is derived on the server from agencies and service firms',async()=>{
 const {sql,db}=fixture();try{
  assert.equal(await F.feedbackRole(db,{id:'a1',role:'agent'}),'agent');// tables missing: no error
  assert.equal(await F.feedbackRole(db,{id:'u1',role:'user'}),'member');
  sql.exec("CREATE TABLE agencies(owner_id TEXT,category TEXT);INSERT INTO agencies VALUES('d1','developer'),('a1','agency');CREATE TABLE service_firms(id TEXT,owner_id TEXT);INSERT INTO service_firms VALUES('s','u2');");
  assert.equal(await F.feedbackRole(db,{id:'d1',role:'agent'}),'company');assert.equal(await F.feedbackRole(db,{id:'a1',role:'agent'}),'agent');
  assert.equal(await F.feedbackRole(db,{id:'u2',role:'user'}),'service');assert.equal(await F.feedbackRole(db,{id:'i1',role:'individual'}),'individual');
  assert.equal(await F.feedbackRole(db,{id:'x',role:'user'},true),'admin');
 }finally{sql.close()}
});

test('admin list filters, searches and paginates; status changes and notes are audited',async()=>{
 const {sql,db}=fixture();try{
  const items=[];
  for(let i=0;i<25;i++)items.push(await F.submitFeedback(db,valid({kind:i%2?'bug':'idea',topic:i<3?'payments':'search',message:`Mesaj numarası ${i} 100%_test`,reply:i===0,email:'r@example.com',consent:true}),ctx({ipHash:String(i).padStart(64,'0')}),new Date(NOW.getTime()+i*1000)));
  let list=await F.adminFeedbackList(db,{});assert.equal(list.total,25);assert.equal(list.items.length,20);assert.equal(list.items[0].id,items[24].id);assert.equal(list.newCount,25);
  list=await F.adminFeedbackList(db,{page:'2'});assert.equal(list.items.length,5);
  assert.equal((await F.adminFeedbackList(db,{kind:'bug'})).total,12);assert.equal((await F.adminFeedbackList(db,{topic:'payments'})).total,3);
  assert.equal((await F.adminFeedbackList(db,{hasEmail:'1'})).total,1);assert.equal((await F.adminFeedbackList(db,{hasEmail:'0'})).total,24);
  assert.equal((await F.adminFeedbackList(db,{role:'visitor'})).total,25);assert.equal((await F.adminFeedbackList(db,{role:'nope'})).total,25);
  assert.equal((await F.adminFeedbackList(db,{q:'numarası 7 '})).total,1);assert.equal((await F.adminFeedbackList(db,{q:'%'})).total,25);assert.equal((await F.adminFeedbackList(db,{q:'zzz%'})).total,0);
  const admin={id:'admin-1',name:'Yönetici'};const target=items[3].id;
  await rejects(F.updateFeedback(db,admin,{id:target,status:'archived'}),400);await rejects(F.updateFeedback(db,admin,{id:'x',status:'done'}),400);
  await rejects(F.updateFeedback(db,admin,{id:crypto.randomUUID(),status:'done'}),404);await rejects(F.updateFeedback(db,admin,{id:target}),400);
  const planned=await F.updateFeedback(db,admin,{id:target,status:'planned',note:'Q1 yol haritası'},NOW);
  assert.equal(planned.status,'planned');assert.equal(planned.adminNote,'Q1 yol haritası');assert.equal(planned.handledBy,'admin-1');
  const done=await F.updateFeedback(db,admin,{id:target,status:'done'},NOW);assert.equal(done.adminNote,'Q1 yol haritası');
  await F.updateFeedback(db,admin,{id:target,status:'done'},NOW);// no change: no audit entry
  const audit=sql.prepare("SELECT * FROM admin_audit ORDER BY rowid").all();
  assert.deepEqual(audit.map(a=>[a.action,a.target_id,a.summary]),[['feedback_status',target,'new → planned · not güncellendi'],['feedback_status',target,'planned → done']]);
  assert.equal((await F.adminFeedbackList(db,{status:'done'})).total,1);assert.equal((await F.adminFeedbackList(db,{})).newCount,24);
 }finally{sql.close()}
});

test('reply path: mocked e-mail, stored as JSON in the row, moves new to reviewing, audited; failures store nothing',async()=>{
 const {sql,db}=fixture();try{
  const admin={id:'admin-1',name:'Ayşe'};
  const withMail=await F.submitFeedback(db,valid({reply:true,email:'v@example.com',consent:true,message:'Satır 1\n<script>x</script> lütfen'}),ctx(),NOW);
  const without=await F.submitFeedback(db,valid(),ctx({ipHash:'c'.repeat(64)}),NOW);
  const sent=[];const ok=async mail=>{sent.push(mail);return {sent:true,provider:'resend',messageId:'m-1'};};
  await rejects(F.replyToFeedback(db,admin,{id:without.id,text:'Merhaba'},ok,'https://site.test'),400,/e-posta adresi yok/);
  await rejects(F.replyToFeedback(db,admin,{id:withMail.id,text:'x'},ok,'https://site.test'),400);
  await rejects(F.replyToFeedback(db,admin,{id:withMail.id,text:'Merhaba'},async()=>({sent:false,reason:'not_configured'}),'https://site.test'),503);
  await rejects(F.replyToFeedback(db,admin,{id:withMail.id,text:'Merhaba'},async()=>({sent:false,reason:'http_500'}),'https://site.test'),502);
  assert.equal(sql.prepare('SELECT replies FROM site_feedback WHERE id=?').get(withMail.id).replies,'[]');
  const item=await F.replyToFeedback(db,admin,{id:withMail.id,text:'Teşekkürler, planladık.'},ok,'https://site.test',NOW);
  assert.equal(sent.length,1);assert.equal(sent[0].to,'v@example.com');assert.match(sent[0].subject,/Öneri \/ fikir/);assert.ok(!sent[0].html.includes('<script>'));assert.match(sent[0].text,/> Satır 1/);
  assert.equal(item.status,'reviewing');assert.equal(item.replies.length,1);assert.equal(item.replies[0].body,'Teşekkürler, planladık.');assert.equal(item.replies[0].adminName,'Ayşe');
  const stored=JSON.parse(sql.prepare('SELECT replies FROM site_feedback WHERE id=?').get(withMail.id).replies);assert.equal(stored[0].provider,'resend');
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM admin_audit WHERE action='feedback_reply' AND target_id=?").get(withMail.id).n,1);
  // A second reply appends; status stays as set.
  await F.updateFeedback(db,admin,{id:withMail.id,status:'planned'},NOW);
  const again=await F.replyToFeedback(db,admin,{id:withMail.id,text:'Bir güncelleme daha.'},ok,'https://site.test',NOW);assert.equal(again.replies.length,2);assert.equal(again.status,'planned');
  const notice=F.feedbackNotice(again,'https://site.test');assert.ok(!notice.html.includes('<script>'));assert.match(notice.text,/yonetim\?view=feedback/);
 }finally{sql.close()}
});

test('summary: average satisfaction, counts by type and top topics over the last 30 days',async()=>{
 const {sql,db}=fixture();try{
  const old=new Date(NOW.getTime()-40*86400000);
  await F.submitFeedback(db,valid({rating:1,kind:'complaint',topic:'payments'}),ctx({ipHash:'1'.repeat(64)}),old);
  await F.submitFeedback(db,valid({rating:5,topic:'search'}),ctx({ipHash:'2'.repeat(64)}),NOW);
  await F.submitFeedback(db,valid({rating:4,kind:'bug',topic:'search'}),ctx({ipHash:'3'.repeat(64)}),NOW);
  await F.submitFeedback(db,valid({rating:null,kind:'praise',topic:'listings'}),ctx({ipHash:'4'.repeat(64)}),NOW);
  const s=await F.feedbackSummary(db,new Date(NOW.getTime()+1000));
  assert.equal(s.total,3);assert.equal(s.rated,2);assert.equal(s.averageRating,4.5);
  assert.deepEqual(s.byKind,{idea:1,bug:1,complaint:0,praise:1});assert.deepEqual(s.topTopics,[{topic:'search',count:2},{topic:'listings',count:1}]);assert.equal(s.newCount,4);
  const empty=fixture();try{const e=await F.feedbackSummary(empty.db,NOW);assert.equal(e.averageRating,null);assert.equal(e.total,0);}finally{empty.sql.close()}
 }finally{sql.close()}
});

// Route modules with their imports replaced by test doubles (as tests/admin-insights.test.mjs does).
async function route(file,prefix){const source=readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/^import [\s\S]*?;\r?\n/gm,'');return import(url(ts.transpile(prefix+source,opts)));}
const common=`const ctx=globalThis.__fb,F=ctx.F;const {adminFeedbackList,FeedbackError,feedbackSummary,updateFeedback,replyToFeedback,submitFeedback,feedbackNotice,feedbackRole}=F;const feedbackDB=()=>ctx.db,currentUser=async()=>ctx.actor,isAdmin=u=>Boolean(u&&!u.admin_2fa_pending&&u.role==='admin'),error=(message,status=400)=>Response.json({error:message},{status}),ok=(v,init)=>Response.json(v,init),sameOrigin=r=>r.headers.get('origin')==='https://site.test',body=async r=>r.json(),env=ctx.env,emailProvider=s=>s.RESEND_API_KEY?'resend':null,sendEmail=async(s,m)=>{ctx.sent.push(m);return {sent:true,provider:'resend'};},siteUrl=()=>'https://site.test',waitUntil=p=>ctx.pending.push(p),clientIp=()=>'198.51.100.23',sha256=async v=>'h:'+[...v].reverse().join('');\n`;
const req=(path,method='GET',data,origin='https://site.test')=>new Request('https://site.test'+path,{method,headers:{'content-type':'application/json',origin,'user-agent':'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0'},body:data?JSON.stringify(data):undefined});

test('admin endpoints reject non-admins and pending 2FA; work for admins; never cached',async()=>{
 const {sql,db}=fixture();globalThis.__fb={F,db,actor:null,env:{RESEND_API_KEY:'k'},sent:[],pending:[]};
 try{
  const list=await route('app/api/admin/feedback/route.ts',common),reply=await route('app/api/admin/feedback/reply/route.ts',common);
  const saved=await F.submitFeedback(db,valid({reply:true,email:'v@example.com',consent:true}),ctx(),NOW);
  for(const actor of [null,{id:'a',role:'agent',email_verified:1},{id:'b',role:'admin',email_verified:0},{id:'c',role:'admin',email_verified:1,admin_2fa_pending:true}]){
   globalThis.__fb.actor=actor;
   assert.equal((await list.GET(req('/api/admin/feedback'))).status,403);assert.equal((await list.GET(req('/api/admin/feedback?summary=1'))).status,403);
   assert.equal((await list.PATCH(req('/api/admin/feedback','PATCH',{id:saved.id,status:'done'}))).status,403);
   assert.equal((await reply.POST(req('/api/admin/feedback/reply','POST',{id:saved.id,text:'Merhaba'}))).status,403);
  }
  assert.equal(sql.prepare('SELECT status FROM site_feedback').get().status,'new');assert.equal(globalThis.__fb.sent.length,0);
  globalThis.__fb.actor={id:'admin-1',name:'Admin',role:'admin',email_verified:1};
  assert.equal((await list.PATCH(req('/api/admin/feedback','PATCH',{id:saved.id,status:'done'},'https://evil.test'))).status,403);
  const got=await list.GET(req('/api/admin/feedback?status=new&hasEmail=1'));assert.equal(got.status,200);assert.match(got.headers.get('cache-control'),/no-store/);
  const data=await got.json();assert.equal(data.total,1);assert.equal(data.emailProvider,'resend');
  assert.equal((await (await list.GET(req('/api/admin/feedback?summary=1'))).json()).summary.newCount,1);
  const patched=await list.PATCH(req('/api/admin/feedback','PATCH',{id:saved.id,status:'planned',note:'Not'}));assert.equal(patched.status,200);assert.equal((await patched.json()).item.status,'planned');
  assert.equal((await list.PATCH(req('/api/admin/feedback','PATCH',{id:saved.id,status:'bogus'}))).status,400);
  const replied=await reply.POST(req('/api/admin/feedback/reply','POST',{id:saved.id,text:'Merhaba, teşekkürler.'}));assert.equal(replied.status,200);assert.equal(globalThis.__fb.sent[0].to,'v@example.com');
  delete globalThis.__fb.env.RESEND_API_KEY;assert.equal((await reply.POST(req('/api/admin/feedback/reply','POST',{id:saved.id,text:'Tekrar'}))).status,503);
 }finally{sql.close();delete globalThis.__fb;}
});

test('public endpoint: same-origin, stores no raw IP, honeypot is silent, admin notice only when e-mail is configured',async()=>{
 const {sql,db}=fixture();globalThis.__fb={F,db,actor:null,env:{},sent:[],pending:[]};
 try{
  const {POST}=await route('app/api/feedback/route.ts',common);
  assert.equal((await POST(req('/api/feedback','POST',valid(),'https://evil.test'))).status,403);
  const first=await POST(req('/api/feedback','POST',valid()));assert.equal(first.status,201);assert.match(first.headers.get('cache-control'),/no-store/);
  assert.equal(globalThis.__fb.pending.length,0);// no provider configured: no notice
  assert.equal((await POST(req('/api/feedback','POST',valid({website:'x'})))).status,201);
  assert.equal((await POST(req('/api/feedback','POST',valid({message:'x'})))).status,400);
  Object.assign(globalThis.__fb.env,{RESEND_API_KEY:'k',CONTACT_EMAIL:'team@site.test'});globalThis.__fb.actor={id:'u-1',email:'m@example.com',email_verified:1,role:'individual'};
  assert.equal((await POST(req('/api/feedback','POST',valid({reply:true,consent:true,email:'other@example.com'})))).status,201);
  await Promise.all(globalThis.__fb.pending);assert.equal(globalThis.__fb.sent.length,1);assert.equal(globalThis.__fb.sent[0].to,'team@site.test');assert.equal(globalThis.__fb.sent[0].replyTo,'m@example.com');
  const rows=sql.prepare('SELECT * FROM site_feedback ORDER BY created_at').all();assert.equal(rows.length,2);
  assert.equal(rows[1].user_id,'u-1');assert.equal(rows[1].role,'individual');assert.equal(rows[1].email,'m@example.com');assert.equal(rows[0].user_agent,'Firefox · Linux');
  const everything=JSON.stringify(rows)+JSON.stringify(sql.prepare('SELECT * FROM auth_limits').all());assert.ok(!everything.includes('198.51.100.23'));
 }finally{sql.close();delete globalThis.__fb;}
});
