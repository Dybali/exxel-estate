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
