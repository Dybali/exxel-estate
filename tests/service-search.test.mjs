import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url),cache=new Map();
function load(file){const full=path.resolve(root,file);if(cache.has(full))return cache.get(full);const m={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(name.startsWith('.')||name.startsWith('@/')){const p=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return p.endsWith('.json')?JSON.parse(readFileSync(p,'utf8')):load(p+'.ts');}return native(name);},m,m.exports);cache.set(full,m.exports);return m.exports;}
const S=load('lib/services.ts'),Q=load('lib/service-search.ts'),T=load('lib/service-text.ts'),{siteChrome}=load('lib/site-chrome.ts');

const admin='33333333-3333-4333-8333-333333333333';
const uuid=i=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
const wrap=sql=>({prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}});
const AREAS=[[{city:'Muğla',district:''}],[{city:'Muğla',district:'Bodrum'}],[{city:'İstanbul',district:'Kadıköy'}],[{city:'İzmir',district:'Urla'}]];
const CATEGORIES=[['boyaci-badanaci'],['tesisatci'],['boyaci-badanaci','elektrikci']];
const NAMES=['IŞIK Boya','Çınar Tesisat','Usta','şahin Yapı','Zeki Usta','ilkay İnşaat','Ağaç Ev','Öz Usta','Ufuk','Can'];
// 200 firms: categories, areas, flags and photos rotate; i%50==49 stays pending, i%40==39 is suspended.
const spec=Array.from({length:200},(_,i)=>({i,id:null,owner:uuid(i+1),name:`${NAMES[i%10]} ${i}`,categories:CATEGORIES[i%3],areas:AREAS[i%4],verified:i%5===0,featured:i%20===0,photos:i%2===0,
 status:i%50===49?'pending':i%40===39?'suspended':'approved',created:new Date(Date.UTC(2026,0,1)+i*60000)}));
let shared;
async function world(){
 if(shared)return shared;
 const sql=new DatabaseSync(':memory:');sql.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT);CREATE TABLE property_images(object_key TEXT)");
 const db=wrap(sql);
 for(const firm of spec){
  const photos=firm.photos?[`/api/media/listings/${firm.owner}/${crypto.randomUUID()}.webp`]:[];
  const input={name:firm.name,description:`${firm.name} ${firm.i%7===0?'Bodrum villalarında havuz kenarı boya ve özel işler.':'Ev ve iş yerlerinde güvenilir, temiz ve hızlı hizmet veriyoruz.'}`,categories:firm.categories,areas:firm.areas,phone:'0532 123 45 67',photos,terms:true};
  const created=await S.createFirm(db,{id:firm.owner,admin:firm.status!=='pending'},input,firm.created);firm.id=created.id;
  if(firm.verified)await S.reviewFirm(db,admin,firm.id,'verify','');
  if(firm.featured)await S.reviewFirm(db,admin,firm.id,'feature','');
  if(firm.status==='suspended')await S.reviewFirm(db,admin,firm.id,'suspend','Şikâyet inceleniyor');
 }
 return shared={sql,db};
}
const approved=()=>spec.filter(f=>f.status==='approved');
const inPlace=(firm,city,district)=>firm.areas.some(a=>a.city===city&&(!district||!a.district||a.district===district));
const byFeatured=(a,b)=>Number(b.featured)-Number(a.featured)||Number(b.verified)-Number(a.verified)||b.created-a.created||a.id.localeCompare(b.id);

test('fixture: 200 firms, only the approved ones are counted and listed',async()=>{
 const {db}=await world(),all=approved();
 assert.equal(all.length,200-4-4);// 4 pending (49,99,149,199), 4 suspended (39,79,119,159)
 const page1=await S.searchFirms(db,{});
 assert.equal(page1.total,all.length);assert.equal(page1.perPage,24);assert.equal(page1.pages,Math.ceil(all.length/24));assert.equal(page1.firms.length,24);
 assert.ok(page1.firms.every(f=>f.status==='approved'));
});

test('pagination: pages are disjoint, cover every approved firm once, and stop at the last page',async()=>{
 const {db}=await world(),all=approved(),seen=[];
 const {pages}=await S.searchFirms(db,{});
 for(let page=1;page<=pages;page++){const result=await S.searchFirms(db,{page});assert.equal(result.page,page);assert.equal(result.firms.length,page<pages?24:all.length-24*(pages-1));seen.push(...result.firms.map(f=>f.id));}
 assert.equal(new Set(seen).size,seen.length);assert.deepEqual(new Set(seen),new Set(all.map(f=>f.id)));
 // Featured order across page boundaries: featured, verified, newest.
 assert.deepEqual(seen,[...all].sort(byFeatured).map(f=>f.id));
 const past=await S.searchFirms(db,{page:pages+1});assert.deepEqual([past.firms.length,past.total,past.pages],[0,all.length,pages]);
 // Junk page numbers fall back to page 1; huge ones are capped.
 assert.equal((await S.searchFirms(db,{page:-3})).page,1);assert.equal((await S.searchFirms(db,{page:'x'})).page,1);assert.equal((await S.searchFirms(db,{page:1e9})).page,S.SERVICE_MAX_PAGE);
 const small=await S.searchFirms(db,{perPage:10,page:2});assert.equal(small.firms.length,10);assert.equal(small.pages,Math.ceil(all.length/10));
});

test('sorting: newest first, and A–Z in Turkish alphabetical order on SQLite',async()=>{
 const {db}=await world(),all=approved();
 const newest=await S.searchFirms(db,{sort:'newest',perPage:100});
 assert.deepEqual(newest.firms.map(f=>f.id),[...all].sort((a,b)=>b.created-a.created).slice(0,100).map(f=>f.id));
 const names=[];for(let page=1;page<=3;page++)names.push(...(await S.searchFirms(db,{sort:'az',perPage:100,page})).firms.map(f=>f.name));
 assert.equal(names.length,all.length);
 const collator=new Intl.Collator('tr',{sensitivity:'base'});
 assert.deepEqual(names,[...names].sort(collator.compare));
 // Ç after C, Ö after O, Ş after S, Ü after U, dotless I before İ; case does not matter.
 const order=['Ağaç','ahmet','Can','Çınar','IŞIK','İlkay','Oya','Öz','Saz','Şahin','Ufuk','Ümit','Zeki','zz 1','zz2'];
 assert.deepEqual([...order].sort((a,b)=>T.serviceNameSortKey(a)<T.serviceNameSortKey(b)?-1:1),order);
 assert.match(T.serviceNameSortKey('Çınar Ltd. Şti.'),/^[a-z0-9]+$/);
 // Unknown sort values fall back to the featured order.
 assert.deepEqual((await S.searchFirms(db,{sort:'drop table'})).firms.map(f=>f.id),[...all].sort(byFeatured).slice(0,24).map(f=>f.id));
});

test('text search: Turkish-aware and case-insensitive (I/ı/İ/i), accents optional, words combined, wildcards literal',async()=>{
 const {db}=await world(),all=approved();
 const isik=all.filter(f=>f.name.startsWith('IŞIK')).length,cinar=all.filter(f=>f.name.startsWith('Çınar')).length;
 assert.ok(isik>10);
 for(const q of ['ışık','IŞIK','Işık','isik','ISIK','İŞİK','  ışık  '])assert.equal((await S.searchFirms(db,{q})).total,isik,q);
 for(const q of ['çınar','ÇINAR','cinar','Çinar'])assert.equal((await S.searchFirms(db,{q})).total,cinar,q);
 assert.equal((await S.searchFirms(db,{q:'İLKAY'})).total,all.filter(f=>f.name.startsWith('ilkay')).length);
 assert.equal((await S.searchFirms(db,{q:'şahin yapı'})).total,all.filter(f=>f.name.startsWith('şahin')).length);
 // Description words and category names (in any language) are searchable too.
 assert.equal((await S.searchFirms(db,{q:'villalarında havuz'})).total,all.filter(f=>f.i%7===0).length);
 assert.equal((await S.searchFirms(db,{q:'plumber'})).total,all.filter(f=>f.categories.includes('tesisatci')).length);
 assert.equal((await S.searchFirms(db,{q:'ELEKTRİKÇİ'})).total,all.filter(f=>f.categories.includes('elektrikci')).length);
 // Every word must match; names are matched by substring.
 assert.equal((await S.searchFirms(db,{q:'ışık villalarında'})).total,all.filter(f=>f.name.startsWith('IŞIK')&&f.i%7===0).length);
 assert.ok((await S.searchFirms(db,{q:'IŞIK 10'})).firms.some(f=>f.name==='IŞIK Boya 10'));
 for(const q of ['%','_','zzq\' OR 1=1 --','yokböylebirfirma'])assert.equal((await S.searchFirms(db,{q})).total,q==='%'||q==='_'?all.length:0,q);
 assert.deepEqual(T.serviceSearchTokens('İSTANBUL Işık  ÇATI!'),['istanbul','isik','cati']);assert.equal(T.serviceSearchTokens('a b c d e f g h i j').length,8);
});

test('filters: categories, province, district (with province-wide firms), verified, photos, combined; counts per category in one query',async()=>{
 const {db}=await world(),all=approved();
 const expect=(filter)=>all.filter(filter).length;
 assert.equal((await S.searchFirms(db,{categories:['elektrikci']})).total,expect(f=>f.categories.includes('elektrikci')));
 assert.equal((await S.searchFirms(db,{categories:['elektrikci','tesisatci']})).total,expect(f=>f.categories.some(c=>c==='elektrikci'||c==='tesisatci')));
 assert.equal((await S.searchFirms(db,{categories:['bilinmeyen']})).total,all.length);// unknown categories are ignored
 assert.equal((await S.searchFirms(db,{city:'Muğla'})).total,expect(f=>inPlace(f,'Muğla')));
 assert.equal((await S.searchFirms(db,{city:'Muğla',district:'Bodrum'})).total,expect(f=>inPlace(f,'Muğla','Bodrum')));
 assert.equal((await S.searchFirms(db,{city:'Muğla',district:'Milas'})).total,expect(f=>f.areas.some(a=>a.city==='Muğla'&&!a.district)));
 assert.equal((await S.searchFirms(db,{verified:true})).total,expect(f=>f.verified));
 assert.equal((await S.searchFirms(db,{photos:true})).total,expect(f=>f.photos));
 const combined={q:'boya',categories:['boyaci-badanaci'],city:'Muğla',verified:true,photos:true};
 const want=all.filter(f=>f.categories.includes('boyaci-badanaci')&&inPlace(f,'Muğla')&&f.verified&&f.photos).sort(byFeatured);
 const got=await S.searchFirms(db,combined);
 assert.ok(want.length>0);assert.equal(got.total,want.length);assert.deepEqual(got.firms.map(f=>f.id),want.map(f=>f.id));
 // Category counts follow the other filters.
 const counts=await S.categoryCounts(db,{city:'İzmir',photos:true});
 for(const slug of ['boyaci-badanaci','tesisatci','elektrikci'])assert.equal(counts[slug],expect(f=>f.categories.includes(slug)&&inPlace(f,'İzmir')&&f.photos),slug);
 assert.equal(counts['havuz-bakimi'],0);
 const stats=await S.serviceStats(db);assert.deepEqual(stats,{firms:all.length,cities:3});
 // Landing lists and similar firms.
 assert.deepEqual((await S.featuredFirms(db)).map(f=>f.id),all.filter(f=>f.featured).sort(byFeatured).slice(0,8).map(f=>f.id));
 assert.deepEqual((await S.newestFirms(db,3)).map(f=>f.id),[...all].sort((a,b)=>b.created-a.created).slice(0,3).map(f=>f.id));
 const target=all.find(f=>f.areas[0].district==='Urla'&&f.categories[0]==='tesisatci');
 const similar=await S.similarFirms(db,await S.firmById(db,target.id));
 assert.equal(similar.length,6);assert.ok(similar.every(f=>f.id!==target.id&&f.categories.includes('tesisatci')&&f.areas.some(a=>a.city==='İzmir')));
});

test('status changes and the search table stay in step; old firms are backfilled on start',async()=>{
 const {sql,db}=await world();
 const firm=approved().find(f=>f.name.startsWith('Zeki'));
 const before=(await S.searchFirms(db,{q:firm.name})).total;assert.ok(before>=1);
 await S.reviewFirm(db,admin,firm.id,'suspend','Kontrol ediliyor');
 assert.equal((await S.searchFirms(db,{q:firm.name})).total,before-1);
 assert.equal(await S.firmById(db,firm.id),null);
 await S.reviewFirm(db,admin,firm.id,'approve','');
 // An admin edit renames the firm: the old name no longer matches, the new one does.
 await S.updateFirm(db,{id:admin,admin:true},firm.id,{name:'Yepyeni Ünvan Ltd'});
 assert.equal((await S.searchFirms(db,{q:'yepyeni unvan'})).total,1);firm.name='Yepyeni Ünvan Ltd';
 // Rows written before the search table existed: dropped here, rebuilt by the first ensureServices of a new connection.
 sql.exec('DELETE FROM service_firm_search');
 const fresh=wrap(sql);
 assert.equal((await S.searchFirms(fresh,{q:'ışık'})).total,approved().filter(f=>f.name.startsWith('IŞIK')).length);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM service_firm_search').get().n,200);
 // Indexes for the results order, newest list, categories, areas and A–Z exist.
 const indexes=sql.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(r=>r.name);
 for(const name of ['service_firms_public_idx','service_firms_newest_idx','service_firm_categories_category_idx','service_firm_areas_place_idx','service_firm_search_name_idx'])assert.ok(indexes.includes(name),name);
 const plan=sql.prepare("EXPLAIN QUERY PLAN SELECT f.* FROM service_firms f WHERE f.status='approved' ORDER BY f.featured DESC,f.verified DESC,f.created_at DESC,f.id ASC LIMIT 24").all().map(r=>r.detail).join(' | ');
 assert.match(plan,/service_firms_public_idx/);
 // Deleting a firm removes its search row.
 await S.deleteFirm(db,{id:admin,admin:true},firm.id);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM service_firm_search WHERE firm_id=?').get(firm.id).n,0);
 spec.splice(spec.indexOf(firm),1);
});

test('URL filters: parsing, canonical category/region addresses, search addresses and page lists',()=>{
 const parse=query=>Q.parseServiceFilters(new URLSearchParams(query));
 assert.deepEqual(parse(''),Q.EMPTY_SERVICE_FILTERS);
 const f=parse('q=%20I%C5%9EIK%20%20boya&kategori=tesisatci&kategori=bilinmeyen&kategori=tesisatci&il=mugla&ilce=bodrum&dogrulanmis=1&fotografli=1&sirala=a-z&sayfa=3');
 assert.deepEqual(f,{q:'IŞIK boya',categories:['tesisatci'],city:'Muğla',district:'Bodrum',verified:true,photos:true,documented:false,emergency:false,sort:'az',page:3});
 assert.equal(Q.serviceSearchHref(f),'/hizmetler/ara?q=I%C5%9EIK+boya&kategori=tesisatci&il=mugla&ilce=bodrum&dogrulanmis=1&fotografli=1&sirala=a-z&sayfa=3');
 assert.deepEqual(parse(Q.serviceSearchHref(f).split('?')[1]),f);
 // Unknown places, a district without its province, bad sort and page values are dropped.
 assert.deepEqual(parse('il=atlantis&ilce=bodrum&sirala=x&sayfa=-2&dogrulanmis=yes'),Q.EMPTY_SERVICE_FILTERS);
 assert.deepEqual(parse('il=mugla&ilce=kadikoy'),{...Q.EMPTY_SERVICE_FILTERS,city:'Muğla'});
 assert.equal(parse('sayfa=2.5').page,1);assert.equal(parse('sayfa=99999999').page,1);assert.equal(parse('sayfa=7').page,7);
 assert.deepEqual(parse('grup=hukuk-finans').categories,['tapu-takibi','gayrimenkul-avukati','yeminli-tercuman','ekspertiz-degerleme','mali-musavir','konut-kredisi','sigorta']);
 assert.deepEqual(parse('grup=hukuk-finans&kategori=tesisatci').categories,['tesisatci']);
 // One category (and place) with nothing else is the indexable category/region page, with ?sayfa for later pages.
 assert.equal(Q.serviceSearchHref({categories:['tesisatci'],city:'Muğla',district:'Bodrum'}),'/hizmetler/tesisatci/mugla/bodrum');
 assert.equal(Q.serviceSearchHref({categories:['tesisatci'],city:'Muğla',page:2}),'/hizmetler/tesisatci/mugla?sayfa=2');
 assert.ok(Q.isCanonicalServiceScope(parse('kategori=tesisatci&il=mugla')));assert.equal(Q.isCanonicalServiceScope(parse('kategori=tesisatci&sirala=yeni')),false);
 assert.equal(Q.serviceSearchHref({categories:['tesisatci'],sort:'newest'}),'/hizmetler/ara?kategori=tesisatci&sirala=yeni');
 assert.equal(Q.serviceSearchHref({}),'/hizmetler/ara');
 assert.equal(Q.withLang('/hizmetler/ara','ar'),'/hizmetler/ara?lang=ar');assert.equal(Q.withLang('/hizmetler/ara?q=x','de'),'/hizmetler/ara?q=x&lang=de');assert.equal(Q.withLang('/x',null),'/x');
 assert.equal(Q.servicePageParam('2'),2);assert.equal(Q.servicePageParam(['3','4']),3);assert.equal(Q.servicePageParam(undefined),1);assert.equal(Q.servicePageParam('0'),1);
 assert.deepEqual(Q.servicePageList(1,1),[1]);assert.deepEqual(Q.servicePageList(1,5),[1,2,3,null,5]);
 assert.deepEqual(Q.servicePageList(6,20),[1,null,4,5,6,7,8,null,20]);assert.deepEqual(Q.servicePageList(3,4),[1,2,3,4]);assert.deepEqual(Q.servicePageList(20,20),[1,null,18,19,20]);
});

test('layout routing: /hizmetler gets the service frame, /yonetim the admin shell, everything else the real-estate header',()=>{
 for(const path of ['/hizmetler','/hizmetler/','/hizmetler/ara','/hizmetler/ara?q=boya','/hizmetler/tesisatci/mugla/bodrum','/hizmetler/firma/abc'])assert.equal(siteChrome(path),'services',path);
 for(const path of ['/yonetim','/yonetim/hizmetler'])assert.equal(siteChrome(path),'admin',path);
 for(const path of ['/','/ilanlar','/hizmetlerimiz','/emlak/mugla','/blog/hizmetler','/hesabim?tab=hizmet','',null,undefined])assert.equal(siteChrome(path),'main',String(path));
 const frame=readFileSync(path.join(root,'components/SiteFrame.tsx'),'utf8'),layout=readFileSync(path.join(root,'app/hizmetler/layout.tsx'),'utf8');
 assert.match(frame,/siteChrome\(path\)!=='main'/);assert.match(layout,/<ServiceHeader\/>/);assert.match(layout,/<ServiceFooter\/>/);
 assert.doesNotMatch(layout,/AssistantLauncher|ExchangeRates|<Header|<Footer/);
});

test('sitemap: grouped page counts, own-firm district pages only, caps for pages and firm profiles',async()=>{
 const {db}=await world(),all=approved();
 const {pages,firms}=await S.serviceSitemapEntries(db);
 assert.equal(firms.length,all.length);assert.ok(firms.every(f=>f.path.startsWith('/hizmetler/firma/')&&f.updatedAt));
 const page=p=>pages.find(x=>x.path===p);
 assert.equal(page('/hizmetler/tesisatci').count,all.filter(f=>f.categories.includes('tesisatci')).length);
 assert.equal(page('/hizmetler/boyaci-badanaci/mugla').count,all.filter(f=>f.categories.includes('boyaci-badanaci')&&inPlace(f,'Muğla')).length);
 assert.equal(page('/hizmetler/elektrikci/mugla/bodrum').count,all.filter(f=>f.categories.includes('elektrikci')&&f.areas.some(a=>a.district==='Bodrum')).length);
 assert.equal(page('/hizmetler/elektrikci/mugla/milas'),undefined);
 assert.ok(pages.every((p,i)=>i===0||pages[i-1].count>=p.count));
 assert.equal((await S.serviceSitemapEntries(db,2,5)).pages.length,2);assert.equal((await S.serviceSitemapEntries(db,2,5)).firms.length,5);
 assert.deepEqual(S.serviceSitemapPages([{category:'tesisatci',city:'Atlantis',district:'',n:3},{category:'nope',city:'',district:'',n:1},{category:'tesisatci',city:'Muğla',district:'Kadıköy',n:1},{category:'tesisatci',city:'',district:'',n:0}]),[]);
 const source=readFileSync(path.join(root,'app/sitemap.ts'),'utf8');assert.match(source,/SITEMAP_URL_LIMIT=50000/);
});
