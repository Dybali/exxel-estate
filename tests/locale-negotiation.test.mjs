import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
const source=readFileSync('lib/locale-negotiation.ts','utf8').replace('import { isLocale, type Locale } from "./locales";','const isLocale=v=>["tr","de","fr","en","ar","fa","ru","nl"].includes(v);');
const {negotiateLocale,preferredLocale,acceptedLanguages,LOCALE_COOKIE}=await import('data:text/javascript,'+encodeURIComponent(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText));
test('?lang wins, then the saved choice, then the browser languages, else Turkish',()=>{
 assert.equal(negotiateLocale('fr',`${LOCALE_COOKIE}=de`,'en-GB,en;q=0.9'),'fr');
 assert.equal(negotiateLocale(null,`a=1; ${LOCALE_COOKIE}=de; b=2`,'en-GB,en;q=0.9'),'de');
 assert.equal(negotiateLocale(null,null,'de-AT,de;q=0.9,en;q=0.8'),'de');
 assert.equal(negotiateLocale(null,null,'es-ES,es;q=0.9,en;q=0.8'),'en');
 assert.equal(negotiateLocale(null,null,'es-ES,pt;q=0.9'),'tr');
 assert.equal(negotiateLocale(null,null,null),'tr');
});
test('invalid values are ignored and a Turkish choice is respected for a foreign browser',()=>{
 assert.equal(negotiateLocale('xx',`${LOCALE_COOKIE}=zz`,'en'),'en');
 assert.equal(negotiateLocale(null,`${LOCALE_COOKIE}=tr`,'de'),'tr');
 assert.equal(negotiateLocale(null,`x${LOCALE_COOKIE}=de`,null),'tr');
 assert.deepEqual(acceptedLanguages('de;q=0, en;q=0.5 , *'),['en','*']);
 assert.equal(preferredLocale(['zh-CN','RU-ru']),'ru');assert.equal(preferredLocale([]),undefined);
});
test('the browser keeps the server language unless ?lang or a saved choice says otherwise',()=>{
 const provider=readFileSync('lib/i18n.tsx','utf8');
 assert.match(provider,/const selected = \[requested, saved\]\.find\(isLocale\);/);
 // No second guess from navigator.languages after hydration (crawlers report en-US and pages flipped).
 assert.doesNotMatch(provider,/navigator\.language/);assert.doesNotMatch(provider,/preferredLocale/);
 // An explicit choice is still remembered for the server.
 assert.match(provider,/document\.cookie = `\$\{LOCALE_COOKIE\}=\$\{locale\}/);assert.match(provider,/localStorage\.setItem\("exxel_locale", locale\)/);
});
