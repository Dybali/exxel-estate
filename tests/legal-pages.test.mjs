import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function load(file){const m={exports:{}};new Function('require','module','exports',ts.transpile(read(file),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}))(()=>({}),m,m.exports);return m.exports;}
const LEGAL=['/gizlilik-politikasi','/cerez-politikasi','/kullanim-kosullari','/ilan-kurallari','/impressum'];

test('legal page strings are translated into every language',()=>{
 const {legalWords}=load('lib/legal-translations.ts');
 for(const [key,row] of Object.entries(legalWords))for(const locale of ['de','fr','en','ar','fa','ru','nl']){assert.ok(row[locale]?.trim(),`${locale}: ${key}`);assert.notEqual(row[locale],key,`${locale} untranslated: ${key}`);}
 assert.match(read('lib/i18n-dictionary.ts'),/Object\.assign\(words,legalWords\)/);
});

test('every legal page has a route, uses the shared layout and is cross-linked',()=>{
 const shared=read('components/LegalPage.tsx');
 for(const href of LEGAL){assert.ok(fs.existsSync(path.join(root,'app',href.slice(1),'page.tsx')),href);assert.ok(shared.includes(`href: "${href}"`),`hub link ${href}`);}
 for(const file of ['PrivacyPolicy','CookiePolicy','TermsOfUse','ListingRules','Imprint'])assert.match(read(`components/${file}.tsx`),/<LegalPage\b/,file);
 assert.match(read('components/Footer.tsx'),/href="\/kullanim-kosullari"/);
 assert.match(read('lib/seo-copy.ts'),/"\/kullanim-kosullari": \{/);
 assert.match(read('app/sitemap.ts'),/"\/kullanim-kosullari"/);
 assert.match(read('app/layout.tsx'),/import "\.\/legal\.css";/);
});

test('privacy policy reflects the current hosting and no longer names Neon',()=>{
 const privacy=read('components/PrivacyPolicy.tsx');
 assert.doesNotMatch(privacy,/Neon/);
 for(const fact of ['Mittwald','Cloudflare R2','AES-256-GCM','Google Gemini','DeepL','noreply@estatemarket24.com','<LegalRights/>'])assert.ok(privacy.includes(fact),fact);
});
