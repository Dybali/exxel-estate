import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
// Sahte ve tekrar ilan tespiti (lib/listing-risk.ts, lib/listing-risk-server.ts, listing routes, admin API).
const requireNative=createRequire(import.meta.url);
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
function load(file,overrides={},stub=false){
 const m={exports:{}};
 const resolve=name=>{
  if(overrides[name])return overrides[name];
  if(name.endsWith('.json'))return {default:JSON.parse(read(name.replace(/^@\//,'')))};
  if(name.startsWith('./'))return load('lib/'+name.slice(2)+'.ts',overrides,stub);
  if(name.startsWith('@/lib/'))return stub?{}:load(name.slice(2)+'.ts',overrides);
  if(name.startsWith('@/'))return {};
  return requireNative(name);
 };
 new Function('require','module','exports',ts.transpile(read(file),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}))(resolve,m,m.exports);
 return m.exports;
}
const risk=load('lib/listing-risk.ts');
const server=load('lib/listing-risk-server.ts');
const NOW=new Date('2026-11-06T12:00:00.000Z');

// 9×8 grayscale grids: a gradient picture, the same with small noise, and an unrelated one.
const gradient=Array.from({length:72},(_,i)=>((i%9)*23+Math.floor(i/9)*7+((i*37)%11)*9)%256);
const noisy=gradient.map((v,i)=>i%13===0?v+2:v);
const other=gradient.map((v,i)=>255-((i*53)%256));
const flip=(hash,bits)=>{let n=BigInt('0x'+hash);for(const b of bits)n^=1n<<BigInt(b);return n.toString(16).padStart(16,'0');};

test('photo fingerprints: dHash format, Hamming distance, near-copies match, degenerate hashes refused',()=>{
 const a=risk.dHashFromGray(gradient),b=risk.dHashFromGray(noisy),c=risk.dHashFromGray(other);
 assert.match(a,/^[0-9a-f]{16}$/);
 assert.equal(risk.hammingDistance(a,a),0);
 assert.ok(risk.hammingDistance(a,b)<=risk.PHOTO_HAMMING_MAX,'small noise stays within the threshold');
 assert.ok(risk.hammingDistance(a,c)>risk.PHOTO_HAMMING_MAX,'an unrelated picture is far away');
 assert.equal(risk.hammingDistance(a,flip(a,[0,9,31,32,63])),5);
 assert.equal(risk.hammingDistance('ffffffff00000000','00000000ffffffff'),64);
 for(const bad of ['0000000000000000','ffffffffffffffff','0000000000000001','xyz','ABCDEF0123456789A',null,12])assert.equal(risk.validPhotoHash(bad),false,String(bad));
 assert.equal(risk.validPhotoHash(a),true);
 assert.equal(risk.matchingPhotos([a,c],[flip(a,[1,2,3])]),1);
 assert.equal(risk.matchingPhotos([a],[flip(a,[1,2,3,4,5,6,7,8,9])]),0,'nine bits apart is a different photo');
 assert.throws(()=>risk.dHashFromGray([1,2,3]));
});

test('text similarity folds Turkish letters, case and punctuation',()=>{
 assert.equal(risk.foldText('İSTANBUL Şişli’de ÇOK güzel, IŞIKLI daire!'),'istanbul sisli de cok guzel isikli daire');
 assert.equal(risk.foldText('Schlüssel per Post · clés'),'schlussel per post cles');
 const original='Deniz manzaralı, güney cepheli 3+1 daire. Site içinde havuz, kapalı otopark ve 7/24 güvenlik bulunmaktadır. Metroya yürüme mesafesinde.';
 const copied='DENIZ MANZARALI GUNEY CEPHELI 3+1 DAIRE. Site icinde havuz, kapali otopark ve 7/24 guvenlik bulunmaktadir. Metroya yurume mesafesinde!!';
 assert.equal(risk.textSimilarity(original,copied),1);
 const edited=original.replace('Metroya yürüme mesafesinde.','Okullara ve hastaneye yakın, aileler için ideal.');
 const sim=risk.textSimilarity(original,edited);assert.ok(sim>=0.5&&sim<1,String(sim));
 assert.ok(risk.textSimilarity(original,'Bahçeli müstakil köy evi, meyve ağaçları ve kuyu suyu var. Şehir merkezine 20 dakika.')<0.1);
 assert.equal(risk.textSimilarity('',original),0);
});

test('price per m² is judged only with at least five comparables and flags far outliers',()=>{
 const comps=[48000,50000,52000,55000,47000,51000,53000,49000];
 assert.equal(risk.priceAnomaly(10000,comps.slice(0,4)),null,'four comparables are not enough');
 assert.equal(risk.priceAnomaly(10000,[]),null);
 const low=risk.priceAnomaly(15000,comps);assert.equal(low.direction,'low');assert.equal(low.comparables,8);assert.equal(low.median,50500);
 assert.equal(risk.priceAnomaly(42000,comps),null,'a cheap but plausible price is not flagged');
 assert.equal(risk.priceAnomaly(200000,comps).direction,'high');
 assert.equal(risk.priceAnomaly(70000,comps),null);
 assert.equal(risk.priceAnomaly(15000,[...comps.slice(0,4),0,-5,NaN]),null,'invalid comparables do not count');
});

test('scam and advance-payment wording is found in all site languages, ordinary deposits are not',()=>{
 const strong={tr:'Yurt dışındayım, ödemeyi Western Union ile yapın.',en:'I am abroad, I can send you the keys by courier.',de:'Ich bin im Ausland, Schlüssel per Post.',fr:'Paiement par mandat cash uniquement.',ar:'الدفع عبر ويسترن يونيون فقط',fa:'پرداخت فقط با وسترن یونیون',ru:'Оплата через Вестерн Юнион, я за границей.',nl:'Ik zit in het buitenland, sleutels per post.'};
 for(const [lang,text] of Object.entries(strong))assert.ok(risk.scamTerms(text).strong.length>0,lang);
 const weak={tr:'Kaporayı gönderin, yer ayıralım.',en:'Advance payment required to reserve.',de:'Vorauszahlung erforderlich.',fr:'Un acompte est demandé.',ar:'مطلوب عربون للحجز',fa:'پیش‌پرداخت لازم است',ru:'Нужна предоплата за месяц.',nl:'Aanbetaling vereist.'};
 for(const [lang,text] of Object.entries(weak)){const found=risk.scamTerms(text);assert.equal(found.strong.length,0,lang);assert.ok(found.weak.length>0,lang);}
 for(const text of ['Kira 25.000 TL, depozito iki kira bedelidir.','Deposit: two months rent. Viewing any day.','Kaution drei Monatsmieten.'])assert.deepEqual(risk.scamTerms(text),{strong:[],weak:[]},text);
 assert.deepEqual(risk.externalContacts('Detaylar için www.ornek-emlak.com veya info@ornek.com, WhatsApp 0532 111 22 33').kinds,['url','email','phone','messenger']);
 assert.deepEqual(risk.phonesIn('Tel: 0532 111 22 33 / +49 151 2345 6789'),['+905321112233','+4915123456789']);
 assert.deepEqual(risk.externalContacts('120 m² daire, 3+1, 4.500.000 TL').kinds,[]);
});

const subject={id:'s',ownerId:'b',title:'Deniz manzaralı satılık daire',description:'Güney cepheli ferah daire, site içinde havuz ve otopark.',purpose:'satilik',propertyType:'daire',city:'İzmir',district:'Konak',price:5000000,currency:'TRY',grossArea:100,photoHashes:[]};
const candidate=(extra)=>({...subject,id:'c',ownerId:'a',title:'Bambaşka bir ilan başlığı',description:'Bahçeli müstakil köy evi, meyve ağaçları var.',status:'published',expiresAt:null,photoHashes:[],...extra});
const context=(extra={})=>({candidates:[],comparables:[],owner:{createdAt:'2025-01-01T00:00:00.000Z',recentListings:1},phoneAccounts:0,now:NOW,...extra});

test('scoring: thresholds are conservative; one signal flags at most medium, combined signals reach high',()=>{
 assert.equal(risk.riskLevel(0),'low');assert.equal(risk.riskLevel(34),'low');assert.equal(risk.riskLevel(35),'medium');assert.equal(risk.riskLevel(69),'medium');assert.equal(risk.riskLevel(70),'high');
 assert.deepEqual(risk.scoreRisk([{code:'scam_terms',weight:60},{code:'price_low',weight:60}]),{score:100,level:'high'});
 const h1=risk.dHashFromGray(gradient),h2=risk.dHashFromGray(other);
 assert.equal(risk.evaluateRisk(subject,context()).level,'low');
 // Photos from another account's listing: medium (flag for admins), not high.
 const stolen=risk.evaluateRisk({...subject,photoHashes:[h1,h2]},context({candidates:[candidate({photoHashes:[flip(h1,[3]),flip(h2,[7,8])]})]}));
 assert.equal(stolen.level,'medium');assert.deepEqual(stolen.reasons.map(r=>r.code),['photos_other_owner']);assert.equal(stolen.matches[0].id,'c');assert.equal(stolen.matches[0].photos,2);
 // + bait price + scam wording: high.
 const scam=risk.evaluateRisk({...subject,price:1500000,photoHashes:[h1,h2],description:subject.description+' Yurt dışındayım, kapora Western Union ile.'},context({candidates:[candidate({photoHashes:[h1,h2]})],comparables:[48000,50000,52000,55000,47000,51000]}));
 assert.equal(scam.level,'high');assert.deepEqual(scam.reasons.map(r=>r.code).sort(),['photos_other_owner','price_low','scam_terms']);
 assert.ok(scam.signature.includes('listing:c')&&scam.signature.includes('price_low'));
 // Wording alone stays below high.
 assert.notEqual(risk.evaluateRisk({...subject,description:'Western Union ile ödeme, www.site.com'},context()).level,'high');
 // Same owner: a live near-identical listing is duplicate spam; an expired one or a rental of the same flat is not.
 const own=candidate({ownerId:'b',photoHashes:[h1,h2]});
 assert.equal(risk.evaluateRisk({...subject,photoHashes:[h1,h2]},context({candidates:[own]})).reasons[0].code,'own_duplicate');
 assert.deepEqual(risk.evaluateRisk({...subject,photoHashes:[h1,h2]},context({candidates:[{...own,expiresAt:'2026-11-01T00:00:00.000Z'}]})).reasons,[]);
 assert.deepEqual(risk.evaluateRisk({...subject,photoHashes:[h1,h2]},context({candidates:[{...own,purpose:'kiralik'}]})).reasons,[]);
 // Burst from a new account; phone reused by other accounts.
 assert.equal(risk.evaluateRisk(subject,context({owner:{createdAt:'2026-11-05T00:00:00.000Z',recentListings:12}})).reasons[0].code,'new_account_burst');
 assert.equal(risk.evaluateRisk(subject,context({owner:{createdAt:'2025-11-05T00:00:00.000Z',recentListings:40}})).reasons.length,0,'established accounts may import many listings');
 assert.equal(risk.evaluateRisk(subject,context({phoneAccounts:2})).reasons[0].params.accounts,2);
});

test('demo and sample listings are never matched',()=>{
 const h=risk.dHashFromGray(gradient);
 const result=risk.evaluateRisk({...subject,photoHashes:[h]},context({candidates:[candidate({id:'ex-1001',photoHashes:[h],title:subject.title,description:subject.description}),candidate({id:'sample-konut-01',photoHashes:[h]})]}));
 assert.deepEqual(result.matches,[]);assert.deepEqual(result.reasons,[]);
});

test('risk data never leaves the server in public listing output',()=>{
 const location=load('lib/listing-location.ts');
 const stored={floorPlan:'',videoUrl:'',tourUrl:'',photoHashes:{'/api/media/listings/a/b.webp':'0123456789abcdef'},riskFlag:'high',risk:{v:1,score:80,level:'high',reasons:[],matches:[],checkedAt:'',signature:[]},location:{precision:'approximate',exact:{lat:41,lng:29}}};
 const shown=location.publicPresentation(stored);
 for(const key of ['risk','riskFlag','photoHashes'])assert.equal(key in shown,false,key);
 assert.deepEqual(shown.location,{precision:'approximate'});assert.equal(shown.floorPlan,'');
 assert.equal('risk' in location.publicPresentation({risk:{score:1}}),false);
 // parseListing (every public API) goes through publicPresentation; the admin view drops the signature.
 assert.match(read('lib/server.ts'),/presentation:publicPresentation\(/);
 const view=risk.adminRiskView(JSON.stringify(stored));assert.equal(view.flag,'high');assert.equal('signature' in view,false);
 assert.equal(risk.adminRiskView('{}'),null);
});

test('review routing: only a high, unreviewed score of a non-admin save goes to review; "Sorun yok" is remembered',()=>{
 const high={v:1,score:80,level:'high',reasons:[{code:'scam_terms',weight:30}],matches:[],checkedAt:NOW.toISOString(),signature:['listing:c','scam_terms']};
 let target={};assert.deepEqual(risk.applyRisk(target,null,high,false),{flag:'high',route:true});assert.equal(target.riskFlag,'high');
 target={};assert.deepEqual(risk.applyRisk(target,null,high,true),{flag:'high',route:false},'administrators publish directly');
 target={};assert.deepEqual(risk.applyRisk(target,null,{...high,score:40,level:'medium'},false),{flag:'medium',route:false});
 target={riskFlag:'high'};assert.deepEqual(risk.applyRisk(target,null,{...high,score:10,level:'low',signature:[]},false),{flag:null,route:false});assert.equal('riskFlag' in target,false);
 const cleared=risk.clearRisk({risk:high,riskFlag:'high',floorPlan:''},{id:'adm',name:'Admin'},NOW.toISOString());
 assert.equal('riskFlag' in cleared,false);assert.deepEqual(cleared.risk.review.keys,high.signature);assert.equal(cleared.floorPlan,'');
 target={};assert.deepEqual(risk.applyRisk(target,cleared,high,false),{flag:null,route:false},'same reasons after review: no flag');assert.ok(target.risk.review);
 target={};assert.deepEqual(risk.applyRisk(target,cleared,{...high,signature:[...high.signature,'listing:d']},false),{flag:'high',route:true},'a new matched listing flags again');
 assert.equal(risk.clearRisk({floorPlan:''},{id:'a',name:'A'},''),null);
});

// Listing POST route with the check stubbed to a given decision (fixture as in individual-direct-publication.test.mjs).
function postRoute(role,decision){
 const id='11111111-1111-4111-8111-111111111111';let savedStatus;const statements=[];let scheduled=0;let assessed=null;
 const database={prepare(sql){const stmt={sql,values:[],bind(...values){this.values=values;return this},async first(){if(sql.includes('SELECT status FROM listings'))return {status:savedStatus};if(sql.includes('SELECT state,company_snapshot'))return {state:'approved',company_snapshot:'Office'};return null}};return stmt;},async batch(items){statements.push(...items);savedStatus=items.find(x=>x.sql.startsWith('INSERT INTO listings')).values[29];}};
 const user={id,role,email_verified:true,agent_status:'approved',company:'Office'};
 const route=load('app/api/listings/route.ts',{'@/lib/company-team-server':{activeTeamCompany:async()=>null},'@/lib/listing-submissions':{submissionTicket:async()=>null},'@/lib/server':{sameOrigin:()=>true,currentUser:async()=>user,isAdmin:()=>role==='admin',db:()=>database,body:r=>r.json(),error:(message,status=400)=>Response.json({error:message},{status}),ok:(data,init)=>Response.json(data,init),str:(v,n)=>typeof v==='string'?v.trim().slice(0,n):'',num:v=>Number(v),now:()=>NOW.toISOString()},'@/lib/listing-policy':{nextIndividualSubmission:()=>NOW.toISOString()},'@/lib/office-verification-server':{officeDB:async()=>{},officePublicationAllowed:async()=>true},'@/lib/agent-plan':{agentPlanAccess:async()=>({allowed:true}),agentInsertGuard:'1=1'},'@/lib/listings':{AMENITIES:[],PUBLIC_DEMO_LISTINGS:[],PROPERTY_TYPES:[{value:'daire'}]},'@/lib/price-filters':{CURRENCIES:['TRY'],TL_ONLY_MESSAGE:'TL',listingCurrencyAllowed:()=>true},'@/lib/listing-details':{validRooms:()=>true},'@/lib/listing-video-server':{videoFeatureEnabled:()=>false},'@/lib/listing-video-store':{},'@/lib/presentation':{presentationFrom:()=>({panoramas:[]})},'@/lib/turkey-locations':{validDistrict:()=>true},'@/lib/turkey-neighborhoods':{findNeighborhood:()=>({id:1,name:'Test'})},'@/lib/external-r2':{headExternalImage:async()=>({contentType:'image/webp',size:10,checksum:'a'.repeat(64),photoHash:'0123456789abcdef'}),externalR2BucketName:()=>'test'},'@/lib/translation-runtime':{scheduleListingTranslations:()=>scheduled++},
  '@/lib/listing-risk-server':{assessListingSave:async(db,input,target,previous,actorIsAdmin)=>{assessed=input;return risk.applyRisk(target,previous,{v:1,score:decision==='high'?85:decision==='medium'?40:0,level:decision,reasons:[],matches:[],checkedAt:NOW.toISOString(),signature:['scam_terms']},actorIsAdmin);}},'@/lib/listing-risk':risk},true);
 const image=`/api/media/listings/${id}/22222222-2222-4222-8222-222222222222.webp`;
 const request=new Request('https://site.test/api/listings',{method:'POST',body:JSON.stringify({title:'Yeterince uzun ilan başlığı',description:'Yeterince uzun test ilan açıklaması burada yer alır.',purpose:'satilik',propertyType:'daire',city:'İzmir',district:'Konak',neighborhoodId:1,price:100,grossArea:100,images:[image]})});
 return {route,request,statements,image,get scheduled(){return scheduled},get assessed(){return assessed}};
}

test('listing POST: a high score sends a non-admin listing to review with the owner note; medium publishes with a flag',async()=>{
 for(const role of ['individual','agent']){
  const f=postRoute(role,'high');const response=await f.route.POST(f.request);assert.equal(response.status,201);
  assert.equal((await response.json()).status,'pending',role);assert.equal(f.scheduled,0);
  const note=f.statements.find(x=>x.sql.includes('SET review_note=?'));assert.equal(note.values[0],'İlanınız kontrol için incelemeye alındı.');
  const presentation=JSON.parse(f.statements.find(x=>x.sql.startsWith('INSERT INTO listings')).values[28]);
  assert.equal(presentation.riskFlag,'high');assert.deepEqual(f.assessed.hashes,{[f.image]:'0123456789abcdef'});assert.deepEqual(f.assessed.checksums,['a'.repeat(64)]);
 }
 const admin=postRoute('admin','high');assert.equal((await (await admin.route.POST(admin.request)).json()).status,'published');assert.equal(admin.statements.some(x=>x.sql.includes('SET review_note=?')),false);
 const medium=postRoute('individual','medium');assert.equal((await (await medium.route.POST(medium.request)).json()).status,'published');
 assert.equal(JSON.parse(medium.statements.find(x=>x.sql.startsWith('INSERT INTO listings')).values[28]).riskFlag,'medium');
});

// SQLite database built from the D1 migrations, as in publication-flow.test.mjs.
function database(){
 const sql=new DatabaseSync(':memory:');
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(read('drizzle/'+file));
 sql.exec('CREATE TABLE IF NOT EXISTS admin_audit(id uuid PRIMARY KEY,actor_id uuid NOT NULL,actor_name TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT NOT NULL,summary TEXT NOT NULL,created_at TEXT NOT NULL)');
 const db={prepare(query){let values=[];return {sql:query,bind(...v){values=v;return this;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){return sql.prepare(query).run(...values);},_run(){return sql.prepare(query).run(...values);}};},async batch(statements){sql.exec('BEGIN');try{for(const s of statements)s._run();sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}}};
 return {sql,db};
}
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function addUser(sql,id,{phone=null,created='2025-01-01T00:00:00.000Z',company=null}={}){sql.prepare("INSERT INTO users(id,email,password_hash,name,phone,role,agent_status,company,created_at) VALUES(?,?,?,?,?,'agent','approved',?,?)").run(id,id+'@x.test','x','User '+id.slice(-2),phone,company,created);}
function addListing(sql,{id,owner,title='Bambaşka bir başlık burada',description='Bahçeli müstakil köy evi, meyve ağaçları ve kuyu suyu var.',price=5000000,area=100,district='Konak',status='published',presentation={},images=[],created='2026-10-01T00:00:00.000Z'}){
 sql.prepare("INSERT INTO listings(id,owner_id,title,description,purpose,property_type,price,currency,city,district,gross_area,amenities,images,translations,presentation,status,featured,created_at,updated_at) VALUES(?,?,?,?,'satilik','daire',?,'TRY','İzmir',?,?,'[]',?,'{}',?,?,0,?,?)").run(id,owner,title,description,price,district,area,JSON.stringify(images),JSON.stringify(presentation),status,created,created);
}

test('server check on SQLite: photo copy + bait price + scam wording → high; admin list, "Sorun yok" with audit, backfill',async()=>{
 const {sql,db}=database();
 const A=uuid(1),B=uuid(2),C=uuid(3);
 addUser(sql,A,{phone:'+905321112233'});addUser(sql,B,{created:'2026-11-05T00:00:00.000Z'});addUser(sql,C,{phone:'+905321112233'});
 const h1=risk.dHashFromGray(gradient),h2=risk.dHashFromGray(other);
 const victim=uuid(100),url=n=>`/api/media/listings/${A}/${uuid(900+n)}.webp`;
 addListing(sql,{id:victim,owner:A,title:'Deniz manzaralı satılık daire Konak',description:'Güney cepheli ferah daire, site içinde havuz ve otopark. Metroya yürüme mesafesinde. Geniş salon, ankastre mutfak, iki banyo ve kapalı balkon. Yeni yapılmış binada asansör, jeneratör ve yirmi dört saat güvenlik bulunuyor. Okullara, hastaneye ve alışveriş merkezine yakın.',presentation:{photoHashes:{[url(1)]:h1,[url(2)]:h2}},images:[url(1),url(2)]});
 // A demo row with the same photos must be ignored even if stored.
 addListing(sql,{id:'ex-1001',owner:A,presentation:{photoHashes:{x:h1,y:h2}}});
 for(let i=0;i<6;i++)addListing(sql,{id:uuid(200+i),owner:C,price:[4800000,5000000,5200000,5500000,4700000,5100000][i],presentation:{photoHashes:{}}});
 const id=uuid(300),mine=[`/api/media/listings/${B}/${uuid(950)}.webp`,`/api/media/listings/${B}/${uuid(951)}.webp`];
 const input={id,ownerId:B,title:'DENIZ MANZARALI SATILIK DAIRE KONAK',description:'Guney cepheli ferah daire, site icinde havuz ve otopark. Metroya yurume mesafesinde. Genis salon, ankastre mutfak, iki banyo ve kapali balkon. Yeni yapilmis binada asansor, jenerator ve yirmi dort saat guvenlik bulunuyor. Okullara, hastaneye ve alisveris merkezine yakin. Yurt disindayim, kapora Western Union ile. Tel 0532 111 22 33',purpose:'satilik',propertyType:'daire',city:'İzmir',district:'Konak',price:1500000,currency:'TRY',grossArea:100,photoHashes:[],checksums:[],images:mine,hashes:{[mine[0]]:flip(h1,[5]),[mine[1]]:flip(h2,[2,40]),'/api/media/other.webp':h1}};
 const target={floorPlan:''};
 const decision=await server.assessListingSave(db,input,target,null,false,NOW);
 assert.deepEqual(decision,{flag:'high',route:true});
 assert.deepEqual(Object.keys(target.photoHashes),mine,'only the listing\'s own photos are kept');
 const codes=target.risk.reasons.map(r=>r.code);
 for(const code of ['photos_other_owner','text_other_owner','price_low','scam_terms','phone_reused'])assert.ok(codes.includes(code),code);
 assert.deepEqual(target.risk.matches.map(m=>m.id),[victim],'demo row and unrelated listings are not matches');
 assert.equal(target.risk.reasons.find(r=>r.code==='phone_reused').params.accounts,2,'description phone belongs to two other accounts');
 addListing(sql,{id,owner:B,title:input.title,description:input.description,price:1500000,status:'pending',presentation:target,images:mine,created:NOW.toISOString()});

 const [item]=await server.suspiciousListings(db);
 assert.equal(item.id,id);assert.equal(item.flag,'high');assert.equal(item.matches[0].listing.title,'Deniz manzaralı satılık daire Konak');assert.deepEqual(item.risk.signature,[]);

 await assert.rejects(server.clearRiskFlag(db,uuid(999),{id:A,name:'Admin'}),/İlan bulunamadı/);
 assert.equal(await server.clearRiskFlag(db,id,{id:A,name:'Admin'},{at:NOW.toISOString()}),true);
 const saved=JSON.parse(sql.prepare('SELECT presentation FROM listings WHERE id=?').get(id).presentation);
 assert.equal(saved.riskFlag,undefined);assert.equal(saved.risk.review.byName,'Admin');assert.equal(sql.prepare('SELECT status FROM listings WHERE id=?').get(id).status,'pending','clearing never changes the status');
 const audit=sql.prepare('SELECT action,target_id,summary FROM admin_audit').all();
 assert.equal(audit.length,1);assert.equal(audit[0].action,'risk_clear');assert.equal(audit[0].target_id,id);assert.match(audit[0].summary,/^Sorun yok · \d+\/100/);
 await assert.rejects(server.clearRiskFlag(db,id,{id:A,name:'Admin'}),/açık bir uyarı yok/);
 assert.deepEqual(await server.suspiciousListings(db),[]);
 // The owner edits again with the same content: the earlier review still covers it.
 const again={floorPlan:''};assert.deepEqual(await server.assessListingSave(db,input,again,saved,false,NOW),{flag:null,route:false});

 // Backfill: old listings without fingerprints, oldest first, demo excluded; status untouched.
 const old=uuid(400),oldUrl=`/api/media/listings/${C}/${uuid(960)}.webp`;
 addListing(sql,{id:old,owner:C,title:'Deniz manzaralı satılık daire Konak',description:'Güney cepheli ferah daire, site içinde havuz ve otopark. Metroya yürüme mesafesinde. Geniş salon, ankastre mutfak, iki banyo ve kapalı balkon. Yeni yapılmış binada asansör, jeneratör ve yirmi dört saat güvenlik bulunuyor. Okullara, hastaneye ve alışveriş merkezine yakın.',images:[oldUrl],created:'2026-01-01T00:00:00.000Z'});
 sql.prepare("UPDATE listings SET presentation='{}' WHERE id='ex-1001'").run();
 const queue=await server.backfillQueue(db,50);
 assert.deepEqual(queue.items.map(i=>i.id),[old]);assert.deepEqual(queue.items[0].images,[oldUrl]);assert.equal(queue.remaining,1);
 const stored=await server.storeBackfill(db,old,{[oldUrl]:h1,'/api/media/not-mine.webp':h2},NOW);
 assert.equal(stored.photos,1);assert.equal(stored.flag,'medium');
 const row=sql.prepare('SELECT status,presentation FROM listings WHERE id=?').get(old);assert.equal(row.status,'published');
 assert.equal(JSON.parse(row.presentation).riskFlag,'medium');assert.deepEqual((await server.backfillQueue(db,50)).items,[]);
 await assert.rejects(server.storeBackfill(db,'ex-1001',{}),/İlan bulunamadı/);
});

test('admin risk API is admin-only and validates actions',async()=>{
 const calls=[];
 const route=load('app/api/admin/risk/route.ts',{'@/lib/server':{sameOrigin:()=>true,currentUser:async r=>r.headers.get('x-role')?{id:'a',name:'A',email_verified:1,role:r.headers.get('x-role'),admin_2fa_pending:r.headers.get('x-2fa')==='1'}:null,isAdmin:u=>Boolean(u&&!u.admin_2fa_pending&&u.role==='admin'),db:()=>({}),body:r=>r.json(),error:(message,status=400)=>Response.json({error:message},{status}),ok:(v,init)=>Response.json(v,init),str:(v,n)=>typeof v==='string'?v.trim().slice(0,n):''},'@/lib/reports-server':{reportsDB:async()=>{}},'@/lib/listing-risk-server':{...server,suspiciousListings:async()=>[],backfillQueue:async()=>({items:[],remaining:0}),clearRiskFlag:async(db,id,admin)=>{calls.push(['clear',id,admin.id]);return true;},storeBackfill:async(db,id,hashes)=>{calls.push(['fingerprints',id,hashes]);return {flag:null,photos:0};}}});
 const req=(method,role,body,extra={})=>new Request('https://site.test/api/admin/risk'+(extra.query||''),{method,headers:{...(role?{'x-role':role}:{}),...(extra.twofa?{'x-2fa':'1'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await route.GET(req('GET',null))).status,403);assert.equal((await route.GET(req('GET','agent'))).status,403);assert.equal((await route.GET(req('GET','admin',null,{twofa:true}))).status,403);
 const list=await route.GET(req('GET','admin'));assert.equal(list.status,200);assert.equal(list.headers.get('Cache-Control'),'private, no-store');
 assert.equal((await route.POST(req('POST','agent',{action:'clear',id:uuid(1)}))).status,403);
 assert.equal((await route.POST(req('POST','admin',{action:'clear',id:'nope'}))).status,404);
 assert.equal((await route.POST(req('POST','admin',{action:'delete',id:uuid(1)}))).status,400,'there is no delete action');
 assert.equal((await route.POST(req('POST','admin',{action:'clear',id:uuid(1)}))).status,200);
 assert.equal((await route.POST(req('POST','admin',{action:'fingerprints',id:uuid(2),hashes:['x']}))).status,200);
 assert.deepEqual(calls,[['clear',uuid(1),'a'],['fingerprints',uuid(2),{}]]);
});
