// Calculators, home valuation, "Benim için bul", agent directory and seasonal rentals (2026-11-17).
import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import ts from 'typescript';
const load=p=>import('data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));
const calc=await load('property-calculators'),val=await load('valuation'),home=await load('home-requests'),agents=await load('agent-directory'),season=await load('seasonal-rentals');
const wrap=sql=>({prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}});

test('rent increase, title deed fee and buying costs',()=>{
 assert.deepEqual(calc.rentIncrease('20000','34.88'),{current:20000,rate:34.88,increase:6976,next:26976,yearly:323712});
 assert.equal(calc.rentIncrease('0','30'),null);assert.equal(calc.rentIncrease('1000','-1'),null);assert.equal(calc.rentIncrease('1000','abc'),null);
 assert.deepEqual(calc.deedFee(5000000),{value:5000000,buyer:100000,seller:100000,total:200000});
 assert.deepEqual(calc.deedFee(5000000,'buyer'),{value:5000000,buyer:200000,seller:0,total:200000});
 const costs=calc.deedCosts({price:5000000,revolvingFee:4000,dask:1500,commissionPercent:2});
 assert.deepEqual(costs.items.map(i=>[i.key,i.amount]),[['fee',100000],['revolving',4000],['dask',1500],['commission',100000]]);
 assert.equal(costs.total,205500);assert.equal(costs.sellerFee,100000);
 // A commission above 10 % is a typo, not a fee.
 assert.equal(calc.deedCosts({price:1000000,commissionPercent:50}).items.some(i=>i.key==='commission'),false);
 assert.deepEqual(calc.calculatorDefaults({RENT_INCREASE_RATE:'34,88',RENT_INCREASE_MONTH:'2026-10',DEED_REVOLVING_FEE:'x'}),{rentRate:34.88,rentMonth:'2026-10',revolvingFee:null});
});

test('valuation: district comparables of similar size, province fallback, rent yield',()=>{
 const sales=[...Array(6)].map((_,i)=>({price:(5000000+i*100000),area:100,district:'Karşıyaka'})).concat([...Array(6)].map(()=>({price:3000000,area:100,district:'Buca'})));
 const rents=[...Array(5)].map(()=>({price:25000,area:100,district:'Karşıyaka'}));
 const r=val.valuate(sales,rents,'Karşıyaka',120);
 assert.equal(r.level,'district');assert.equal(r.count,6);assert.equal(r.perM2.mid,52500);assert.equal(r.value.mid,6300000);
 assert.equal(r.rent.value.mid,30000);assert.equal(r.yieldPercent,5.7);assert.equal(r.paybackYears,17.5);
 // Too few in the district: the whole province is used.
 const city=val.valuate(sales,[],'Bornova',100);assert.equal(city.level,'city');assert.equal(city.count,12);assert.equal(city.rent,null);
 assert.equal(val.valuate(sales.slice(0,3),[],'',100),null);assert.equal(val.valuate(sales,[],'',5),null);
});

function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,company TEXT,avatar_url TEXT,role TEXT,agent_status TEXT,phone TEXT);CREATE TABLE listings(id TEXT,owner_id TEXT,status TEXT,purpose TEXT,city TEXT,district TEXT,property_type TEXT,agency_id TEXT);CREATE TABLE agencies(id TEXT PRIMARY KEY,owner_id TEXT,name TEXT,status TEXT);CREATE TABLE company_team_memberships(id TEXT,agency_id TEXT,user_id TEXT,ended_at TEXT)");
 sql.exec(`INSERT INTO users VALUES('11111111-1111-4111-8111-111111111111','Ayşe','Ege Emlak',NULL,'agent','approved','+90 555 000 0001'),('22222222-2222-4222-8222-222222222222','Burak',NULL,NULL,'agent','approved',NULL),
  ('33333333-3333-4333-8333-333333333333','Cem',NULL,NULL,'agent','pending','+90 555'),('44444444-4444-4444-8444-444444444444','Deniz',NULL,NULL,'individual','none',NULL),('55555555-5555-4555-8555-555555555555','Alıcı',NULL,NULL,'buyer','none',NULL)`);
 const add=(id,owner,purpose,city,district,type,status='published',agency=null)=>sql.prepare('INSERT INTO listings VALUES(?,?,?,?,?,?,?,?)').run(id,owner,status,purpose,city,district,type,agency);
 add('a1','11111111-1111-4111-8111-111111111111','satilik','İzmir','Karşıyaka','daire');add('a2','11111111-1111-4111-8111-111111111111','satilik','İzmir','Karşıyaka','villa');add('a3','11111111-1111-4111-8111-111111111111','kiralik','İzmir','Bornova','daire');
 add('b1','22222222-2222-4222-8222-222222222222','satilik','İzmir','Bornova','daire');add('c1','33333333-3333-4333-8333-333333333333','satilik','İzmir','Karşıyaka','daire');
 add('d1','44444444-4444-4444-8444-444444444444','satilik','İzmir','Karşıyaka','daire');add('a4','22222222-2222-4222-8222-222222222222','satilik','Ankara','Çankaya','arsa','draft');
 return {sql,db:wrap(sql)};
}
const buyer='55555555-5555-4555-8555-555555555555';
const request=(extra={})=>({intent:'buy',city:'İzmir',district:'Karşıyaka',category:'konut',rooms:'3+1',budgetMin:'3.000.000',budgetMax:'6000000',note:'Okula yakın',name:'Alıcı Kişi',email:'Alici@Example.com',phone:'+90 555 111 2233',consent:true,...extra});

test('Benim için bul: approved agents with matching listings, district first; limits; contact only while open',async()=>{const f=fixture();try{
 await assert.rejects(()=>home.createHomeRequest(f.db,buyer,request({consent:false})),/onaylayın/);
 await assert.rejects(()=>home.createHomeRequest(f.db,buyer,request({budgetMin:'9000000'})),/büyük olamaz/);
 const at=new Date('2026-11-17T10:00:00Z'),created=await home.createHomeRequest(f.db,buyer,request(),at);
 // Ayşe has sales in Karşıyaka; Burak only in Bornova (province fallback); Cem is pending, Deniz is not an agent.
 assert.deepEqual(created.agents.map(a=>a.name),['Ayşe','Burak']);
 assert.equal(created.request.email,'alici@example.com');assert.equal(created.request.budgetMin,3000000);
 const inbox=await home.agentHomeRequests(f.db,'11111111-1111-4111-8111-111111111111',at);
 assert.equal(inbox.length,1);assert.equal(inbox[0].phone,'+90 555 111 2233');assert.equal(inbox[0].state,'new');
 assert.equal(await home.newHomeRequestCount(f.db,'11111111-1111-4111-8111-111111111111',at),0);
 await home.setHomeRequestState(f.db,'11111111-1111-4111-8111-111111111111',created.id,'contacted',at);
 await assert.rejects(()=>home.setHomeRequestState(f.db,'33333333-3333-4333-8333-333333333333',created.id,'contacted',at),e=>e.status===404);
 const mine=await home.myHomeRequests(f.db,buyer,at);assert.equal(mine[0].agents,2);assert.equal(mine[0].status,'open');
 await home.closeHomeRequest(f.db,buyer,created.id);
 assert.equal((await home.agentHomeRequests(f.db,'11111111-1111-4111-8111-111111111111',at))[0].email,'');
 // Rent in Ankara: nobody matches; three requests a day at most.
 await assert.rejects(()=>home.createHomeRequest(f.db,buyer,request({intent:'rent',city:'Ankara',district:''}),at),e=>e.status===404);
 await home.createHomeRequest(f.db,buyer,request(),at);await home.createHomeRequest(f.db,buyer,request(),at);
 await assert.rejects(()=>home.createHomeRequest(f.db,buyer,request(),at),e=>e.status===429);
}finally{f.sql.close()}});

test('agent directory: listed approved agents, place and language filters, phone only for listed agents',async()=>{const f=fixture();try{
 const all=await agents.listAgents(f.db,{});assert.equal(all.total,2);assert.deepEqual(all.agents.map(a=>[a.name,a.listings,a.city,a.district]),[['Ayşe',3,'İzmir','Karşıyaka'],['Burak',1,'İzmir','Bornova']]);
 assert.deepEqual((await agents.listAgents(f.db,{city:'İzmir',district:'Karşıyaka'})).agents.map(a=>a.name),['Ayşe']);
 assert.deepEqual(await agents.setAgentLanguages(f.db,'22222222-2222-4222-8222-222222222222',['de','en','xx','de']),['de','en']);
 const german=await agents.listAgents(f.db,{language:'de'});assert.deepEqual(german.agents.map(a=>[a.name,a.languages]),[['Burak',['de','en']]]);
 assert.equal((await agents.listAgents(f.db,{q:'ege'})).agents[0].name,'Ayşe');
 assert.equal(await agents.agentPhone(f.db,'11111111-1111-4111-8111-111111111111'),'+90 555 000 0001');
 assert.equal(await agents.agentPhone(f.db,'33333333-3333-4333-8333-333333333333'),null);
 assert.equal(await agents.agentPhone(f.db,"x' OR 1=1"),null);
}finally{f.sql.close()}});

test('seasonal destinations link to daily rentals of that place',()=>{
 const bodrum=season.SEASON_DESTINATIONS.find(d=>d.key==='bodrum');
 assert.equal(season.seasonHref(bodrum),'/ilanlar?purpose=gunluk&city=Mu%C4%9Fla&district=Bodrum');
 assert.equal(new Set(season.SEASON_DESTINATIONS.map(d=>d.key)).size,season.SEASON_DESTINATIONS.length);
});

test('agent directory lists office consultants under the office name',async()=>{const f=fixture();try{
 f.sql.exec("INSERT INTO agencies VALUES('ag1','11111111-1111-4111-8111-111111111111','Ege Emlak Ofisi','approved');INSERT INTO company_team_memberships VALUES('m1','ag1','44444444-4444-4444-8444-444444444444',NULL)");
 f.sql.exec("UPDATE users SET role='buyer' WHERE id='44444444-4444-4444-8444-444444444444'");
 const all=await agents.listAgents(f.db,{});
 assert.deepEqual(all.agents.map(a=>[a.name,a.company]),[['Ayşe','Ege Emlak'],['Burak',null],['Deniz','Ege Emlak Ofisi']]);
 assert.equal(await agents.agentPhone(f.db,'44444444-4444-4444-8444-444444444444'),null);
 f.sql.exec("UPDATE company_team_memberships SET ended_at='2026-11-17'");
 assert.equal((await agents.listAgents(f.db,{})).total,2);
}finally{f.sql.close()}});
