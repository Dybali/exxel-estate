import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync,existsSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url),cache=new Map();
function load(file){const full=path.resolve(root,file);if(cache.has(full))return cache.get(full);const m={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(name.startsWith('.')||name.startsWith('@/')){const p=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return p.endsWith('.json')?JSON.parse(readFileSync(p,'utf8')):load(p+'.ts');}return native(name);},m,m.exports);cache.set(full,m.exports);return m.exports;}
const S=load('lib/services.ts'),X=load('lib/service-samples.ts'),{SERVICE_CATEGORIES}=load('lib/service-categories.ts'),{validDistrict,CITIES}=load('lib/turkey-locations.ts'),{serviceNameSortKey}=load('lib/service-text.ts');
const source=file=>readFileSync(path.join(root,file),'utf8');
const SAMPLES=X.SERVICE_SAMPLE_FIRMS;

// A small real directory: 30 approved firms (boyacı, every 3rd also tesisatçı) in Muğla/Bodrum or İstanbul.
const admin='33333333-3333-4333-8333-333333333333',uuid=i=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
let shared;
async function world(){
 if(shared)return shared;
 const sql=new DatabaseSync(':memory:');sql.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT);CREATE TABLE property_images(object_key TEXT)");
 const db={prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}};
 for(let i=0;i<30;i++)await S.createFirm(db,{id:uuid(i+1),admin:true},{name:`Gerçek Boya ${i}`,description:'Ev ve iş yerlerinde güvenilir, temiz ve hızlı boya hizmeti veriyoruz.',categories:i%3===0?['boyaci-badanaci','tesisatci']:['boyaci-badanaci'],
  areas:[i%2?{city:'Muğla',district:'Bodrum'}:{city:'İstanbul',district:'Kadıköy'}],phone:'0532 123 45 67',terms:true},new Date(Date.UTC(2026,0,1)+i*60000));
 return shared={sql,db};
}
async function allPages(db,query,samples=SAMPLES){
 const first=X.withSampleResults(await S.searchFirms(db,{...query,page:1}),query,samples),firms=[...first.firms];
 for(let page=2;page<=first.pages;page++)firms.push(...X.withSampleResults(await S.searchFirms(db,{...query,page}),{...query,page},samples).firms);
 return {first,firms};
}

test('sample set: 2–3 firms in every category, ~120 in all, fictional and contact-free',()=>{
 assert.ok(SAMPLES.length>=110&&SAMPLES.length<=135,`${SAMPLES.length} samples`);
 assert.ok(SAMPLES.every(f=>Date.parse(f.createdAt)<=Date.UTC(2026,10,6)),'sample dates lie in the past');
 const ids=SAMPLES.map(f=>f.id),names=SAMPLES.map(f=>f.name);
 assert.equal(new Set(ids).size,ids.length);assert.equal(new Set(names).size,names.length);
 for(const category of SERVICE_CATEGORIES){
  const main=SAMPLES.filter(f=>f.categories[0]===category.slug||f.categories.includes(category.slug));
  assert.ok(main.length>=2,`${category.slug}: ${main.length}`);
 }
 for(const firm of SAMPLES){
  assert.match(firm.id,/^sample-[a-z0-9-]+$/);assert.equal(X.isSampleFirmId(firm.id),true);assert.equal(S.validFirmId(firm.id),false);
  assert.equal(firm.sample,true);assert.equal(firm.status,'approved');
  // No way to reach a real business: no phone, WhatsApp, e-mail, website or logo upload.
  assert.equal(firm.phone,'');assert.equal(firm.whatsapp,null);assert.equal(firm.email,null);assert.equal(firm.website,null);assert.equal(firm.logo,null);
  assert.ok(firm.categories.length>=1&&firm.categories.length<=3,firm.id);
  for(const slug of firm.categories)assert.ok(SERVICE_CATEGORIES.some(c=>c.slug===slug),`${firm.id}: ${slug}`);
  assert.ok(firm.areas.length>=1,firm.id);
  for(const area of firm.areas){assert.ok(CITIES.includes(area.city),`${firm.id}: ${area.city}`);assert.ok(!area.district||validDistrict(area.city,area.district),`${firm.id}: ${area.district}`);}
  assert.ok(firm.description.length>=S.SERVICE_LIMITS.descriptionMin&&firm.description.length<=300,firm.id);assert.ok(firm.translations.en?.length>=30,firm.id);
  assert.ok(firm.name.length>=S.SERVICE_LIMITS.nameMin&&firm.name.length<=S.SERVICE_LIMITS.nameMax,firm.id);
  // Only the site's own editorial images, which exist in public/.
  for(const url of [firm.cover,...firm.photos].filter(Boolean)){assert.match(url,/^\/editorial\/photo-[0-9a-f-]+\.webp$/);assert.ok(existsSync(path.join(root,'public',url)),url);}
  assert.ok(!Number.isNaN(Date.parse(firm.createdAt)));
 }
 // Spread over the major cities, a few verified/featured.
 const cities=new Set(SAMPLES.flatMap(f=>f.areas.map(a=>a.city)));
 for(const city of ['İstanbul','Ankara','İzmir','Antalya','Muğla','Bursa','Mersin'])assert.ok(cities.has(city),city);
 assert.ok(SAMPLES.some(f=>f.areas.some(a=>a.city==='Muğla'&&a.district==='Bodrum')));assert.ok(SAMPLES.some(f=>f.areas.some(a=>a.district==='Alanya')));
 const featured=SAMPLES.filter(f=>f.featured).length,verified=SAMPLES.filter(f=>f.verified).length;
 assert.ok(featured>=8&&featured<SAMPLES.length/3,`${featured} featured`);assert.ok(verified>=15&&verified<SAMPLES.length,`${verified} verified`);
 assert.ok(SAMPLES.some(f=>f.categories.length>1));
});

test('switch: SERVICE_SAMPLES unset/empty is on, 0/false/off is off; off removes every sample',()=>{
 for(const value of [undefined,null,'','1','true','on',' yes '])assert.equal(X.serviceSamplesEnabled(value),true,String(value));
 for(const value of ['0','false','FALSE','off',' Off ','no'])assert.equal(X.serviceSamplesEnabled(value),false,value);
 const server=source('lib/services-server.ts');
 assert.match(server,/serviceSamplesEnabled\(\(env as Record<string, unknown>\)\.SERVICE_SAMPLES\) \? SERVICE_SAMPLE_FIRMS : \[\]/);
 // With the switch off the pages get an empty list: no profile, no results, no fill.
 assert.equal(X.sampleFirmById([],SAMPLES[0].id),null);assert.equal(X.sampleFirmById(SAMPLES,SAMPLES[0].id),SAMPLES[0]);assert.equal(X.sampleFirmById(SAMPLES,'sample-nope'),null);
 assert.deepEqual(X.matchSampleFirms([],{}),[]);assert.deepEqual(X.similarSampleFirms([],SAMPLES[0]),[]);
 const results={firms:[],total:0,page:1,pages:1,perPage:24};assert.deepEqual(X.withSampleResults(results,{},[]),{...results,samples:0});
 assert.deepEqual(X.fillWithSamples([],[],8),[]);
});

test('results: real firms first, samples after, totals stay real, pages cover both without gaps or repeats',async()=>{
 const {db}=await world();
 const query={categories:['boyaci-badanaci']};
 const real=await S.searchFirms(db,query),matches=X.matchSampleFirms(SAMPLES,query);
 assert.equal(real.total,30);assert.ok(matches.length>=3);
 const {first,firms}=await allPages(db,query);
 assert.equal(first.total,30,'total counts real firms only');assert.equal(first.samples,matches.length);
 assert.equal(first.pages,Math.ceil((30+matches.length)/24));
 assert.equal(firms.length,30+matches.length);assert.equal(new Set(firms.map(f=>f.id)).size,firms.length);
 assert.ok(firms.slice(0,30).every(f=>!f.sample),'real firms first');assert.ok(firms.slice(30).every(f=>f.sample),'samples after');
 assert.deepEqual(firms.slice(30).map(f=>f.id),matches.map(f=>f.id));
 // Page 2 holds the last 6 real firms, then samples.
 const page2=X.withSampleResults(await S.searchFirms(db,{...query,page:2}),{...query,page:2},SAMPLES);
 assert.equal(page2.firms.filter(f=>!f.sample).length,6);assert.equal(page2.firms[6].id,matches[0].id);
 // Past the last page: no firms (the routes answer 404 for page > pages).
 const beyond=X.withSampleResults(await S.searchFirms(db,{...query,page:first.pages+1}),{...query,page:first.pages+1},SAMPLES);assert.equal(beyond.firms.length,0);
 // A category without real firms: samples only, total 0, one page.
 const empty=X.withSampleResults(await S.searchFirms(db,{categories:['havuz-bakimi']}),{categories:['havuz-bakimi']},SAMPLES);
 assert.equal(empty.total,0);assert.ok(empty.firms.length>=2&&empty.firms.every(f=>f.sample));assert.equal(empty.pages,1);
 // Samples off: the real results unchanged.
 const off=X.withSampleResults(real,query,[]);assert.deepEqual(off.firms.map(f=>f.id),real.firms.map(f=>f.id));assert.equal(off.pages,real.pages);
});

test('sample filters, text search and sorting follow the real search rules',()=>{
 const ids=list=>list.map(f=>f.id);
 // Category (any of several), place (district pages include province-wide firms), verified, featured, photos.
 assert.ok(X.matchSampleFirms(SAMPLES,{categories:['havuz-bakimi']}).every(f=>f.categories.includes('havuz-bakimi')));
 const bodrum=X.matchSampleFirms(SAMPLES,{city:'Muğla',district:'Bodrum'});
 assert.ok(bodrum.length>=5);assert.ok(bodrum.every(f=>f.areas.some(a=>a.city==='Muğla'&&(!a.district||a.district==='Bodrum'))));
 assert.ok(bodrum.some(f=>f.areas.some(a=>a.city==='Muğla'&&a.district==='')),'province-wide firm on a district page');
 assert.ok(X.matchSampleFirms(SAMPLES,{city:'Ankara'}).every(f=>f.areas.some(a=>a.city==='Ankara')));
 assert.ok(X.matchSampleFirms(SAMPLES,{verified:true}).every(f=>f.verified));assert.ok(X.matchSampleFirms(SAMPLES,{featured:true}).every(f=>f.featured));
 const photos=X.matchSampleFirms(SAMPLES,{photos:true});assert.ok(photos.length<SAMPLES.length&&photos.every(f=>f.cover||f.photos.length));
 assert.ok(!ids(X.matchSampleFirms(SAMPLES,{excludeId:SAMPLES[0].id})).includes(SAMPLES[0].id));
 // Text: name, description, English text and category names in every language, Turkish-folded, all words.
 assert.ok(ids(X.matchSampleFirms(SAMPLES,{q:'HAVUZ'})).includes('sample-turkuaz-havuz'));
 assert.ok(ids(X.matchSampleFirms(SAMPLES,{q:'IŞILTI elektrik'})).includes('sample-isilti-elektrik'));
 assert.ok(ids(X.matchSampleFirms(SAMPLES,{q:'removals'})).includes('sample-yolcu-nakliyat'),'English category name');
 assert.ok(ids(X.matchSampleFirms(SAMPLES,{q:'drone'})).includes('sample-gokyuzu-drone'));
 assert.deepEqual(X.matchSampleFirms(SAMPLES,{q:'havuz zzzz'}),[]);
 // Sorting: featured → verified → newest; newest; Turkish A–Z.
 const featured=X.matchSampleFirms(SAMPLES,{});const firstPlain=featured.findIndex(f=>!f.featured);
 assert.ok(featured.slice(0,firstPlain).every(f=>f.featured)&&featured.slice(firstPlain).every(f=>!f.featured));
 const newest=X.matchSampleFirms(SAMPLES,{sort:'newest'});for(let i=1;i<newest.length;i++)assert.ok(newest[i-1].createdAt>=newest[i].createdAt);
 const az=X.matchSampleFirms(SAMPLES,{sort:'az'});for(let i=1;i<az.length;i++)assert.ok(serviceNameSortKey(az[i-1].name)<=serviceNameSortKey(az[i].name),`${az[i-1].name} / ${az[i].name}`);
 assert.ok(az.findIndex(f=>f.name.startsWith('Ç'))>az.findIndex(f=>f.name.startsWith('C')||f.name.startsWith('B')),'Ç after C');
});

test('landing and similar firms: real first, filled with samples up to the limit',()=>{
 const real=[{id:'r1',categories:['tesisatci'],areas:[]},{id:'r2',categories:['tesisatci'],areas:[]}];
 const filled=X.fillWithSamples(real,X.matchSampleFirms(SAMPLES,{featured:true}),8);
 assert.equal(filled.length,8);assert.deepEqual(filled.slice(0,2).map(f=>f.id),['r1','r2']);assert.ok(filled.slice(2).every(f=>f.sample&&f.featured));
 const full=Array.from({length:8},(_,i)=>({id:`r${i}`}));assert.deepEqual(X.fillWithSamples(full,SAMPLES,8),full,'enough real firms: no samples');
 const firm=SAMPLES.find(f=>f.id==='sample-damla-tesisat'),similar=X.similarSampleFirms(SAMPLES,firm);
 assert.ok(similar.length>=2);assert.ok(!similar.some(f=>f.id===firm.id));assert.ok(similar.every(f=>f.categories.includes('tesisatci')));
 // Same province first.
 const near=similar.findIndex(f=>!f.areas.some(a=>firm.areas.some(b=>b.city===a.city)));assert.ok(near===-1||similar.slice(near).every(f=>!f.areas.some(a=>firm.areas.some(b=>b.city===a.city))));
 const counts=X.sampleCategoryCounts(SAMPLES);for(const c of SERVICE_CATEGORIES)assert.ok(counts[c.slug]>=2,c.slug);
 assert.deepEqual(Object.values(X.sampleCategoryCounts([])).filter(Boolean),[]);
});

test('samples are never counted, indexed, stored or put in the sitemap / structured data',async()=>{
 const {db,sql}=await world();
 // The database never holds a sample: every count, stat, summary and sitemap row comes from it alone.
 assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM service_firms WHERE id LIKE 'sample-%'").get().n,0);
 assert.equal((await S.serviceStats(db)).firms,30);assert.equal((await S.categoryCounts(db))['havuz-bakimi'],0);
 const summary=await S.serviceSummary(db,{category:'havuz-bakimi',city:'Muğla',district:'Bodrum'},0);assert.equal(S.serviceIndexable(summary),false);
 const sitemap=await S.serviceSitemapEntries(db);assert.ok(sitemap.firms.every(f=>!f.path.includes('sample-')));assert.ok(!sitemap.pages.some(p=>p.path.includes('havuz-bakimi')));
 assert.deepEqual(X.realFirms([...SAMPLES.slice(0,3),{id:'r'}]).map(f=>f.id),['r']);
 // Only the public Hizmetler pages merge samples; sitemap, admin, owner panel, API and listing suggestions never import them.
 for(const file of ['app/sitemap.ts','app/api/admin/services/route.ts','app/api/services/mine/route.ts','app/api/media/[...key]/route.ts','components/AdminServices.tsx','components/ServiceFirmPanel.tsx','components/ServiceSuggestions.tsx','lib/services.ts'])
  assert.doesNotMatch(source(file),/from "(\.\/|@\/lib\/)service-samples"|serviceSamples\(/,file);
 // Category/region pages: ItemList, share image and indexing use real firms only; a samples-only page stays noindex.
 const category=source('app/hizmetler/[...slug]/page.tsx');
 assert.match(category,/withSampleResults\(real, query, serviceSamples\(\)\)/);
 assert.match(category,/const firms = realFirms\(results\.firms\)/);assert.match(category,/serviceIndexable\(summary\) && realFirms\(results\.firms\)\.length > 0/);
 assert.match(category,/serviceDescription\(heading, summary\.count, locale\)/);
 // Firm profile: samples are noindex with no LocalBusiness JSON-LD and no contact actions.
 const profile=source('app/hizmetler/firma/[id]/page.tsx');
 assert.match(profile,/firm\.sample \? \{ robots: \{ index: false, follow: true \} \}/);assert.match(profile,/firm\.status !== "approved" \|\| firm\.sample \? null/);
 const view=source('components/ServiceFirmProfile.tsx');assert.match(view,/firm\.sample \? <>/);assert.match(view,/Örnek firma — bu profil sitenin nasıl görüneceğini göstermek içindir\./);
 // Every card carries the badge; landing counts and stats stay real (sample counts are a separate hint).
 assert.match(source('components/ServiceFirmCard.tsx'),/\{firm\.sample && <ServiceSampleBadge\/>\}/);
 const landing=source('app/hizmetler/page.tsx');assert.match(landing,/counts=\{counts\} stats=\{stats\}/);assert.match(landing,/sampleCategoryCounts\(samples\)/);
});
