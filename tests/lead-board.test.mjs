// "Benim için bul" requests (lib/home-requests.ts) on the open board for estate agents (lib/lead-board.ts), 2026-11-19.
import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import ts from 'typescript';
const compile=p=>'data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64');
const homeURL=compile('home-requests');
const home=await import(homeURL);
const board=await import('data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/lead-board.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}).replace('"./home-requests"',JSON.stringify(homeURL))).toString('base64'));
const wrap=sql=>({prepare(q){let v=[];return {bind(...a){v=a;return this},async first(){return sql.prepare(q).get(...v)||null},async all(){return {results:sql.prepare(q).all(...v)}},async run(){return sql.prepare(q).run(...v)}}}});

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',D='44444444-4444-4444-8444-444444444444',E='66666666-6666-4666-8666-666666666666';
const buyer='55555555-5555-4555-8555-555555555555',L1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',L2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,company TEXT,role TEXT,agent_status TEXT);CREATE TABLE listings(id TEXT,owner_id TEXT,status TEXT,city TEXT,title TEXT);CREATE TABLE agent_plan_grants(id TEXT,user_id TEXT,plan_id TEXT,starts_at TEXT,ends_at TEXT,revoked_at TEXT)");
 const user=sql.prepare('INSERT INTO users VALUES(?,?,?,?,?)');
 for(const [id,name,company] of [[A,'Ayşe','Ege Emlak'],[B,'Burak',null],[C,'Cem',null],[D,'Deniz',null],[E,'Ece',null]])user.run(id,name,company,'agent','approved');
 user.run(buyer,'Alıcı',null,'buyer','none');
 sql.prepare('INSERT INTO listings VALUES(?,?,?,?,?)').run(L1,A,'published','İzmir','Bahçeli daire');
 sql.prepare('INSERT INTO listings VALUES(?,?,?,?,?)').run(L2,B,'published','Muğla','Bodrum villa');
 return {sql,db:wrap(sql)};
}
const request=(extra={})=>({intent:'buy',city:'İzmir',districts:['Karşıyaka','Bornova'],category:'konut',types:['daire'],roomsList:['3+1'],budgetMin:'3.000.000',budgetMax:'6000000',minArea:'120',features:['Asansör','Uçan halı'],timeline:'now',payment:'approved',foreign:true,citizenship:true,contact:'whatsapp',contactTime:'evening',language:'de',note:'Okula yakın',name:'Alıcı Kişi',email:'Alici@Example.com',phone:'+90 555 111 2233',consent:true,...extra});
const open={plans:false,plan:null,limit:null,used:0,canReach:true,headStart:true};

test('the form: limits, details, rent without payment; no matching step, any province works',async()=>{const f=fixture();try{
 const at=new Date('2026-11-19T09:00:00Z');
 await assert.rejects(()=>home.createHomeRequest(f.db,buyer,request({consent:false}),at),/onaylayın/);
 await assert.rejects(()=>home.createHomeRequest(f.db,buyer,request({districts:['a','b','c','d']}),at),/3 ilçe/);
 await assert.rejects(()=>home.createHomeRequest(f.db,buyer,request({phone:'',contact:'whatsapp'}),at),/telefon/i);
 await assert.rejects(()=>home.createHomeRequest(f.db,buyer,request({budgetMin:'9000000'}),at),/büyük olamaz/);
 const created=await home.createHomeRequest(f.db,buyer,request(),at),d=created.request.details;
 assert.deepEqual([d.districts,d.types,d.rooms,d.features,d.minArea,d.timeline,d.payment,d.citizenship,d.contact,d.language],[['Karşıyaka','Bornova'],['daire'],['3+1'],['Asansör'],120,'now','approved',true,'whatsapp','de']);
 assert.equal(home.homeRequestSummary(created.request),'Satılık · Karşıyaka, Bornova, İzmir · Daire · 3+1');
 assert.equal(home.homeRequestSearch(created.request),'purpose=satilik&city=%C4%B0zmir&type=daire&rooms=3%2B1&minPrice=3000000&maxPrice=6000000&minArea=120');
 assert.equal(home.validateHomeRequest(request({intent:'rent',payment:'cash'})).details.payment,'');
 // A province without any agent listings is fine: the board is open to everyone.
 await home.createHomeRequest(f.db,buyer,request({city:'Hakkari',districts:[]}),at);
 await home.createHomeRequest(f.db,buyer,request(),at);await assert.rejects(()=>home.createHomeRequest(f.db,buyer,request(),at),e=>e.status===429);
}finally{f.sql.close();}});

test('board: every agent sees open requests without contact; filters; hot and foreign tags',async()=>{const f=fixture();try{
 const at=new Date('2026-11-19T09:00:00Z');
 const hot=await home.createHomeRequest(f.db,buyer,request(),at);
 await home.createHomeRequest(f.db,buyer,request({intent:'rent',city:'Muğla',districts:['Bodrum'],timeline:'browsing',payment:'',foreign:false,citizenship:false}),at);
 const all=await board.leadBoard(f.db,E,open,{},at);
 assert.equal(all.total,2);assert.ok(all.items.every(i=>i.contact===null&&i.note===''));
 assert.equal(all.items.find(i=>i.id===hot.id).hot,true);
 assert.deepEqual((await board.leadBoard(f.db,E,open,{hot:true},at)).items.map(i=>i.id),[hot.id]);
 assert.equal((await board.leadBoard(f.db,E,open,{foreign:true},at)).total,1);
 assert.equal((await board.leadBoard(f.db,E,open,{city:'Muğla'},at)).total,1);
 assert.equal((await board.leadBoard(f.db,E,open,{district:'Bornova'},at)).total,1);
 assert.equal((await board.leadBoard(f.db,E,open,{intent:'rent',maxBudget:1000},at)).total,0);
 // The member never sees their own request on the board.
 assert.equal((await board.leadBoard(f.db,buyer,open,{},at)).total,0);
 assert.equal(board.boardFilters(new URLSearchParams('hot=1&intent=x&minBudget=1.000&page=99')).page,50);
}finally{f.sql.close();}});

test('reaching: offer with own listings, phone reveal, at most four agents, closed requests',async()=>{const f=fixture();try{
 const at=new Date('2026-11-19T09:00:00Z');
 const {id}=await home.createHomeRequest(f.db,buyer,request(),at);
 await assert.rejects(()=>board.sendOffer(f.db,A,{id,message:'kısa'},open,at),/20 karakter/);
 await assert.rejects(()=>board.sendOffer(f.db,A,{id,message:'Merhaba, size uygun üç seçeneğim var.',listingIds:[L2]},open,at),/kendi/);
 const sent=await board.sendOffer(f.db,A,{id,message:'Merhaba, size uygun üç seçeneğim var.',listingIds:[L1,L1]},open,at);
 assert.equal(sent.first,true);assert.equal(sent.memberId,buyer);
 // After an offer the agent sees the name; the phone only after opening it.
 let item=(await board.leadBoard(f.db,A,open,{},at)).items[0];
 assert.equal(item.contact.name,'Alıcı Kişi');assert.equal(item.contact.phone,'');assert.equal(item.note,'Okula yakın');assert.equal(item.mine.offer.listingIds.length,1);
 const contact=await board.revealContact(f.db,A,id,open,at);assert.equal(contact.phone,'+90 555 111 2233');
 item=(await board.leadBoard(f.db,A,open,{},at)).items[0];assert.equal(item.contact.email,'alici@example.com');assert.equal(item.reached,1);
 assert.deepEqual((await board.leadBoard(f.db,A,open,{mine:true},at)).items.map(i=>i.id),[id]);
 for(const agent of [B,C,D])await board.revealContact(f.db,agent,id,open,at);
 await assert.rejects(()=>board.revealContact(f.db,E,id,open,at),e=>e.status===409);
 assert.equal((await board.leadBoard(f.db,E,open,{},at)).items[0].full,true);
 // An agent already in keeps access; the member sees offers and reveals.
 await board.sendOffer(f.db,B,{id,message:'İkinci teklif: Bornova’da iki seçenek.'},open,at);
 const activity=await board.memberLeadActivity(f.db,id,at);
 assert.deepEqual(activity.offers.map(o=>o.agentName).sort(),['Ayşe','Burak']);assert.deepEqual(activity.offers.find(o=>o.agentName==='Ayşe').listings,[{id:L1,title:'Bahçeli daire'}]);
 assert.equal(activity.reveals.length,4);
 const mine=(await home.myHomeRequests(f.db,buyer,at))[0];assert.equal(mine.reached,4);
 // Close: found here with Ayşe (an agent who reached it); a stranger cannot be named.
 await home.closeHomeRequest(f.db,buyer,id,'found_here',at,A);
 assert.equal((await home.myHomeRequests(f.db,buyer,at))[0].foundWith,A);
 await assert.rejects(()=>board.sendOffer(f.db,C,{id,message:'Kapandıktan sonra gelen teklif mesajı.'},open,at),e=>e.status===410);
 assert.equal((await board.leadBoard(f.db,A,open,{},at)).total,0);
 // Reopen and extend: 30 days at a time, never beyond 90 days from now.
 assert.equal(await home.extendHomeRequest(f.db,buyer,id,at),'2027-01-18T09:00:00.000Z');
 await home.extendHomeRequest(f.db,buyer,id,at);assert.equal(await home.extendHomeRequest(f.db,buyer,id,at),'2027-02-17T09:00:00.000Z');
 await assert.rejects(()=>home.extendHomeRequest(f.db,A,id,at),e=>e.status===404);
}finally{f.sql.close();}});

test('plans (LEAD_PLANS=1): free agents only look, Profesyonel 20 a month, Prestij first 24 hours',async()=>{const f=fixture();try{
 const at=new Date('2026-11-19T09:00:00Z');
 assert.equal(board.leadPlansEnabled({LEAD_PLANS:'1'}),true);assert.equal(board.leadPlansEnabled({}),false);
 const grant=(user,plan)=>f.sql.prepare('INSERT INTO agent_plan_grants VALUES(?,?,?,?,?,NULL)').run(crypto.randomUUID(),user,plan,'2026-11-01T00:00:00Z','2026-12-01T00:00:00Z');
 grant(A,'prestige');grant(B,'professional');
 const {id}=await home.createHomeRequest(f.db,buyer,request(),at);
 const free=await board.leadAccess(f.db,E,true,at),pro=await board.leadAccess(f.db,B,true,at),prestige=await board.leadAccess(f.db,A,true,at);
 assert.deepEqual([free.plan,free.canReach],[null,false]);assert.deepEqual([pro.plan,pro.limit],['professional',20]);assert.deepEqual([prestige.plan,prestige.limit,prestige.headStart],['prestige',60,true]);
 assert.equal((await board.leadBoard(f.db,E,free,{},at)).items[0].locked,true);
 await assert.rejects(()=>board.revealContact(f.db,E,id,free,at),e=>e.status===403||e.status===402);
 // Profesyonel waits 24 hours, Prestij can answer at once.
 assert.equal((await board.leadBoard(f.db,B,pro,{},at)).items[0].locked,true);
 await assert.rejects(()=>board.revealContact(f.db,B,id,pro,at),/24 saat/);
 await board.revealContact(f.db,A,id,prestige,at);
 const later=new Date('2026-11-20T10:00:00Z');
 await board.revealContact(f.db,B,id,await board.leadAccess(f.db,B,true,later),later);
 assert.equal((await board.leadAccess(f.db,B,true,later)).used,1);
 // A full month of Profesyonel contacts.
 f.sql.prepare('INSERT INTO home_request_agents(request_id,agent_id,state,updated_at) SELECT ?||value,?,?,? FROM json_each(?)').run('x',B,'contacted','2026-11-15T00:00:00Z',JSON.stringify(Array.from({length:19},(_,i)=>i)));
 assert.equal((await board.leadAccess(f.db,B,true,later)).canReach,false);
 // Without the switch everyone reaches freely.
 assert.equal((await board.leadAccess(f.db,E,false,later)).canReach,true);
}finally{f.sql.close();}});

test('follows, unseen count, e-mail recipients and response time',async()=>{const f=fixture();try{
 const at=new Date('2026-11-19T09:00:00Z');
 await assert.rejects(()=>board.setLeadFollows(f.db,A,Array.from({length:11},(_,i)=>'İl'+i),at),/10 il/);
 assert.deepEqual(await board.setLeadFollows(f.db,C,['İzmir','İzmir','Ankara'],at),['İzmir','Ankara']);
 // İzmir: Cem follows it; Ayşe has listings there and follows nothing; Burak follows nothing and has no İzmir listing.
 assert.deepEqual((await board.agentsToAlert(f.db,'İzmir',buyer)).map(a=>a.id).sort(),[A,C].sort());
 await board.setLeadFollows(f.db,A,['Muğla'],at);
 assert.deepEqual((await board.agentsToAlert(f.db,'İzmir',buyer)).map(a=>a.id),[C]);
 const {id}=await home.createHomeRequest(f.db,buyer,request(),at);
 assert.equal(await board.boardUnseen(f.db,D,new Date('2026-11-19T10:00:00Z')),1);
 await board.boardUnseen(f.db,D,new Date('2026-11-19T10:00:00Z'),true);
 assert.equal(await board.boardUnseen(f.db,D,new Date('2026-11-19T11:00:00Z')),0);
 await board.revealContact(f.db,D,id,open,new Date('2026-11-19T10:30:00Z'));
 const stats=await board.responseStats(f.db,D,new Date('2026-11-19T12:00:00Z'));assert.equal(stats.answered,1);assert.equal(stats.medianHours,1.5);assert.equal(stats.fast,false);
}finally{f.sql.close();}});

test('a fresh database: an agent can open the board before any buyer request exists',async()=>{
 const sql=new DatabaseSync(':memory:');
 try{
  sql.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,role TEXT,agent_status TEXT)");
  const db=wrap(sql);
  await board.ensureLeads(db);
  const tables=sql.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
  for(const name of ['home_requests','home_request_agents','home_request_offers','home_request_reveals'])assert.ok(tables.includes(name),name);
  assert.equal(await board.leadsUsed(db,A),0);
 }finally{sql.close();}
});

test('bulletin figures: new in 24 hours, hot, foreign and still-open requests over the filtered list',async()=>{
 const src=readFileSync(new URL('../lib/lead-board.ts',import.meta.url),'utf8');
 assert.match(src,/const summary = \{ fresh: items\.filter\(\(item\) => item\.createdAt > dayAgo\)\.length, hot: items\.filter\(\(item\) => item\.hot\)\.length/);
 assert.match(src,/return \{ items: slice, total: items\.length, page, pageSize, summary \};/);
 const ui=readFileSync(new URL('../components/LeadBoard.tsx',import.meta.url),'utf8');
 assert.match(ui,/\{access\?\.plans && access\.headStart && <span className="lb-headstart">/,'the head-start line only with packages on');
 const home=readFileSync(new URL('../components/HomePage.tsx',import.meta.url),'utf8');
 assert.ok(home.indexOf('<HomeFindForMe/>')>home.indexOf('market-shortcuts')&&home.indexOf('<HomeFindForMe/>')<home.indexOf('<HomeTools/>'),'Benim için bul right after the quick links');
 assert.match(readFileSync(new URL('../components/HomeFindForMe.tsx',import.meta.url),'utf8'),/Örnek görünüm/,'the illustration is labelled as an example');
});

