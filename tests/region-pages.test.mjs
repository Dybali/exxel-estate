import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url),cache=new Map();
function load(file){const full=path.resolve(root,file);if(cache.has(full))return cache.get(full);const m={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(name.startsWith('.')||name.startsWith('@/')){const p=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return p.endsWith('.json')?JSON.parse(readFileSync(p,'utf8')):load(p+'.ts');}return native(name);},m,m.exports);cache.set(full,m.exports);return m.exports;}
const region=load('lib/region-pages.ts');
const {regionSlug,resolveRegion,regionPath,parseCombo,regionSearchHref,regionFacets,summarizeRegion,regionIndexable,regionPrices,regionPriceStats,regionListings,regionDemos,regionSitemapEntries,REGION_TYPES}=region;
const {regionHeading,regionDescription,regionPhrase}=load('lib/region-copy.ts');
const {activePublicationQuery}=load('lib/listing-policy.ts');
const {DISTRICTS}=load('lib/turkey-locations.ts');

const day=86400000,ago=n=>new Date(Date.now()-n*day).toISOString(),ahead=n=>new Date(Date.now()+n*day).toISOString();
// Same expiry rewrite as the production adapters (lib/d1-publication.ts, lib/pg-d1.ts); counts queries too.
function fixture(){
 const sql=new DatabaseSync(':memory:');let queries=0;
 sql.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT);CREATE TABLE listings(id TEXT PRIMARY KEY,owner_id TEXT,title TEXT,purpose TEXT,property_type TEXT,price INTEGER,currency TEXT,city TEXT,district TEXT,gross_area INTEGER,status TEXT,featured INTEGER DEFAULT 0,expires_at TEXT,published_at TEXT,created_at TEXT,updated_at TEXT);CREATE INDEX listings_location_idx ON listings(status,city,district);INSERT INTO users VALUES('owner','Owner');`);
 const add=(id,{purpose='satilik',type='villa',price=10000000,currency='TRY',city='Muğla',district='Bodrum',area=200,status='published',expires=null,updated='2026-10-01T00:00:00.000Z',featured=0}={})=>sql.prepare('INSERT INTO listings VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'owner',id,purpose,type,price,currency,city,district,area,status,featured,expires,updated,updated,updated);
 const db={prepare(q){const query=activePublicationQuery(q);queries++;let v=[];return {bind(...a){v=a;return this},async all(){return {results:sql.prepare(query).all(...v)}}}}};
 return {sql,db,add,queries:()=>queries};
}
const parse=row=>({id:String(row.id),title:row.title,purpose:row.purpose,propertyType:row.property_type,price:Number(row.price),currency:row.currency,city:row.city,district:row.district,grossArea:Number(row.gross_area),source:'user',images:[],amenities:[]});

test('region slugs: Turkish letters to lowercase ASCII, unique per city, never confused with purpose pages',()=>{
 assert.equal(regionSlug('İstanbul'),'istanbul');assert.equal(regionSlug('Muğla'),'mugla');assert.equal(regionSlug('Şanlıurfa'),'sanliurfa');
 assert.equal(regionSlug('Çanakkale'),'canakkale');assert.equal(regionSlug('Gümüşhane'),'gumushane');assert.equal(regionSlug('Kırklareli'),'kirklareli');
 assert.equal(regionSlug('Iğdır'),'igdir');assert.equal(regionSlug('19 Mayıs'),'19-mayis');assert.equal(regionSlug('Köşk & Konak'),'kosk-konak');
 const cities=new Set();
 for(const [city,list] of Object.entries(DISTRICTS)){
  const slug=regionSlug(city);assert.match(slug,/^[a-z0-9-]+$/);assert.ok(!cities.has(slug),city);cities.add(slug);
  const seen=new Set();
  for(const district of list){const d=regionSlug(district);assert.match(d,/^[a-z0-9-]+$/);assert.ok(!seen.has(d),`${city}/${district}`);seen.add(d);assert.equal(parseCombo(d),null,`${city}/${district} looks like a purpose page`);
   assert.deepEqual(resolveRegion(regionPath({city,district}).split('/').slice(2)),{city,district});}
 }
 assert.equal(cities.size,81);
});

test('region URLs: city, district and purpose/type combinations; unknown or non-canonical slugs are 404',()=>{
 assert.deepEqual(resolveRegion(['mugla']),{city:'Muğla'});
 assert.deepEqual(resolveRegion(['mugla','bodrum']),{city:'Muğla',district:'Bodrum'});
 assert.deepEqual(resolveRegion(['mugla','bodrum','satilik-villa']),{city:'Muğla',district:'Bodrum',purpose:'satilik',type:'villa'});
 assert.deepEqual(resolveRegion(['antalya','kiralik-daire']),{city:'Antalya',purpose:'kiralik',type:'daire'});
 assert.deepEqual(resolveRegion(['istanbul','satilik']),{city:'İstanbul',purpose:'satilik'});
 assert.deepEqual(resolveRegion(['istanbul','sisli','satilik-isyeri']),{city:'İstanbul',district:'Şişli',purpose:'satilik',type:'ticari'});
 assert.deepEqual(resolveRegion(['izmir','cesme','kiralik-mustakil-ev']),{city:'İzmir',district:'Çeşme',purpose:'kiralik',type:'mustakil'});
 for(const bad of [[],['atlantis'],['Mugla'],['muğla'],['mugla','kadikoy'],['mugla','satilik-tekne'],['mugla','satilik-ticari'],['mugla','gunluk'],['mugla','satilik','bodrum'],['mugla','bodrum','villa'],['mugla','bodrum','satilik-villa','x'],['mugla','satilik-villa','satilik']])
  assert.equal(resolveRegion(bad),null,bad.join('/'));
 assert.equal(regionPath({city:'Muğla',district:'Bodrum',purpose:'satilik',type:'villa'}),'/emlak/mugla/bodrum/satilik-villa');
 assert.equal(regionPath({city:'Antalya',purpose:'kiralik',type:'daire'}),'/emlak/antalya/kiralik-daire');
 assert.equal(regionPath({city:'Atlantis'}),null);assert.equal(regionPath({city:'Muğla',district:'Kadıköy'}),null);
 for(const {type} of REGION_TYPES)for(const purpose of ['satilik','kiralik']){const scope={city:'Muğla',district:'Bodrum',purpose,type};assert.deepEqual(resolveRegion(regionPath(scope).split('/').slice(2)),scope);}
 assert.equal(regionSearchHref({city:'Muğla',district:'Bodrum',purpose:'satilik',type:'villa'}),'/ilanlar?city=Mu%C4%9Fla&district=Bodrum&purpose=satilik&type=villa');
});

test('region copy: localized headings and descriptions without invented claims',()=>{
 assert.equal(regionHeading('Bodrum','tr','satilik','villa'),'Bodrum Satılık Villalar');
 assert.equal(regionHeading('Antalya','tr','kiralik','daire'),'Antalya Kiralık Daireler');
 assert.equal(regionHeading('İstanbul','tr'),'İstanbul Emlak İlanları');
 assert.equal(regionHeading('Bodrum','en','satilik','villa'),'Villas for Sale in Bodrum');
 assert.equal(regionHeading('Bodrum','de','kiralik'),'Immobilien zur Miete in Bodrum');
 assert.equal(regionHeading('Bodrum','ar','satilik','villa'),'فلل للبيع في Bodrum');
 for(const locale of ['tr','de','fr','en','ar','fa','ru','nl'])for(const purpose of [undefined,'satilik','kiralik'])for(const {type} of [{type:undefined},...REGION_TYPES]){if(type&&!purpose)continue;const heading=regionHeading('Bodrum',locale,purpose,type);assert.ok(heading.includes('Bodrum')&&!heading.includes('undefined'),`${locale} ${purpose} ${type}`);assert.ok(regionPhrase(locale,purpose,type).trim());}
 assert.match(regionDescription('Bodrum Satılık Villalar',7,'tr'),/Aktif ilan: 7/);
 assert.doesNotMatch(regionDescription('Bodrum Satılık Villalar',0,'tr'),/Aktif ilan|\b0\b/);
});

test('region facets: one grouped query; counts, links and types exclude unpublished and expired listings',async()=>{
 const {db,add,queries}=fixture();
 add('v1');add('v2',{price:12000000});add('v3',{district:'Fethiye'});
 add('d1',{type:'daire',purpose:'kiralik',price:40000});add('a1',{type:'arsa'});add('b1',{type:'bina'});
 add('pending',{status:'pending'});add('withdrawn',{status:'withdrawn'});add('expired',{expires:ago(1)});add('later',{expires:ahead(3),updated:'2026-10-20T00:00:00.000Z'});
 add('elsewhere',{city:'Antalya',district:'Alanya'});add('unknown-district',{district:'Atlantis'});
 const facets=await regionFacets(db,'Muğla');assert.equal(queries(),1);
 const city=summarizeRegion({city:'Muğla'},facets);
 assert.equal(city.count,8);
 assert.equal(city.updatedAt,'2026-10-20T00:00:00.000Z');
 assert.deepEqual(city.types.slice(0,1),[{type:'villa',count:5}],'a listing with an unknown district still counts for its city');
 // Districts: real locations only (the invalid "Atlantis" row has no page), most listings first.
 assert.deepEqual(city.districts.map(l=>[l.path,l.count]),[['/emlak/mugla/bodrum',6],['/emlak/mugla/fethiye',1]]);
 const villas=summarizeRegion({city:'Muğla',district:'Bodrum',purpose:'satilik',type:'villa'},facets);
 assert.equal(villas.count,3);
 assert.deepEqual(villas.districts.map(l=>[l.path,l.count]),[['/emlak/mugla/bodrum/satilik-villa',3],['/emlak/mugla/fethiye/satilik-villa',1]]);
 // Sibling combinations at the same place, only with listings; bina has no page of its own but counts for "satilik".
 assert.deepEqual(villas.combos.map(l=>[l.path,l.count]),[['/emlak/mugla/bodrum/satilik',5],['/emlak/mugla/bodrum/satilik-villa',3],['/emlak/mugla/bodrum/satilik-arsa',1],['/emlak/mugla/bodrum/kiralik',1],['/emlak/mugla/bodrum/kiralik-daire',1]]);
 assert.equal(regionIndexable(villas),true);
 const empty=summarizeRegion({city:'Muğla',district:'Datça'},facets);
 assert.equal(empty.count,0);assert.equal(regionIndexable(empty),false);
 assert.equal(summarizeRegion({city:'Muğla',district:'Bodrum',purpose:'kiralik',type:'villa'},facets).count,0);
});

test('region price statistics: real listings only, one currency, at least three, per m² only for one type',async()=>{
 const {db,add}=fixture();
 add('a',{price:9000000,area:300});add('b',{price:12000000,area:200});
 assert.equal(await regionPrices(db,{city:'Muğla',district:'Bodrum',purpose:'satilik',type:'villa'}),null,'two listings are not enough');
 add('c',{price:15000000,area:250});add('expired',{price:99000000,expires:ago(2)});add('pending',{price:1,status:'pending'});
 add('eur1',{currency:'EUR',price:900000});add('eur2',{currency:'EUR',price:950000});add('rent',{purpose:'kiralik',price:80000});
 const stats=await regionPrices(db,{city:'Muğla',district:'Bodrum',purpose:'satilik',type:'villa'});
 assert.deepEqual(stats,{currency:'TRY',listings:3,min:9000000,max:15000000,medianPerSqm:60000});
 const mixed=await regionPrices(db,{city:'Muğla',purpose:'satilik'});
 assert.equal(mixed.medianPerSqm,null,'no m² median across property types');assert.equal(mixed.currency,'TRY');
 assert.equal(await regionPrices(db,{city:'Muğla'}),null,'no prices without a purpose (sale and rent never mix)');
 assert.equal(regionPriceStats([{price:1,currency:'EUR',gross_area:1},{price:2,currency:'EUR',gross_area:1},{price:3,currency:'USD',gross_area:1}],{perSqm:true}),null);
 assert.equal(regionPriceStats([{price:100,currency:'EUR',gross_area:1},{price:200,currency:'EUR',gross_area:1},{price:300,currency:'EUR',gross_area:1},{price:400,currency:'EUR',gross_area:2}],{perSqm:true}).medianPerSqm,200);
});

test('region listings: limited, featured first, no demo, no expired; demo listings only as labelled fallback',async()=>{
 const {db,add}=fixture();
 for(let i=0;i<30;i++)add(`v${String(i).padStart(2,'0')}`,{updated:new Date(Date.UTC(2026,9,1+i)).toISOString()});
 add('featured',{featured:1,updated:'2026-01-01T00:00:00.000Z'});add('expired',{expires:ago(1),featured:1});
 const listings=await regionListings(db,{city:'Muğla',district:'Bodrum',purpose:'satilik',type:'villa'},{parse});
 assert.equal(listings.length,24);assert.equal(listings[0].id,'featured');assert.equal(listings[1].id,'v29');
 assert.ok(!listings.some(l=>l.id==='expired'));
 const demos=[{id:'sample-1',source:'demo',city:'Muğla',district:'Bodrum',purpose:'satilik',propertyType:'arsa'},{id:'sample-2',source:'demo',city:'İzmir',district:'Urla',purpose:'satilik',propertyType:'arsa'},{id:'real',source:'user',city:'Muğla',district:'Bodrum',purpose:'satilik',propertyType:'arsa'}];
 assert.deepEqual(regionDemos({city:'Muğla',district:'Bodrum',purpose:'satilik',type:'arsa'},demos).map(l=>l.id),['sample-1']);
 assert.deepEqual(regionDemos({city:'Muğla',purpose:'kiralik'},demos),[]);
});

test('region sitemap: only pages with a real, active listing, with the newest update; never empty pages',async()=>{
 const {db,add}=fixture();
 add('v1',{updated:'2026-10-02T00:00:00.000Z'});add('v2',{district:'Fethiye',updated:'2026-10-05T00:00:00.000Z'});
 add('g1',{purpose:'gunluk',type:'mustakil',city:'Antalya',district:'Kaş'});add('b1',{type:'bina',city:'İzmir',district:'Urla'});
 add('expired',{city:'Ankara',district:'Çankaya',expires:ago(1)});add('pending',{city:'Bursa',district:'Nilüfer',status:'pending'});add('nowhere',{city:'Atlantis',district:'X'});
 const entries=await regionSitemapEntries(db);
 const paths=Object.fromEntries(entries.map(e=>[e.path,e]));
 assert.deepEqual(Object.keys(paths).sort(),['/emlak/antalya','/emlak/antalya/kas','/emlak/izmir','/emlak/izmir/satilik','/emlak/izmir/urla','/emlak/izmir/urla/satilik','/emlak/mugla','/emlak/mugla/bodrum','/emlak/mugla/bodrum/satilik','/emlak/mugla/bodrum/satilik-villa','/emlak/mugla/fethiye','/emlak/mugla/fethiye/satilik','/emlak/mugla/fethiye/satilik-villa','/emlak/mugla/satilik','/emlak/mugla/satilik-villa']);
 assert.equal(paths['/emlak/mugla'].count,2);assert.equal(paths['/emlak/mugla'].updatedAt,'2026-10-05T00:00:00.000Z');
 assert.equal(paths['/emlak/mugla/bodrum'].updatedAt,'2026-10-02T00:00:00.000Z');
 // Every sitemap page resolves and is indexable on its own page; the cap keeps the biggest pages.
 const facets={};for(const entry of entries){const scope=resolveRegion(entry.path.split('/').slice(2));assert.ok(scope,entry.path);facets[scope.city]??=await regionFacets(db,scope.city);assert.ok(regionIndexable(summarizeRegion(scope,facets[scope.city])),entry.path);assert.equal(summarizeRegion(scope,facets[scope.city]).count,entry.count,entry.path);}
 assert.deepEqual((await regionSitemapEntries(db,2)).map(e=>e.path),['/emlak/mugla','/emlak/mugla/satilik']);
});

test('internal links: footer regions and the sitemap route resolve to region pages',()=>{
 const footer=readFileSync(path.join(root,'components/Footer.tsx'),'utf8');
 const links=[...footer.matchAll(/"(\/emlak\/[^"]+)"/g)].map(m=>m[1]);
 assert.ok(links.length>=4);
 for(const link of links)assert.ok(resolveRegion(link.split('/').slice(2)),link);
 assert.match(readFileSync(path.join(root,'app/sitemap.ts'),'utf8'),/regionSitemapEntries/);
 assert.match(readFileSync(path.join(root,'app/ilan/[id]/page.tsx'),'utf8'),/regionPath\(\{city:listing\.city,district:listing\.district\}\)/);
});
