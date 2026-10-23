import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
function load(file,extra=''){const m={exports:{}};new Function('require','module','exports',ts.transpile(fs.readFileSync(path.join(root,file),'utf8')+extra,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}))(name=>{if(name.startsWith('@/'))return name.endsWith('.json')?JSON.parse(fs.readFileSync(path.join(root,name.slice(2)),'utf8')):load(name.slice(2)+'.ts');if(name.startsWith('./'))return load(path.join(path.dirname(file),name)+'.ts');return require(name);},m,m.exports);return m.exports;}
const dictionary=load('lib/i18n.tsx','\nexport const dictionary=words;').dictionary;
const locales=['de','fr','en','ar','ru'];
function check(key){if(/^ESTATEMARKET24/.test(key))return;for(const locale of locales)assert.ok(dictionary[key]?.[locale]?.trim(),`Missing ${locale}: ${key}`);}
test('literal UI translation keys have coverage in all five languages',()=>{
 const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);
 for(const file of [...files(path.join(root,'app')),...files(path.join(root,'components'))].filter(f=>f.endsWith('.tsx'))){const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const visit=n=>{if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='t'){const collect=x=>{if(ts.isStringLiteral(x))check(x.text);else if(ts.isConditionalExpression(x)){collect(x.whenTrue);collect(x.whenFalse);}};if(n.arguments[0])collect(n.arguments[0]);}ts.forEachChild(n,visit);};visit(source);}
});
test('dynamic pricing labels and features have complete language coverage',()=>{
 const source=ts.createSourceFile('pricing',fs.readFileSync(path.join(root,'app/paketler/page.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const visit=n=>{if(ts.isPropertyAssignment(n)&&['name','description','tag','audience'].includes(n.name.getText(source))&&ts.isStringLiteral(n.initializer))check(n.initializer.text);if(ts.isPropertyAssignment(n)&&n.name.getText(source)==='features'&&ts.isArrayLiteralExpression(n.initializer))for(const v of n.initializer.elements)if(ts.isStringLiteral(v))check(v.text);ts.forEachChild(n,visit);};visit(source);
});
test('timeshare has a familiar label in every supported language',()=>{check('Devre mülk');assert.equal(dictionary['Devre mülk'].de,'Timesharing');assert.equal(dictionary['Devre mülk'].fr,'Multipropriété');assert.equal(dictionary['Devre mülk'].en,'Timeshare');assert.equal(dictionary['Devre mülk'].ru,'Таймшер');});
test('editorial dates and reading time follow locale; translated sources retain URLs',()=>{
 const {editorialDate,editorialReadTime,editorialFields,localizedArticle,editorialArticles}=load('lib/editorial.ts');
 assert.equal(editorialDate('2026-10-16','de'),'16. Oktober 2026');assert.match(editorialDate('2026-10-16','en'),/October/);assert.equal(editorialReadTime('3 dk','de'),'3 Min.');
 const original=editorialArticles[0];assert.ok(editorialFields(original)['source.name']);const localized=localizedArticle(original,{'source.name':'Source name','source.date':'October 2026'});assert.equal(localized.source.name,'Source name');assert.equal(localized.source.date,'October 2026');assert.equal(localized.source.url,original.source.url);
});

test('cookie inventory has all five translations for every dynamically rendered label',()=>{const {cookiePolicyWords}=load('lib/cookie-policy-translations.ts');for(const [key,values] of Object.entries(cookiePolicyWords)){assert.equal(values.length,5,key);for(const value of values)assert.ok(value.trim()&&value!==key,key);}for(const key of ['Zorunlu','İstatistik','Yerel depolama','Dil tercihi','Güvenli üye oturumu','30 gün','10 dakika','180 gün','Siz silene kadar'])check(key);});
