import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {DatabaseSync} from 'node:sqlite';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url),cache=new Map();
function load(file){const full=path.resolve(root,file);if(cache.has(full))return cache.get(full);const m={exports:{}};const code=ts.transpileModule(readFileSync(full,'utf8'),{fileName:full,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(name=>name.startsWith('.')?load(path.resolve(path.dirname(full),name)+'.ts'):native(name),m,m.exports);cache.set(full,m.exports);return m.exports;}
const K=load('lib/account-kind.ts'),P=load('lib/account-panel.ts');
function database(){const sql=new DatabaseSync(':memory:');return {sql,prepare(query){return {values:[],bind(...values){this.values=values;return this;},async first(){return sql.prepare(query).get(...this.values)||null;},async run(){return sql.prepare(query).run(...this.values);}};}};}

// One account, one type (lib/account-kind.ts) and one panel per type (lib/account-panel.ts), 2026-11-13.
test('account type: agents by role, firms by the table or the firm they already own, everyone else individual',async()=>{
 const db=database();
 assert.equal(await K.accountKind(db,{id:'a',role:'agent'}),'agent');
 assert.equal(await K.accountKind(db,{id:'x',role:'admin'}),'individual');
 assert.equal(await K.accountKind(db,{id:'b',role:'buyer'}),'individual','no firm tables yet');
 db.sql.exec("CREATE TABLE contractor_firms(id TEXT,owner_id TEXT);CREATE TABLE service_firms(id TEXT,owner_id TEXT);INSERT INTO contractor_firms VALUES('f1','old');INSERT INTO service_firms VALUES('s1','svc')");
 assert.equal(await K.accountKind(db,{id:'old',role:'individual'}),'contractor','older account inferred from its firm');
 assert.equal(await K.accountKind(db,{id:'svc',role:'buyer'}),'service');
 assert.equal(await K.setAccountKind(db,{id:'b',role:'buyer'},'service'),'service');
 assert.equal(await K.accountKind(db,{id:'b',role:'buyer'}),'service');
 assert.equal(await K.firmAllowed(db,{id:'b',role:'buyer'},'service'),true);assert.equal(await K.firmAllowed(db,{id:'b',role:'buyer'},'contractor'),false);
 assert.equal(await K.firmAllowed(db,{id:'a',role:'agent'},'contractor'),false,'an agent cannot open a contractor firm');
 await assert.rejects(K.setAccountKind(db,{id:'a',role:'agent'},'contractor'),e=>e instanceof K.AccountKindError&&e.status===409);
 await assert.rejects(K.setAccountKind(db,{id:'x',role:'admin'},'service'),e=>e.status===403);
 await assert.rejects(K.setAccountKind(db,{id:'b',role:'buyer'},'agent'),e=>e.status===400,'agents only through the office application');
 await assert.rejects(K.setAccountKind(db,{id:'old',role:'individual'},'individual'),/müteahhit firma profilinizi silin/,'the firm would lose its panel');
 assert.equal(await K.setAccountKind(db,{id:'b',role:'buyer'},'individual'),'individual');assert.equal(await K.accountKind(db,{id:'b',role:'buyer'}),'individual');
});

test('panel: each type has its own short menu; old links still land on the right tab',()=>{
 const ids=(kind,options)=>P.panelTabs(kind,options).map(tab=>tab.id);
 assert.deepEqual(ids('individual'),['genel','favoriler','aramalar','ilanlarim','mesajlar','randevular','teklifler','ekip','profil']);
 assert.ok(ids('individual',{hasListings:true}).includes('crm'),'an individual seller sees listing statistics and leads');
 assert.deepEqual(ids('agent'),['genel','talep-akisi','ilanlarim','projelerim','mesajlar','crm','firma','ekip','siparisler','profil']);
 // Admins see the request board whatever their account type; agents have it once.
 assert.deepEqual(ids('individual',{admin:true}).slice(0,2),['genel','talep-akisi']);
 assert.equal(ids('agent',{admin:true}).filter(id=>id==='talep-akisi').length,1);
 assert.equal(P.panelTab('talepler',P.panelTabs('agent')),'crm');assert.equal(P.panelTab('randevular',P.panelTabs('agent')),'crm','appointments live inside CRM for agents');
 assert.deepEqual(ids('contractor'),['genel','muteahhit','mesajlar','profil']);
 assert.deepEqual(ids('service'),['genel','hizmet','mesajlar','profil']);
 for(const kind of ['individual','agent'])assert.ok(!ids(kind).includes('muteahhit')&&!ids(kind).includes('hizmet'),'no firm tabs for '+kind);
 const individual=P.panelTabs('individual');
 assert.equal(P.panelTab('kat-karsiligi',individual),'teklifler');assert.equal(P.panelTab('bildirimlerim',individual),'aramalar');
 assert.equal(P.panelTab('muteahhit',individual),'profil','"add your firm" links go to the account type switch');
 assert.equal(P.panelTab('projelerim',individual),'genel');assert.equal(P.panelTab(null,individual),'genel');
 assert.equal(P.panelTab(null,P.panelTabs('contractor')),'muteahhit','firm accounts open on their firm panel');assert.equal(P.panelTab('baslangic',P.panelTabs('service')),'hizmet');assert.equal(P.panelTab('baslangic',P.panelTabs('agent')),'genel');
 const auth=readFileSync(path.join(root,'components/AuthForm.tsx'),'utf8');assert.match(auth,/tab=muteahhit/);assert.match(auth,/tab=hizmet/);
 assert.match(readFileSync(path.join(root,'components/ServiceHeader.tsx'),'utf8'),/mode=register&role=service/);assert.match(readFileSync(path.join(root,'components/ContractorChrome.tsx'),'utf8'),/mode=register&role=contractor/);
});

test('registration and firm APIs use the account type',()=>{
 const account=readFileSync(path.join(root,'app/api/account/route.ts'),'utf8');
 assert.match(account,/action===\"set_account_kind\"/);assert.match(account,/isFirmKind\(data\.role\)\?data\.role:null/);
 assert.match(readFileSync(path.join(root,'app/api/contractors/mine/route.ts'),'utf8'),/if \(!current && !await firmAllowed\(/,'existing firms stay editable');
 assert.match(readFileSync(path.join(root,'app/api/services/mine/route.ts'),'utf8'),/firmAllowed\(servicesDB\(\) as unknown as KindDatabase, user, "service"\)/);
 assert.match(readFileSync(path.join(root,'app/api/auth/callback/google/route.ts'),'utf8'),/if \(kind\) await setAccountKind/);
});

test('Yönetim menu: six groups, every screen reachable, old ?view= links keep their screen',()=>{
 const N=load('lib/admin-nav.ts');
 assert.deepEqual(N.ADMIN_GROUPS.map(g=>g.id),['overview','listings','members','inbox','orders','system']);
 const views=N.ADMIN_GROUPS.flatMap(g=>g.views.map(v=>v.id));
 for(const id of ['overview','applications','listings','suspicious','projects','services','contractors','messages','reports','contact','feedback','orders','health','translation-trial','ai-limits','settings','audit','security'])assert.ok(views.includes(id),id);
 assert.equal(new Set(views).size,views.length,'each screen in one group');
 assert.equal(N.adminGroup('suspicious').id,'listings');assert.equal(N.adminGroup('security').id,'system');assert.equal(N.adminGroup('nope').id,'overview');
 assert.equal(N.adminHref({id:'security',href:'/yonetim/guvenlik'}),'/yonetim/guvenlik');
 const dashboard=readFileSync(path.join(root,'components/AdminDashboard.tsx'),'utf8');
 for(const id of views.filter(v=>v!=='security'))assert.ok(dashboard.includes(`${id.includes('-')?`'${id}'`:id}:[`),'page title for '+id+' (a missing title fell back to the overview)');
});
// Account type under the name in Hesabım (2026-11-17).
test('account type label: office consultant, estate office, developer, seller, firms, admin',async()=>{
 const {accountTypeLabel}=P;
 assert.equal(accountTypeLabel({kind:'individual',role:'buyer',office:'Şahmeran Emlak'}),'Danışman');
 assert.equal(accountTypeLabel({kind:'agent',role:'agent'}),'Emlak ofisi');
 assert.equal(accountTypeLabel({kind:'agent',role:'agent',companyCategory:'developer'}),'İnşaat firması');
 assert.equal(accountTypeLabel({kind:'individual',role:'individual'}),'Bireysel (mal sahibi)');
 assert.equal(accountTypeLabel({kind:'individual',role:'buyer'}),'Bireysel');
 assert.equal(accountTypeLabel({kind:'service',role:'buyer'}),'Hizmet firması');
 assert.equal(accountTypeLabel({kind:'contractor',role:'buyer'}),'Müteahhit');
 assert.equal(accountTypeLabel({kind:'agent',role:'admin',isAdmin:true}),'Yönetici');
});
