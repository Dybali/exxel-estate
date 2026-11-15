import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importTs} from './ts-module.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const LOCALES=['tr','de','fr','en','ar','fa','ru','nl'];

test('private pages: own localized title, never indexed, matched with their sub-paths',async()=>{
 const {privatePage,privatePageCopy,seoCopy}=await importTs('lib/seo-copy.ts');
 for(const path of ['/giris','/hesabim','/ilan-ver','/ilan-duzenle/abc','/karsilastir','/sifremi-unuttum','/eposta-dogrula','/yonetim','/yonetim/ilan/1','/yonetim/kurulum'])assert.ok(privatePage(path),path);
 for(const path of ['/','/ilanlar','/ilan/abc','/girisimci','/hesabimiz','/sirketler/x'])assert.equal(privatePage(path),null,path);
 assert.equal(privatePage('/karsilastir').follow,true);assert.equal(privatePage('/giris').follow,false);
 for(const [path,entry] of Object.entries(privatePageCopy)){
  for(const locale of LOCALES)assert.ok(entry.title[locale]?.trim(),path+' '+locale);
  assert.notEqual(entry.title.tr,seoCopy['/'].tr[0]);
 }
 // The root layout: private pages get robots noindex; unknown paths never fall back to the home title or a self-canonical.
 const layout=read('app/layout.tsx');
 assert.match(layout,/privatePage\(path\)/);assert.match(layout,/robots: \{ index: false, follow: hidden\.follow \}/);
 assert.doesNotMatch(layout,/seoCopy\[path\] \|\| seoCopy\["\/"\]/);
 assert.match(read('app/yonetim/layout.tsx'),/robots:\{index:false,follow:false\}/);
});

test('unknown ids answer 404 before streaming: listings, companies, projects, seller profiles',async()=>{
 const {existsSync}=await import('node:fs');
 // A loading.tsx boundary lets the 200 shell stream before notFound(); the listing page has none.
 assert.equal(existsSync(new URL('../app/ilan/[id]/loading.tsx',import.meta.url)),false);
 assert.match(read('app/ilan/[id]/page.tsx'),/notFound\(\)/);
 const company=read('app/sirketler/[id]/page.tsx');assert.match(company,/PUBLIC_DEMO_COMPANIES\.some\(/);assert.match(company,/companySummary\(id\)\.catch\(\(\) => undefined\) === null\) notFound\(\)/);
 const project=read('app/projeler/[id]/page.tsx');assert.match(project,/projectActor\(user\)/);assert.match(project,/=== null\) notFound\(\)/);
 assert.match(read('app/profil/[id]/page.tsx'),/publicProfileExists\(db\(\),id\)\.catch\(\(\)=>true\)===false\)notFound\(\)/);
 const {DatabaseSync}=await import('node:sqlite');const {publicProfileExists}=await importTs('lib/seller-profiles.ts');
 const sql=new DatabaseSync(':memory:');
 try{
  sql.exec("CREATE TABLE users(id TEXT,role TEXT)");
  const seller='11111111-1111-4111-8111-111111111111',buyer='22222222-2222-4222-8222-222222222222';
  sql.prepare("INSERT INTO users VALUES(?,?),(?,?)").run(seller,'agent',buyer,'buyer');
  const db={prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null}}}};
  assert.equal(await publicProfileExists(db,seller),true);
  assert.equal(await publicProfileExists(db,buyer),false);
  assert.equal(await publicProfileExists(db,'33333333-3333-4333-8333-333333333333'),false);
  assert.equal(await publicProfileExists(db,"x' OR 1=1 --"),false);
 }finally{sql.close()}
});

test('sample companies are labelled noindex, follow like sample listings',()=>{
 assert.match(read('app/sirketler/[id]/page.tsx'),/sample \? \{ robots: \{ index: false, follow: true \} \}/);
 assert.match(read('app/ilan/[id]/page.tsx'),/listing\.source==='demo'\?\{robots:\{index:false,follow:true\}\}/);
});

test('robots.txt: runtime sitemap address, private pages closed, public read-only APIs open',async()=>{
 const source=read('app/robots.ts');
 assert.match(source,/export const dynamic = "force-dynamic"/);
 // app/robots.ts imports "@/lib/request-context" (next/headers); evaluate it with a stubbed siteUrl.
 const ts=(await import('typescript')).default;
 const code=ts.transpileModule(source.replace('"@/lib/request-context"','"data:text/javascript,export const siteUrl=()=>\'https://site.example\'"'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const {default:robots}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const result=robots(),[rule]=result.rules;
 assert.equal(result.sitemap,'https://site.example/sitemap.xml');
 for(const path of ['/api/','/hesabim','/yonetim','/ilan-ver','/ilan-duzenle','/giris','/karsilastir','/api/projects/mine','/api/listings/*/view','/api/listings/*/contact'])assert.ok(rule.disallow.includes(path),path);
 for(const path of ['/','/ilan/','/api/listings','/api/companies','/api/projects','/api/profiles','/api/media/listings/'])assert.ok(rule.allow.includes(path),path);
 // The browser loads exactly these paths on the public pages.
 assert.match(read('app/page.tsx'),/fetch\("\/api\/listings\?/);assert.match(read('components/Explorer.tsx'),/fetch\(`\/api\/listings\?/);
 assert.match(read('components/ProjectDetail.tsx'),/fetch\(`\/api\/projects\//);assert.match(read('components/CompanyProfile.tsx'),/fetch\(`\/api\/companies\//);
});

// lib modules that import ./request-context (next/headers) load with a stubbed site address.
async function seoModule(file,extra={}){
 const ts=(await import('typescript')).default;
 const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
 const transpile=f=>ts.transpileModule(read(f),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const stubs={'./request-context':url("export const siteUrl=()=>'https://site.example';export const localizedUrl=(path,locale)=>{const u=new URL(path,'https://site.example');if(locale==='tr')u.searchParams.delete('lang');else u.searchParams.set('lang',locale);return u.toString();};"),'./listing-language':url(transpile('lib/listing-language.ts')),...extra};
 let code=transpile(file);for(const [from,to] of Object.entries(stubs))code=code.replaceAll(JSON.stringify(from),JSON.stringify(to));
 return import(url(code));
}
const listing=(extra={})=>({id:'11111111-1111-4111-8111-111111111111',title:'Deniz manzaralı daire',description:'Açıklama',purpose:'satilik',propertyType:'daire',price:5000000,currency:'TRY',city:'Muğla',district:'Bodrum',grossArea:120,amenities:[],images:['/api/media/listings/a.webp'],ownerName:'Ayşe',ownerRole:'agent',publishedAt:'2026-11-11 13:22:11.846189+00',source:'user',...extra});

test('listing JSON-LD: ISO dates, the source language, seller type by owner role',async()=>{
 const {listingStructuredData,localizedListingText,isoDate}=await seoModule('lib/listing-seo.ts');
 assert.equal(isoDate('2026-11-11 13:22:11.846189+00'),'2026-11-11T13:22:11.846Z');
 assert.equal(isoDate('2026-11-11 16:22:11+03'),'2026-11-11T13:22:11.000Z');
 assert.equal(isoDate('2026-11-11T13:22:11.846Z'),'2026-11-11T13:22:11.846Z');
 for(const bad of ['', null, undefined, 'not a date'])assert.equal(isoDate(bad),undefined);
 const agent=listingStructuredData(listing(),localizedListingText(listing(),'en'));
 assert.equal(agent.datePosted,'2026-11-11T13:22:11.846Z');assert.equal(agent.inLanguage,'tr');assert.equal(agent.offers.seller['@type'],'RealEstateAgent');
 assert.equal(agent.url,'https://site.example/ilan/11111111-1111-4111-8111-111111111111');
 const owner=listingStructuredData(listing({ownerRole:'individual',publishedAt:'garbage'}),localizedListingText(listing(),'tr'));
 assert.equal(owner.offers.seller['@type'],'Person');assert.equal('datePosted' in owner,false);
 // Written in German: the text is German wherever no owner translation exists, Turkish pages included.
 const german=listing({presentation:{language:'de'},translations:{en:{title:'Sea view flat',description:'Text'}}});
 assert.equal(localizedListingText(german,'tr').locale,'de');assert.equal(localizedListingText(german,'fr').locale,'de');
 assert.equal(localizedListingText(german,'en').locale,'en');assert.equal(localizedListingText(german,'en').title,'Sea view flat');
 const de=listingStructuredData(german,localizedListingText(german,'tr'));assert.equal(de.inLanguage,'de');assert.match(de.url,/\?lang=de$/);
});

test('breadcrumb and site-wide JSON-LD, with "<" escaped',async()=>{
 const {breadcrumbStructuredData,siteStructuredData,jsonLd}=await seoModule('lib/structured-data.ts',{'./i18n-dictionary':'data:text/javascript,'+encodeURIComponent("export const locales=['tr','de','fr','en','ar','fa','ru','nl'].map(code=>({code}));")});
 const crumbs=breadcrumbStructuredData([{name:'Listings',path:'/ilanlar'},{name:'Muğla',path:'/emlak/mugla'},{name:'Flat',path:'/ilan/x'}],'en');
 assert.equal(crumbs['@type'],'BreadcrumbList');assert.deepEqual(crumbs.itemListElement.map(i=>i.position),[1,2,3]);
 assert.equal(crumbs.itemListElement[1].item,'https://site.example/emlak/mugla?lang=en');
 const [organization,website]=siteStructuredData('https://site.example/');
 assert.equal(organization['@type'],'Organization');assert.equal(organization.name,'EstateMarket24');assert.equal(organization.url,'https://site.example/');assert.equal(organization.logo,'https://site.example/brand/logo-horizontal.svg');
 assert.equal(website['@type'],'WebSite');assert.deepEqual(website.publisher,{'@id':organization['@id']});assert.equal(website.inLanguage.length,8);
 assert.equal(jsonLd({name:'</script><script>alert(1)</script>'}).includes('<'),false);
 assert.match(read('app/layout.tsx'),/jsonLd\(siteStructuredData\(siteUrl\(\)\)\)/);
 const page=read('app/ilan/[id]/page.tsx');assert.match(page,/breadcrumbStructuredData\(\[\{name:translate\('İlanlar',locale\),path:'\/ilanlar'\},\{name:listing\.city,path:cityPath\}/);assert.match(page,/jsonLd\(structured\)/);
});
