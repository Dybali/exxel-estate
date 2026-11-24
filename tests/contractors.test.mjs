import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url),cache=new Map();
function load(file){const full=path.resolve(root,file);if(cache.has(full))return cache.get(full);const m={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(name.startsWith('.')||name.startsWith('@/')){const p=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return p.endsWith('.json')?JSON.parse(readFileSync(p,'utf8')):load(p+'.ts');}return native(name);},m,m.exports);cache.set(full,m.exports);return m.exports;}
const C=load('lib/contractors.ts');
const {CONTRACTOR_SAMPLE_FIRMS,matchSampleContractors,contractorSamplesEnabled}=load('lib/contractor-samples.ts');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333',land='44444444-4444-4444-8444-444444444444';
const me={id:owner,admin:false},them={id:other,admin:false};
const photo=(user=owner)=>`/api/media/listings/${user}/${crypto.randomUUID()}.webp`;
function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT);CREATE TABLE property_images(object_key TEXT)");
 const db={prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}};
 return {sql,db};
}
const valid=(user=owner,extra={})=>({name:'Kuzey Yapı İnşaat',description:'İzmir ve Manisa’da konut ve villa projeleri geliştiriyoruz; kat karşılığı arsa değerlendiriyoruz.',
 specialties:['konut','villa'],areas:[{city:'İzmir',district:''},{city:'Manisa',district:'Turgutlu'},{city:'İzmir',district:'Bornova'}],phone:'0532 123 45 67',email:'info@kuzey.example',website:'https://kuzey.example/',
 foundedYear:'2010',licenseNumber:'35.1234/A',logo:photo(user),cover:null,landDeals:true,terms:true,
 projects:[{title:'Kuzey Bahçe Evleri',city:'İzmir',district:'Bornova',year:2022,kind:'konut',units:'24',description:'24 daire',photos:[photo(user)]}],...extra});
const rejects=(promise,status,pattern)=>assert.rejects(promise,e=>e instanceof C.ContractorError&&e.status===status&&(!pattern||pattern.test(e.message)));
const request=(extra={})=>({city:'İzmir',district:'Bornova',areaM2:'850',zoning:'konut',emsal:'1,2',expectedShare:'50',description:'Bornova’da köşe parsel, iki yola cepheli, imar durumu konut.',name:'Mehmet',email:'mehmet@example.test',phone:'',shareContact:false,...extra});
async function approved(db,user=owner,extra={}){const saved=await C.saveContractor(db,{id:user,admin:false},valid(user,extra));await C.reviewContractor(db,admin,saved.id,'approve','');return saved.id;}

test('a new profile waits for review, is private until approved and stores areas and completed projects',async()=>{const {db}=fixture();
 const saved=await C.saveContractor(db,me,valid());assert.equal(saved.status,'pending');assert.equal(saved.created,true);
 assert.equal(await C.contractorById(db,saved.id),null);
 const mine=await C.ownerContractor(db,owner);assert.equal(mine.licenseNumber,'35.1234/A');assert.equal(mine.foundedYear,2010);
 // A whole province covers its districts.
 assert.deepEqual(mine.areas,[{city:'İzmir',district:''},{city:'Manisa',district:'Turgutlu'}]);
 assert.equal(mine.projects.length,1);assert.equal(mine.projects[0].units,24);
 await C.reviewContractor(db,admin,saved.id,'approve','');const pub=await C.contractorById(db,saved.id);assert.equal(pub.status,'approved');assert.equal(pub.ownerId,undefined);assert.equal(pub.taxNumber,undefined);
 assert.equal((await C.contractorStats(db)).projects,1);
});
test('validation rejects bad fields, foreign photos and a second firm per member',async()=>{const {db}=fixture();
 await rejects(C.saveContractor(db,me,valid(owner,{specialties:[]})),400,/uzmanlık/);
 await rejects(C.saveContractor(db,me,valid(owner,{foundedYear:'1800'})),400,/Kuruluş yılı/);
 await rejects(C.saveContractor(db,me,valid(owner,{licenseNumber:'<script>'})),400,/Yetki belgesi/);
 await rejects(C.saveContractor(db,me,valid(owner,{logo:photo(other)})),403);
 await rejects(C.saveContractor(db,me,valid(owner,{projects:[{title:'X',city:'İzmir',district:'',year:2020,kind:'konut'}]})),400,/proje adı/);
 await rejects(C.saveContractor(db,me,valid(owner,{terms:false})),400,/onaylayın/);
 const logo=photo();await C.saveContractor(db,me,valid(owner,{logo}));
 // Saving again edits the member's one firm.
 const second=await C.saveContractor(db,me,valid(owner,{name:'Kuzey Yapı Ltd.'}));assert.equal(second.created,false);
});
test('an owner edit goes back to review, a changed licence drops the verified badge, removed photos are returned',async()=>{const {db}=fixture();
 const id=await approved(db);await C.reviewContractor(db,admin,id,'verify','');
 const keep=await C.ownerContractor(db,owner);
 const edit=await C.saveContractor(db,me,{...valid(owner,{logo:keep.logo,projects:[]}),licenseNumber:'35.9999/B'});
 assert.equal(edit.status,'pending');assert.equal(edit.removedKeys.length,1);
 const mine=await C.ownerContractor(db,owner);assert.equal(mine.verified,false);
 await rejects(C.reviewContractor(db,admin,id,'reject',''),400,/nedenini/);
 await C.reviewContractor(db,admin,id,'suspend','Belge eksik');const suspended=await C.saveContractor(db,me,{...valid(owner,{logo:keep.logo,projects:[]}),licenseNumber:'35.9999/B'});assert.equal(suspended.status,'suspended');
});
test('verification needs a licence number; search filters by province, specialty, land deals, verified and text',async()=>{const {db}=fixture();
 const a=await approved(db,owner);const b=await approved(db,other,{name:'Marmara Restorasyon',description:'İstanbul’da tarihi yapı restorasyonu ve güçlendirme işleri yapıyoruz, yirmi yıllık deneyim.',specialties:['restorasyon'],areas:[{city:'İstanbul',district:''}],licenseNumber:'',landDeals:false,projects:[]});
 await rejects(C.reviewContractor(db,admin,b,'verify',''),400,/Yetki belgesi/);await C.reviewContractor(db,admin,a,'verify','');
 assert.equal((await C.searchContractors(db,{city:'İzmir'})).total,1);
 assert.equal((await C.searchContractors(db,{specialty:'restorasyon'})).firms[0].id,b);
 assert.equal((await C.searchContractors(db,{landDeals:true})).total,1);
 assert.equal((await C.searchContractors(db,{verified:true})).firms[0].id,a);
 assert.equal((await C.searchContractors(db,{q:'RESTORASYON'})).total,1);
 assert.equal((await C.searchContractors(db,{q:"%' OR 1=1 --"})).total,0);
 assert.equal((await C.searchContractors(db,{sort:'az'})).firms[0].id,a);
 assert.equal((await C.contractorSitemapEntries(db)).length,2);
});
test('land request: matched to contractors in the area, offers, acceptance reveals contact, limits apply',async()=>{const {db}=fixture();
 const firm=await approved(db,owner);
 // No contractor in Ankara: nothing is saved.
 await rejects(C.createLandRequest(db,land,request({city:'Ankara',district:''})),409,/henüz yok/);
 const created=await C.createLandRequest(db,land,request());assert.deepEqual(created.recipients.map(r=>r.id),[firm]);
 // The contractor sees the request without contact details.
 const inbox=await C.contractorInbox(db,owner);assert.equal(inbox.requests.length,1);assert.equal(inbox.requests[0].email,undefined);assert.equal(inbox.requests[0].emsal,'1.2');
 assert.equal(await C.newLandRequestCount(db,owner),0);
 await rejects(C.sendLandOffer(db,owner,created.id,{ownerShare:'150',deliveryMonths:'24',message:'Yüzde elli pay ile.'}),400,/pay/);
 const offer=await C.sendLandOffer(db,owner,created.id,{ownerShare:'55',deliveryMonths:'30',message:'Arsa sahibine yüzde 55 pay, 30 ayda teslim.'});assert.equal(offer.requestUserId,land);
 await rejects(C.sendLandOffer(db,owner,created.id,{ownerShare:'56',deliveryMonths:'30',message:'İkinci teklif denemesi.'}),409);
 // Strangers cannot offer or accept.
 await rejects(C.sendLandOffer(db,other,created.id,{ownerShare:'60',deliveryMonths:'20',message:'Firmam yok ama deniyorum.'}),403);
 await rejects(C.acceptLandOffer(db,other,offer.id),404);
 const mine=await C.myLandRequests(db,land);assert.equal(mine[0].offers[0].ownerShare,55);assert.equal(mine[0].recipients,1);
 const accepted=await C.acceptLandOffer(db,land,offer.id);assert.equal(accepted.firmOwnerId,owner);
 const after=await C.contractorInbox(db,owner);assert.equal(after.requests[0].email,'mehmet@example.test');assert.equal(after.requests[0].status,'accepted');
 await rejects(C.acceptLandOffer(db,land,offer.id),409);
 // The contractor cannot send to its own firm; three requests a day at most.
 await rejects(C.createLandRequest(db,owner,request({firmId:firm})),400,/Kendi/);
 await C.createLandRequest(db,land,request());await C.createLandRequest(db,land,request());
 await rejects(C.createLandRequest(db,land,request()),429);
});
test('land requests expire after 30 days and can be closed; validation of the plot',async()=>{const {db}=fixture();
 await approved(db,owner);const start=new Date('2026-11-01T10:00:00Z');
 const created=await C.createLandRequest(db,land,request({shareContact:true}),start);
 assert.equal((await C.contractorInbox(db,owner,start)).requests[0].email,'mehmet@example.test');
 const later=new Date('2026-12-05T10:00:00Z');assert.equal((await C.myLandRequests(db,land,later))[0].status,'expired');
 await rejects(C.sendLandOffer(db,owner,created.id,{ownerShare:'50',deliveryMonths:'24',message:'Geç kalan bir teklif.'},later),409);
 const fresh=await C.createLandRequest(db,land,request(),later);await C.closeLandRequest(db,land,fresh.id);assert.equal((await C.myLandRequests(db,land,later))[0].status,'closed');
 for(const extra of [{areaM2:'10'},{zoning:'x'},{emsal:'abc'},{expectedShare:'0'},{description:'kısa'},{email:'x'},{city:'Atlantis'}])await rejects(C.createLandRequest(db,land,request(extra),later),400);
});
test('deleting a firm removes its areas, projects, recipient rows and offers and returns its photos',async()=>{const {db,sql}=fixture();
 const id=await approved(db);const created=await C.createLandRequest(db,land,request());await C.sendLandOffer(db,owner,created.id,{ownerShare:'50',deliveryMonths:'24',message:'Arsa sahibine yarı pay.'});
 await rejects(C.deleteContractor(db,them,id),403);const removed=await C.deleteContractor(db,me,id);assert.equal(removed.imageKeys.length,2);
 for(const table of ['contractor_firms','contractor_areas','contractor_projects','land_request_recipients','land_offers'])assert.equal(sql.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM land_requests').get().n,1);
});
test('media of approved firms is public; samples are labelled, filtered and switchable',async()=>{const {db}=fixture();
 const id=await approved(db);const firm=await C.contractorById(db,id);
 assert.equal(await C.contractorMediaPublic(db,firm.logo.slice('/api/media/'.length)),true);
 assert.equal(await C.contractorMediaPublic(db,firm.projects[0].photos[0].slice('/api/media/'.length)),true);
 assert.equal(await C.contractorMediaPublic(db,`listings/${owner}/${crypto.randomUUID()}.webp`),false);
 assert.ok(CONTRACTOR_SAMPLE_FIRMS.every(f=>f.sample&&f.id.startsWith('sample-')&&!f.phone&&!C.validContractorId(f.id)));
 assert.equal(matchSampleContractors(CONTRACTOR_SAMPLE_FIRMS,{city:'İzmir'}).length,1);assert.equal(matchSampleContractors(CONTRACTOR_SAMPLE_FIRMS,{verified:true}).length,0);
 assert.equal(contractorSamplesEnabled(undefined),true);assert.equal(contractorSamplesEnabled('0'),false);
});
test('construction request ("Benim için müteahhit bul"): every firm in the area, matching specialty first, TL offers, cheapest first',async()=>{const {db}=fixture();
 // A firm without land deals still gets construction requests; the villa builder comes first for a villa.
 const general=await approved(db,other,{name:'Bornova Restorasyon',specialties:['restorasyon'],landDeals:false,projects:[]});
 const villa=await approved(db,owner);
 const build=(extra={})=>request({kind:'build',work:'ev',areaM2:'400',zoning:'',emsal:'9',expectedShare:'70',budgetMin:'3.000.000',budgetMax:'5000000',description:'Bornova’da 400 m² arsaya iki katlı 4+1 villa, anahtar teslim.',...extra});
 await rejects(C.createLandRequest(db,land,build({work:'uzay'})),400,/işi seçin/);
 await rejects(C.createLandRequest(db,land,build({budgetMin:'9000000'})),400,/Bütçe/);
 await rejects(C.createLandRequest(db,land,build({areaM2:'5'})),400,/Alan/);
 const created=await C.createLandRequest(db,land,build());assert.equal(created.kind,'build');assert.deepEqual(created.recipients.map(r=>r.id),[villa,general]);assert.match(created.summary,/villa/);
 // A land deal still only reaches firms that accept them.
 assert.deepEqual((await C.createLandRequest(db,land,request())).recipients.map(r=>r.id),[villa]);
 const seen=(await C.contractorInbox(db,other)).requests[0];assert.equal(seen.kind,'build');assert.equal(seen.work,'ev');assert.equal(seen.budgetMin,3000000);assert.equal(seen.emsal,null);assert.equal(seen.expectedShare,null);assert.equal(seen.zoning,'bilinmiyor');
 await rejects(C.sendLandOffer(db,other,created.id,{deliveryMonths:'12',message:'Fiyat yazmadan teklif.'}),400,/TL/);
 await rejects(C.sendLandOffer(db,other,created.id,{priceMin:'5000000',priceMax:'4000000',deliveryMonths:'12',message:'Ters aralık denemesi.'}),400,/En yüksek/);
 const high=await C.sendLandOffer(db,other,created.id,{priceMin:'5200000',deliveryMonths:'14',message:'Malzeme ve işçilik dahil.'});assert.equal(high.kind,'build');assert.equal(high.priceMin,5200000);
 await C.sendLandOffer(db,owner,created.id,{priceMin:'4.400.000',priceMax:'4900000',deliveryMonths:'11',message:'Proje ve ruhsat dahil, anahtar teslim.'});
 const mine=(await C.myLandRequests(db,land)).find(r=>r.id===created.id);assert.deepEqual(mine.offers.map(o=>o.priceMin),[4400000,5200000]);assert.equal(mine.offers[0].priceMax,4900000);
 assert.equal((await C.contractorInbox(db,owner)).requests.find(r=>r.id===created.id).offer.priceMin,4400000);
 const accepted=await C.acceptLandOffer(db,land,mine.offers[0].id);assert.equal(accepted.firmOwnerId,owner);
});
test('older databases get the construction columns added on first use',async()=>{const {db,sql}=fixture();
 sql.exec("CREATE TABLE land_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT,share_contact INTEGER NOT NULL DEFAULT 0,city TEXT NOT NULL,district TEXT NOT NULL DEFAULT '',area_m2 INTEGER NOT NULL,zoning TEXT NOT NULL,emsal TEXT,expected_share INTEGER,description TEXT NOT NULL,firm_id TEXT,status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL,expires_at TEXT NOT NULL);CREATE TABLE land_offers(id TEXT PRIMARY KEY,request_id TEXT NOT NULL,firm_id TEXT NOT NULL,owner_share INTEGER NOT NULL,delivery_months INTEGER NOT NULL,message TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'sent',created_at TEXT NOT NULL)");
 await C.ensureContractors(db);
 const columns=t=>sql.prepare(`PRAGMA table_info(${t})`).all().map(c=>c.name);
 for(const c of ['kind','work','budget_min','budget_max'])assert.ok(columns('land_requests').includes(c));
 for(const c of ['price_min','price_max'])assert.ok(columns('land_offers').includes(c));
 await approved(db);assert.equal((await C.createLandRequest(db,land,request())).kind,'land');
});
