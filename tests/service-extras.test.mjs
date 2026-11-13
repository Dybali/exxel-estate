import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url),cache=new Map();
function load(file){const full=path.resolve(root,file);if(cache.has(full))return cache.get(full);const m={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(name.startsWith('.')||name.startsWith('@/')){const p=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return p.endsWith('.json')?JSON.parse(readFileSync(p,'utf8')):load(p+'.ts');}return native(name);},m,m.exports);cache.set(full,m.exports);return m.exports;}
const S=load('lib/services.ts'),X=load('lib/service-extras.ts'),Q=load('lib/service-search.ts');

// Service directory phase 2 (lib/service-extras.ts): working information, documents, statistics, quotes.
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',customer='44444444-4444-4444-8444-444444444444',admin='33333333-3333-4333-8333-333333333333';
const photo=user=>`/api/media/listings/${user}/${crypto.randomUUID()}.webp`;
function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT);CREATE TABLE property_images(object_key TEXT)");
 const db={prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}};
 return {sql,db};
}
const firmInput=(user,extra={})=>({name:'Deniz Boya Dekorasyon',description:'Bodrum ve Milas’ta iç ve dış cephe boyası, badana ve alçı işleri yapıyoruz. 15 yıllık deneyim.',
 categories:['boyaci-badanaci'],areas:[{city:'Muğla',district:'Bodrum'}],phone:'0532 123 45 67',logo:photo(user),photos:[],terms:true,...extra});
async function approvedFirm(db,user,extra){const {id}=await S.createFirm(db,{id:user,admin:false},firmInput(user,extra));await S.reviewFirm(db,admin,id,'approve','');return id;}
const rejects=(promise,status,pattern)=>assert.rejects(promise,e=>e instanceof S.ServiceError&&e.status===status&&(!pattern||pattern.test(e.message)));
const quote=(extra={})=>({name:'Elif Yılmaz',email:'elif@example.test',phone:'0533 765 43 21',shareContact:false,category:'boyaci-badanaci',city:'Muğla',district:'Bodrum',description:'3+1 daire, yaklaşık 110 m², tavanlar dahil iç cephe boyası.',timing:'asap',consent:true,...extra});

test('working information: hours, emergency and price range are validated and shown as open/closed in Istanbul time',async()=>{
 const week=[['09:00','18:00'],['09:00','18:00'],['09:00','18:00'],['09:00','18:00'],['09:00','18:00'],['10:00','14:00'],null];
 const details=X.validateDetails({hours:week,emergency:false,priceMin:'80',priceMax:120,priceUnit:'m2',priceNote:'  malzeme   hariç '});
 assert.deepEqual(details,{hours:week,emergency:false,priceMin:80,priceMax:120,priceUnit:'m2',priceNote:'malzeme hariç'});
 assert.equal(X.validateDetails({}).hours.length,0,'no hours given');
 assert.equal(X.validateDetails({priceUnit:'bogus'}).priceUnit,'job');
 for(const bad of [{hours:[['09:00','18:00']]},{hours:Array(7).fill(['18:00','09:00'])},{hours:Array(7).fill(['9:00','18:00'])},{hours:Array(7).fill(['24:00','24:00'])},{priceMin:0},{priceMin:1.5},{priceMax:10},{priceMin:200,priceMax:100},{priceNote:'x'.repeat(201)}])
  assert.throws(()=>X.validateDetails(bad),S.ServiceError,JSON.stringify(bad));
 // 2026-11-09 is a Monday; 06:30 UTC = 09:30 in Istanbul.
 assert.deepEqual(X.istanbulClock(new Date('2026-11-09T06:30:00Z')),{day:0,minute:570});
 assert.equal(X.openNow(details,new Date('2026-11-09T06:30:00Z')),true);
 assert.equal(X.openNow(details,new Date('2026-11-09T15:00:00Z')),false,'18:00 closes');
 assert.equal(X.openNow(details,new Date('2026-11-15T09:00:00Z')),false,'Sunday closed');
 assert.equal(X.openNow({...details,emergency:true},new Date('2026-11-15T01:00:00Z')),true,'7/24 is always open');
 assert.equal(X.openNow({hours:[],emergency:false}),null);
 assert.equal(X.openNow({hours:Array(7).fill(['00:00','24:00']),emergency:false},new Date('2026-11-09T20:59:00Z')),true,'until midnight');

 const {db}=fixture(),firm=await approvedFirm(db,owner);
 assert.deepEqual(await X.firmDetails(db,firm),X.EMPTY_SERVICE_DETAILS);
 await X.saveDetails(db,firm,{hours:week,emergency:true,priceMin:500});
 const saved=await X.firmDetails(db,firm);assert.equal(saved.emergency,true);assert.equal(saved.priceMin,500);assert.deepEqual(saved.hours,week);
 // The emergency flag is a card badge and a search filter; saving never sends the firm back to review.
 const [card]=(await S.searchFirms(db,{emergency:true})).firms;assert.equal(card.id,firm);assert.equal(card.emergency,true);assert.equal(card.documented,false);
 assert.equal((await S.firmById(db,firm)).status,'approved');
 assert.equal((await S.searchFirms(db,{documented:true})).total,0);
});

test('documents: limit, owner-only rows, admin review gives the documented badge; deleting the firm returns storage keys',async()=>{
 const {db}=fixture(),firm=await approvedFirm(db,owner);
 const file=(kind='tax')=>({id:crypto.randomUUID(),kind,objectKey:`private/service-documents/${firm}/${crypto.randomUUID()}.pdf`,contentType:'application/pdf',size:2048});
 await rejects(X.addDocument(db,firm,file('passport')),400,/türünü/);
 const first=await X.addDocument(db,firm,file());assert.equal(first.state,'pending');
 for(let i=1;i<X.SERVICE_DOCUMENT_LIMIT;i++)await X.addDocument(db,firm,file('other'));
 await rejects(X.addDocument(db,firm,file()),409,/8 belge/);
 const row=await X.documentRow(db,first.id);assert.equal(row.ownerId,owner);assert.equal(row.firmId,firm);assert.match(row.objectKey,/^private\/service-documents\//);
 assert.equal(await X.documentRow(db,'not-a-uuid'),null);
 // Another firm cannot delete it.
 const otherFirm=await approvedFirm(db,other);
 await rejects(X.deleteDocument(db,otherFirm,first.id),404);
 await rejects(X.reviewDocument(db,admin,first.id,false,'x'),400,/nedenini/);
 const rejected=await X.reviewDocument(db,admin,first.id,false,'Belge okunmuyor, daha net bir tarama yükleyin.');assert.equal(rejected.state,'rejected');
 assert.equal((await S.firmById(db,firm)).documented,false);
 await X.reviewDocument(db,admin,first.id,true,'');
 assert.equal((await S.firmById(db,firm)).documented,true);
 assert.equal((await S.searchFirms(db,{documented:true})).firms[0].id,firm);
 const docs=(await X.documentsOf(db,[firm,otherFirm]));assert.equal(docs.get(firm).length,8);assert.equal(docs.get(otherFirm).length,0);
 const key=await X.deleteDocument(db,firm,(await X.firmDocuments(db,firm)).find(d=>d.state==='pending').id);assert.match(key,/\.pdf$/);
 const removed=await S.deleteFirm(db,{id:owner,admin:false},firm);
 assert.equal(removed.documentKeys.length,7);
 assert.equal((await X.firmDocuments(db,firm)).length,0);
});

test('statistics: only approved firms are counted, per Istanbul day, with the previous period for comparison',async()=>{
 const {db,sql}=fixture(),firm=await approvedFirm(db,owner);
 const at=new Date('2026-11-09T21:30:00Z');// 00:30 on 10 November in Istanbul
 assert.equal(await X.trackFirm(db,firm,'view',at),true);
 await X.trackFirm(db,firm,'view',at);await X.trackFirm(db,firm,'phone',at);
 assert.equal(await X.trackFirm(db,firm,'offer',at),false,'server-only kind');
 assert.equal(await X.trackFirm(db,'nope','view',at),false);
 assert.deepEqual(sql.prepare("SELECT day,kind,n FROM service_firm_stats ORDER BY kind").all().map(r=>({...r})),[{day:'2026-11-10',kind:'phone',n:1},{day:'2026-11-10',kind:'view',n:2}]);
 await X.countStat(db,firm,'view',new Date('2026-10-01T10:00:00Z'),5);// previous 30-day window
 const stats=await X.firmStats(db,firm,30,at);
 assert.equal(stats.totals.view,2);assert.equal(stats.totals.phone,1);assert.equal(stats.previous.view,5);
 assert.equal(stats.daily.length,30);assert.equal(stats.daily.at(-1).day,'2026-11-10');assert.deepEqual(stats.daily.at(-1),{day:'2026-11-10',views:2,contacts:1,searches:0});
 await S.reviewFirm(db,admin,firm,'suspend','Şikâyet inceleniyor.');
 assert.equal(await X.trackFirm(db,firm,'view',at),false,'suspended firms are not counted');
});

test('quote requests: validation, matching firms, one firm directly, daily limit, offers, acceptance and contact sharing',async()=>{
 const {db}=fixture();
 const painter=await approvedFirm(db,owner,{areas:[{city:'Muğla',district:''}]});// whole province
 const other1=await approvedFirm(db,other,{categories:['temizlik']});
 const own=await approvedFirm(db,customer,{name:'Elif Boya',categories:['boyaci-badanaci']});// the customer's own firm is never a recipient
 for(const [extra,pattern] of [[{consent:false},/onaylayın/],[{description:'kısa'},/20/],[{category:'nope'},/kategorisini/],[{city:'Atlantis'},/il ve ilçeyi/],[{email:'x'},/e-posta/],[{name:''},/Adınızı/],[{phone:'12'},/telefon/],[{firmId:'nope'},/bulunamadı/]])
  await rejects(X.createQuoteRequest(db,customer,quote(extra)),extra.firmId?404:400,pattern);
 await rejects(X.createQuoteRequest(db,customer,quote({category:'havuz-bakimi'})),404,/henüz kayıtlı firma yok/);
 const at=new Date('2026-11-09T08:00:00Z');
 const made=await X.createQuoteRequest(db,customer,quote(),at);
 assert.deepEqual(made.recipients.map(r=>r.id),[painter],'district request reaches the province-wide painter, not the cleaner or the own firm');
 assert.equal(made.request.shareContact,false);
 // Directly from a profile: only that firm, even outside the matching rules.
 const direct=await X.createQuoteRequest(db,customer,quote({firmId:other1,category:'temizlik'}),at);
 assert.deepEqual(direct.recipients.map(r=>r.id),[other1]);
 await rejects(X.createQuoteRequest(db,customer,quote({firmId:own})),400,/Kendi firmanızdan/);
 for(let i=0;i<3;i++)await X.createQuoteRequest(db,customer,quote(),at);
 await rejects(X.createQuoteRequest(db,customer,quote(),at),429,/5 teklif/);
 assert.equal((await X.firmStats(db,painter,30,at)).totals.quote,4);

 // Firm inbox: the name always, contact details only when shared; opening marks requests as seen.
 assert.equal(await X.unseenQuotes(db,painter),4);
 const inbox=await X.firmInbox(db,painter,at);
 assert.equal(inbox.length,4);assert.equal(inbox[0].name,'Elif Yılmaz');assert.equal(inbox[0].phone,null);assert.equal(inbox[0].email,null);assert.equal(inbox[0].state,'new');
 assert.equal(await X.unseenQuotes(db,painter),0);
 // Offers: only recipients, valid prices, once.
 await rejects(X.sendOffer(db,other1,{requestId:made.id,priceMin:1000,message:'Haftaya başlayabiliriz.'},at),404);
 await rejects(X.sendOffer(db,painter,{requestId:made.id,priceMin:0,message:'Haftaya başlayabiliriz.'},at),400,/tam sayı/);
 await rejects(X.sendOffer(db,painter,{requestId:made.id,priceMin:500,priceMax:400,message:'Haftaya başlayabiliriz.'},at),400);
 await rejects(X.sendOffer(db,painter,{requestId:made.id,priceMin:500,message:'kısa'},at),400,/10 ile 1500/);
 const offer=await X.sendOffer(db,painter,{requestId:made.id,priceMin:18000,priceMax:22000,message:'Malzeme dahil, 3 günde teslim. Keşif ücretsiz.'},new Date('2026-11-09T10:00:00Z'));
 assert.equal(offer.userId,customer);
 await rejects(X.sendOffer(db,painter,{requestId:made.id,priceMin:17000,message:'İkinci teklif denemesi.'},at),409,/zaten/);
 await rejects(X.declineQuote(db,painter,made.id,at),409);
 // The customer sees the offer with the firm's public contact and badges.
 let mine=await X.myQuoteRequests(db,customer,at);
 const view=mine.find(r=>r.id===made.id);
 assert.equal(view.status,'open');assert.equal(view.recipients,1);assert.equal(view.seen,1);
 assert.equal(view.offers.length,1);assert.equal(view.offers[0].priceMin,18000);assert.equal(view.offers[0].firmName,'Deniz Boya Dekorasyon');assert.equal(view.offers[0].firmPhone,'+905321234567');
 // Only the owner of the request can accept; accepting settles it and reveals the customer's contact to the firm.
 await rejects(X.acceptOffer(db,other,view.offers[0].id,at),404);
 const accepted=await X.acceptOffer(db,customer,view.offers[0].id,at);
 assert.equal(accepted.ownerId,owner);assert.equal(accepted.customerName,'Elif Yılmaz');
 mine=await X.myQuoteRequests(db,customer,at);
 assert.equal(mine.find(r=>r.id===made.id).status,'accepted');assert.equal(mine.find(r=>r.id===made.id).offers[0].state,'accepted');
 const after=(await X.firmInbox(db,painter,at)).find(r=>r.requestId===made.id);
 assert.equal(after.email,'elif@example.test');assert.equal(after.phone,'+905337654321');
 await rejects(X.acceptOffer(db,customer,view.offers[0].id,at),409,/açık değil/);
 await rejects(X.sendOffer(db,painter,{requestId:made.id,priceMin:1,message:'Kapalı talebe teklif.'},at),409);
 // Closing and expiry.
 const another=mine.find(r=>r.id!==made.id&&r.status==='open'&&r.firmId===null);
 await X.closeQuoteRequest(db,customer,another.id);
 assert.equal((await X.myQuoteRequests(db,customer,at)).find(r=>r.id===another.id).status,'closed');
 await rejects(X.closeQuoteRequest(db,other,another.id),404);
 const later=new Date(at.getTime()+31*86400_000);
 assert.ok((await X.myQuoteRequests(db,customer,later)).filter(r=>r.status==='open').length===0,'requests expire after 30 days');
 await rejects(X.sendOffer(db,painter,{requestId:(await X.myQuoteRequests(db,customer,at)).find(r=>r.status==='open'&&r.firmId===null).id,priceMin:100,message:'Süresi dolmuş talep.'},later),409);
 // Shared contact is visible at once.
 const shared=await X.createQuoteRequest(db,other,quote({name:'Can',email:'can@example.test',shareContact:true}),at);
 const sharedView=(await X.firmInbox(db,painter,at)).find(r=>r.requestId===shared.id);
 assert.equal(sharedView.phone,'+905337654321');assert.equal(sharedView.email,'can@example.test');
 // Deleting a firm removes its recipient rows and offers; the member's requests stay.
 await S.deleteFirm(db,{id:owner,admin:false},painter);
 assert.equal((await X.myQuoteRequests(db,customer,at)).find(r=>r.id===made.id).offers.length,0);
});

test('response time: median hours between receiving a request and the offer, from 3 answers',async()=>{
 const {db}=fixture(),firm=await approvedFirm(db,owner,{areas:[{city:'Muğla',district:''}]});
 const start=new Date('2026-11-01T08:00:00Z');
 const answer=async(user,hours)=>{const made=await X.createQuoteRequest(db,user,quote({name:'Müşteri',email:`${user.slice(0,4)}@example.test`}),start);await X.sendOffer(db,firm,{requestId:made.id,priceMin:1000,message:'Teklifimiz ektedir, teşekkürler.'},new Date(start.getTime()+hours*3600_000));};
 await answer(customer,2);await answer(other,5);
 assert.equal(await X.responseHours(db,firm,new Date('2026-11-09T00:00:00Z')),null,'needs 3 answers');
 await answer(admin,30);
 assert.equal(await X.responseHours(db,firm,new Date('2026-11-09T00:00:00Z')),5);
});

test('quote and search addresses',()=>{
 assert.equal(S.quoteHref(),'/hizmetler/teklif-iste');
 assert.equal(S.quoteHref({category:'boyaci-badanaci',city:'Muğla',district:'Bodrum'}),'/hizmetler/teklif-iste?kategori=boyaci-badanaci&il=mugla&ilce=bodrum');
 assert.equal(S.quoteHref({category:'nope',city:'Atlantis'}),'/hizmetler/teklif-iste');
 assert.equal(S.quoteHref({firmId:owner}),`/hizmetler/teklif-iste?firma=${owner}`);
 const filters=Q.parseServiceFilters(new URLSearchParams('kategori=tesisatci&acil=1&belgeli=1'));
 assert.equal(filters.emergency,true);assert.equal(filters.documented,true);
 assert.equal(Q.isCanonicalServiceScope(filters),false);
 assert.equal(Q.serviceSearchHref(filters),'/hizmetler/ara?kategori=tesisatci&belgeli=1&acil=1');
 assert.equal(Q.serviceQuery(filters).emergency,true);
});

test('firm statistics: search appearances and requests are counted but are not contact clicks; contractors share the counters',async()=>{
 const F=load('lib/firm-stats.ts');const {DatabaseSync}=await import('node:sqlite');const sql=new DatabaseSync(':memory:');
 const db={prepare(q){return {values:[],bind(...v){this.values=v;return this;},async first(){return sql.prepare(q).get(...this.values)||null;},async all(){return {results:sql.prepare(q).all(...this.values)};},async run(){return sql.prepare(q).run(...this.values);}};}};
 sql.exec(F.firmStatsSchema('contractor_firm_stats'));
 const at=new Date('2026-11-13T10:00:00Z');
 for(const [kind,n] of [['search',12],['view',4],['phone',2],['request',1]])await F.countFirmStat(db,'contractor_firm_stats','f1',kind,at,n);
 const stats=await F.firmDailyStats(db,'contractor_firm_stats',['view','search','phone','request'],'f1',7,at);
 assert.deepEqual(stats.totals,{view:4,search:12,phone:2,request:1});
 assert.deepEqual(stats.daily.at(-1),{day:'2026-11-13',views:4,contacts:2,searches:12});
});
