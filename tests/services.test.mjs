import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url),cache=new Map();
function load(file){const full=path.resolve(root,file);if(cache.has(full))return cache.get(full);const m={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(name.startsWith('.')||name.startsWith('@/')){const p=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return p.endsWith('.json')?JSON.parse(readFileSync(p,'utf8')):load(p+'.ts');}return native(name);},m,m.exports);cache.set(full,m.exports);return m.exports;}
const S=load('lib/services.ts');
const {SERVICE_CATEGORIES,SERVICE_GROUPS,serviceCategory,listingServiceSlugs,FOREIGN_BUYER_SERVICES}=load('lib/service-categories.ts');
const {serviceHeading,serviceCrumbs,serviceDescription}=load('lib/service-copy.ts');
const {words}=load('lib/i18n-dictionary.ts');
const {DISTRICTS}=load('lib/turkey-locations.ts');

const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333';
const me={id:owner,admin:false},them={id:other,admin:false},boss={id:admin,admin:true};
const photo=(user=owner)=>`/api/media/listings/${user}/${crypto.randomUUID()}.webp`;
function fixture(){
 const sql=new DatabaseSync(':memory:');
 // Core tables only: service tables are created on first use, projects may not exist yet.
 sql.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT);CREATE TABLE property_images(object_key TEXT)");
 sql.prepare("INSERT INTO users VALUES(?,?,?),(?,?,?),(?,?,?)").run(owner,'Ayşe','ayse@example.test',other,'Can','can@example.test',admin,'Admin','admin@example.test');
 const db={prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}};
 return {sql,db};
}
const valid=(user=owner,extra={})=>({name:'Deniz Boya Dekorasyon',description:'Bodrum ve Milas’ta iç ve dış cephe boyası, badana ve alçı işleri yapıyoruz. 15 yıllık deneyim.',
 translations:{en:'Interior and exterior painting in Bodrum and Milas.',de:''},categories:['boyaci-badanaci','anahtar-teslim-tadilat'],areas:[{city:'Muğla',district:'Bodrum'},{city:'Muğla',district:'Milas'}],
 phone:'0532 123 45 67',whatsapp:'',email:'Info@Deniz-Boya.example',website:'https://deniz-boya.example/',logo:photo(user),cover:null,photos:[photo(user),photo(user)],taxOffice:'Bodrum',taxNumber:'1234567890',terms:true,...extra});
const rejects=(promise,status,pattern)=>assert.rejects(promise,e=>e instanceof S.ServiceError&&e.status===status&&(!pattern||pattern.test(e.message)));
const LOCALES=['de','fr','en','ar','fa','ru','nl'];

test('taxonomy: every requested category exists once, in its group, with icon, slug and all translations',()=>{
 assert.equal(SERVICE_GROUPS.length,6);assert.equal(SERVICE_CATEGORIES.length,31);
 const slugs=SERVICE_CATEGORIES.map(c=>c.slug);assert.equal(new Set(slugs).size,slugs.length);
 for(const c of SERVICE_CATEGORIES){assert.match(c.slug,/^[a-z0-9]+(-[a-z0-9]+)*$/);assert.ok(SERVICE_GROUPS.some(g=>g.id===c.group),c.slug);assert.ok(c.description.length>20,c.slug);assert.equal(serviceCategory(c.slug),c);}
 for(const g of SERVICE_GROUPS)assert.ok(SERVICE_CATEGORIES.some(c=>c.group===g.id),g.id);
 // Static route segment of firm profiles must never be a category.
 assert.ok(!slugs.includes('firma'));assert.equal(serviceCategory('firma'),null);
 const required=['Boyacı','Tesisatçı','Elektrikçi','Fayans','Marangoz','Çatı','PVC','Klima','Anahtar teslim','Bahçıvan','Havuz','İlaçlama','nakliyat','temizliği','Halı','depolama','Tapu takibi','avukatı','tercüman','ekspertiz','Mali müşavir','Konut kredisi','DASK','Mülk yönetimi','Kısa dönem','Oturma izni','Abonelik','İç mimar','Akıllı ev','beyaz eşya','drone'];
 for(const part of required)assert.ok(SERVICE_CATEGORIES.some(c=>c.name.includes(part)),part);
 const iconSource=readFileSync(path.join(root,'components/ServiceIcon.tsx'),'utf8'),mapped=new Set(iconSource.match(/SERVICE_ICONS: Record<string, LucideIcon> = \{([^}]+)\}/)[1].split(',').map(s=>s.trim()));
 for(const item of [...SERVICE_CATEGORIES,...SERVICE_GROUPS])assert.ok(mapped.has(item.icon),`${item.icon} is not mapped in ServiceIcon.tsx`);
 for(const key of [...SERVICE_GROUPS.map(g=>g.name),...SERVICE_CATEGORIES.flatMap(c=>[c.name,c.description]),...Object.values(S.SERVICE_STATUS_LABELS)])for(const locale of LOCALES)assert.ok(words[key]?.[locale]?.trim(),`Missing ${locale}: ${key}`);
 for(const slug of [...listingServiceSlugs('kiralik',false),...listingServiceSlugs('satilik',true),...listingServiceSlugs('satilik',false),...FOREIGN_BUYER_SERVICES])assert.ok(serviceCategory(slug),slug);
 assert.ok(listingServiceSlugs('satilik',true).includes('yeminli-tercuman'));assert.ok(listingServiceSlugs('kiralik',false).includes('evden-eve-nakliyat'));assert.deepEqual(listingServiceSlugs('gunluk',true),[]);
});

test('URLs: category, province and district slugs round-trip; anything else is a 404',()=>{
 assert.equal(S.servicePath('evden-eve-nakliyat'),'/hizmetler/evden-eve-nakliyat');
 assert.equal(S.servicePath('evden-eve-nakliyat','İstanbul','Kadıköy'),'/hizmetler/evden-eve-nakliyat/istanbul/kadikoy');
 assert.equal(S.servicePath('tesisatci','Muğla','Bodrum'),'/hizmetler/tesisatci/mugla/bodrum');
 assert.equal(S.servicePath('tesisatci','Atlantis','Bodrum'),'/hizmetler/tesisatci');assert.equal(S.servicePath('tesisatci','Muğla','Kadıköy'),'/hizmetler/tesisatci/mugla');assert.equal(S.servicePath('bilinmeyen'),'/hizmetler');
 assert.deepEqual(S.resolveServicePath(['tesisatci']),{category:'tesisatci'});
 assert.deepEqual(S.resolveServicePath(['tesisatci','mugla','bodrum']),{category:'tesisatci',city:'Muğla',district:'Bodrum'});
 for(const bad of [['firma'],['tesisatci','atlantis'],['tesisatci','mugla','kadikoy'],['tesisatci','Mugla'],['tesisatci','mugla','bodrum','x'],[]])assert.equal(S.resolveServicePath(bad),null,bad.join('/'));
 let checked=0;
 for(const [city,list] of Object.entries(DISTRICTS))for(const district of list.slice(0,3)){const p=S.servicePath('temizlik',city,district);assert.deepEqual(S.resolveServicePath(p.split('/').slice(2)),{category:'temizlik',city,district},p);checked++;}
 assert.ok(checked>200);
 assert.equal(S.firmPath('abc'),'/hizmetler/firma/abc');
});

test('validation: lengths, categories, areas, phone, e-mail, website, foreign photos, consent',async()=>{
 const {sql,db}=fixture();try{
  await rejects(S.createFirm(db,me,valid(owner,{name:'AB'})),400,/Firma adı/);
  await rejects(S.createFirm(db,me,valid(owner,{description:'Kısa'})),400,/açıklaması/);
  await rejects(S.createFirm(db,me,valid(owner,{translations:{xx:'Hallo'}})),400,/çeviri/);
  await rejects(S.createFirm(db,me,valid(owner,{categories:[]})),400,/kategori/);
  await rejects(S.createFirm(db,me,valid(owner,{categories:['boyaci-badanaci','uzay-yolculugu']})),400,/kategori/);
  await rejects(S.createFirm(db,me,valid(owner,{categories:SERVICE_CATEGORIES.slice(0,9).map(c=>c.slug)})),400,/8/);
  await rejects(S.createFirm(db,me,valid(owner,{areas:[]})),400,/bölge/);
  await rejects(S.createFirm(db,me,valid(owner,{areas:[{city:'Muğla',district:'Kadıköy'}]})),400,/bölge/);
  await rejects(S.createFirm(db,me,valid(owner,{phone:'12'})),400,/telefon/);
  await rejects(S.createFirm(db,me,valid(owner,{whatsapp:'abc'})),400,/WhatsApp/);
  await rejects(S.createFirm(db,me,valid(owner,{email:'not-an-email'})),400,/e-posta/);
  await rejects(S.createFirm(db,me,valid(owner,{website:'http://plain.example'})),400,/https/);
  await rejects(S.createFirm(db,me,valid(owner,{website:'javascript:alert(1)'})),400,/https/);
  await rejects(S.createFirm(db,me,valid(owner,{logo:photo(other)})),403);
  await rejects(S.createFirm(db,me,valid(owner,{photos:['https://evil.test/x.jpg']})),403);
  await rejects(S.createFirm(db,me,valid(owner,{photos:Array.from({length:13},()=>photo())})),400,/12/);
  const twice=photo();await rejects(S.createFirm(db,me,valid(owner,{logo:twice,photos:[twice]})),400,/birden fazla/);
  await rejects(S.createFirm(db,me,valid(owner,{taxNumber:'12ab'})),400,/Vergi numarası/);
  await rejects(S.createFirm(db,me,valid(owner,{terms:false})),400,/onaylayın/);
  const used=photo();sql.prepare('INSERT INTO property_images VALUES(?)').run(used.slice('/api/media/'.length));
  await rejects(S.createFirm(db,me,valid(owner,{photos:[used]})),409);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM service_firms').get().n,0);
  // Whole province swallows its districts; e-mail is normalised; empty translations are dropped.
  const clean=S.validateFirm(valid(owner,{areas:[{city:'Muğla',district:'Bodrum'},{city:'Muğla',district:''},{city:'İzmir',district:'Urla'},{city:'İzmir',district:'Urla'}]}),owner);
  assert.deepEqual(clean.areas,[{city:'İzmir',district:'Urla'},{city:'Muğla',district:''}]);
  assert.equal(clean.email,'info@deniz-boya.example');assert.deepEqual(clean.translations,{en:'Interior and exterior painting in Bodrum and Milas.'});assert.equal(clean.phone,'+905321234567');
 }finally{sql.close()}
});

test('profile CRUD: one firm per member, owners only, edits go back to review, suspension sticks',async()=>{
 const {sql,db}=fixture();try{
  const created=await S.createFirm(db,me,valid());
  assert.equal(created.status,'pending');
  await rejects(S.createFirm(db,me,valid()),409,/zaten/);
  const mine=await S.ownerFirm(db,owner);
  assert.equal(mine.id,created.id);assert.equal(mine.taxNumber,'1234567890');assert.deepEqual(mine.categories,['boyaci-badanaci','anahtar-teslim-tadilat']);assert.equal(mine.areas.length,2);
  assert.equal(await S.ownerFirm(db,other),null);
  await rejects(S.updateFirm(db,them,created.id,{name:'Ele geçirildi'}),403);
  await rejects(S.deleteFirm(db,them,created.id),403);
  await rejects(S.updateFirm(db,me,'not-an-id',{}),404);
  // Another member's photos (their upload folder) can never be attached.
  const theirs=photo(other);await S.createFirm(db,them,valid(other,{logo:theirs,photos:[]}));
  await rejects(S.updateFirm(db,me,created.id,{cover:theirs}),403);
  await S.reviewFirm(db,admin,created.id,'approve','');
  const keep=mine.photos[0],update=await S.updateFirm(db,me,created.id,{photos:[keep],categories:['tesisatci']});
  assert.equal(update.status,'pending');
  assert.deepEqual(update.removedKeys,[mine.photos[1].slice('/api/media/'.length)]);
  assert.deepEqual((await S.ownerFirm(db,owner)).categories,['tesisatci']);
  await S.reviewFirm(db,admin,created.id,'suspend','Şikayet inceleniyor');
  const stillSuspended=await S.updateFirm(db,me,created.id,{name:'Deniz Boya Yeni'});
  assert.equal(stillSuspended.status,'suspended');assert.equal((await S.ownerFirm(db,owner)).reviewNote,'Şikayet inceleniyor');
  // Administrators edit without changing the status.
  await S.reviewFirm(db,admin,created.id,'approve','');
  assert.equal((await S.updateFirm(db,boss,created.id,{name:'Deniz Boya (yönetici)'})).status,'approved');
  const removed=await S.deleteFirm(db,me,created.id);
  assert.equal(removed.imageKeys.length,2);// logo + remaining work photo
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM service_firm_categories WHERE firm_id=?').get(created.id).n,0);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM service_firm_areas WHERE firm_id=?').get(created.id).n,0);
  assert.equal(await S.ownerFirm(db,owner),null);
 }finally{sql.close()}
});

test('approval flow: only approved firms are public, counted and served; notes are required for refusals',async()=>{
 const {sql,db}=fixture();try{
  const {id}=await S.createFirm(db,me,valid());
  assert.deepEqual(await S.publicFirms(db,{category:'boyaci-badanaci'}),[]);
  assert.equal(await S.firmById(db,id),null);
  assert.equal((await S.categoryCounts(db))['boyaci-badanaci'],0);
  const preview=await S.firmById(db,id,me);assert.equal(preview.status,'pending');assert.equal(preview.taxNumber,'1234567890');
  assert.equal(await S.firmById(db,id,them),null);
  assert.equal((await S.firmById(db,id,boss)).ownerId,owner);
  const logoKey=(await S.ownerFirm(db,owner)).logo.slice('/api/media/'.length);
  assert.equal(await S.serviceMediaPublic(db,logoKey),false);
  await rejects(S.reviewFirm(db,admin,id,'reject',''),400,/nedenini/);
  await rejects(S.reviewFirm(db,admin,id,'delete-everything','x'),400);
  await rejects(S.reviewFirm(db,admin,crypto.randomUUID(),'approve',''),404);
  assert.equal((await S.reviewFirm(db,admin,id,'reject','Vergi bilgisi eksik')).status,'rejected');
  assert.equal(await S.firmById(db,id),null);
  assert.equal((await S.adminFirms(db,'rejected')).firms[0].ownerEmail,'ayse@example.test');
  assert.equal((await S.reviewFirm(db,admin,id,'approve','')).status,'approved');
  const pub=await S.firmById(db,id);
  assert.equal(pub.name,'Deniz Boya Dekorasyon');assert.equal(pub.taxNumber,undefined);assert.equal(pub.ownerId,undefined);assert.equal(pub.reviewNote,undefined);
  assert.equal((await S.categoryCounts(db))['boyaci-badanaci'],1);
  assert.equal(await S.serviceMediaPublic(db,logoKey),true);assert.equal(await S.serviceMediaPublic(db,'../etc/passwd'),false);
  assert.equal(S.firmDescription(pub,'en'),'Interior and exterior painting in Bodrum and Milas.');assert.equal(S.firmDescription(pub,'de'),pub.description);
  // Featured and verified firms come first.
  const second=await S.createFirm(db,them,valid(other,{name:'Can Tadilat'}));await S.reviewFirm(db,admin,second.id,'approve','');
  await S.reviewFirm(db,admin,second.id,'feature','');await S.reviewFirm(db,admin,second.id,'verify','');
  const listed=await S.publicFirms(db,{category:'boyaci-badanaci',city:'Muğla'});
  assert.deepEqual(listed.map(f=>f.name),['Can Tadilat','Deniz Boya Dekorasyon']);assert.equal(listed[0].featured,true);assert.equal(listed[0].verified,true);
  await S.reviewFirm(db,admin,second.id,'suspend','Müşteri şikâyetleri');
  assert.deepEqual((await S.publicFirms(db,{category:'boyaci-badanaci'})).map(f=>f.name),['Deniz Boya Dekorasyon']);
  const {totals}=await S.adminFirms(db,'pending');assert.deepEqual(totals,{pending:0,approved:1,rejected:0,suspended:1});
 }finally{sql.close()}
});

test('category and region pages: province-wide firms show on district pages, but only own firms make a page indexable',async()=>{
 const {sql,db}=fixture();try{
  const a=await S.createFirm(db,me,valid(owner,{categories:['evden-eve-nakliyat'],areas:[{city:'Muğla',district:''}]}));// whole province
  const b=await S.createFirm(db,them,valid(other,{name:'Bodrum Nakliyat',categories:['evden-eve-nakliyat'],areas:[{city:'Muğla',district:'Bodrum'},{city:'İzmir',district:'Urla'}]}));
  for(const firm of [a,b])await S.reviewFirm(db,admin,firm.id,'approve','');
  const facets=await S.serviceFacets(db,'evden-eve-nakliyat');
  const country=S.summarizeService({category:'evden-eve-nakliyat'},facets);
  assert.equal(country.count,2);assert.ok(S.serviceIndexable(country));
  assert.deepEqual(country.cities.map(l=>[l.path,l.count]),[['/hizmetler/evden-eve-nakliyat/mugla',2],['/hizmetler/evden-eve-nakliyat/izmir',1]]);
  const mugla=S.summarizeService({category:'evden-eve-nakliyat',city:'Muğla'},facets);
  assert.equal(mugla.count,2);assert.deepEqual(mugla.districts.map(l=>l.path),['/hizmetler/evden-eve-nakliyat/mugla/bodrum']);
  const bodrum=S.summarizeService({category:'evden-eve-nakliyat',city:'Muğla',district:'Bodrum'},facets);
  assert.deepEqual([bodrum.count,bodrum.local],[2,1]);assert.ok(S.serviceIndexable(bodrum));
  const milas=S.summarizeService({category:'evden-eve-nakliyat',city:'Muğla',district:'Milas'},facets);
  assert.deepEqual([milas.count,milas.local],[1,0]);assert.equal(S.serviceIndexable(milas),false);
  assert.deepEqual((await S.publicFirms(db,{category:'evden-eve-nakliyat',city:'Muğla',district:'Milas'})).map(f=>f.id),[a.id]);
  assert.equal((await S.publicFirms(db,{category:'evden-eve-nakliyat',city:'Muğla',district:'Bodrum'})).length,2);
  const empty=S.summarizeService({category:'havuz-bakimi',city:'Muğla'},await S.serviceFacets(db,'havuz-bakimi'));
  assert.deepEqual([empty.count,empty.local],[0,0]);assert.equal(S.serviceIndexable(empty),false);
 }finally{sql.close()}
});

test('sitemap: approved firms and pages with their own firms only',async()=>{
 const {sql,db}=fixture();try{
  const a=await S.createFirm(db,me,valid(owner,{categories:['tapu-takibi'],areas:[{city:'Antalya',district:''}]}));
  const b=await S.createFirm(db,them,valid(other,{name:'Alanya Tercüme',categories:['yeminli-tercuman','tapu-takibi'],areas:[{city:'Antalya',district:'Alanya'}]}));
  await S.reviewFirm(db,admin,a.id,'approve','');// b stays pending
  let entries=await S.serviceSitemapEntries(db);
  assert.deepEqual(entries.pages.map(p=>p.path).sort(),['/hizmetler/tapu-takibi','/hizmetler/tapu-takibi/antalya']);
  assert.deepEqual(entries.firms.map(f=>f.path),[`/hizmetler/firma/${a.id}`]);
  await S.reviewFirm(db,admin,b.id,'approve','');
  entries=await S.serviceSitemapEntries(db);
  assert.deepEqual(entries.pages.map(p=>[p.path,p.count]),[['/hizmetler/tapu-takibi',2],['/hizmetler/tapu-takibi/antalya',2],['/hizmetler/tapu-takibi/antalya/alanya',1],['/hizmetler/yeminli-tercuman',1],['/hizmetler/yeminli-tercuman/antalya',1],['/hizmetler/yeminli-tercuman/antalya/alanya',1]]);
  assert.ok(entries.pages.every(p=>p.updatedAt));assert.equal(entries.firms.length,2);
  assert.equal(S.serviceSitemapPaths([{firm_id:'x',category:'bilinmeyen',city:'Antalya',district:''}]).length,0);
 }finally{sql.close()}
});

test('headings and breadcrumbs follow each language; place names stay Turkish',()=>{
 assert.equal(serviceHeading('evden-eve-nakliyat','tr','Bodrum'),'Bodrum evden eve nakliyat');
 assert.equal(serviceHeading('ekspertiz-degerleme','tr','Bodrum'),'Bodrum SPK lisanslı ekspertiz ve değerleme');
 assert.equal(serviceHeading('ic-mimar-dekorasyon','tr','İzmir'),'İzmir iç mimar ve dekorasyon');
 assert.equal(serviceHeading('evden-eve-nakliyat','en','Bodrum'),'Removals in Bodrum');
 assert.equal(serviceHeading('evden-eve-nakliyat','de'),'Umzugsunternehmen in der Türkei');
 assert.equal(serviceHeading('tesisatci','fr'),'Plombier en Turquie');
 assert.equal(serviceHeading('tesisatci','ar','Antalya'),'سبّاك في Antalya');
 assert.deepEqual(serviceCrumbs({category:'tesisatci',city:'Muğla',district:'Bodrum'},'en').map(c=>c.path),['/','/hizmetler','/hizmetler/tesisatci','/hizmetler/tesisatci/mugla','/hizmetler/tesisatci/mugla/bodrum']);
 assert.match(serviceDescription('X',0,'en'),/No approved firm/);assert.match(serviceDescription('X',3,'en'),/^X\. 3 approved firms/);
});
