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
