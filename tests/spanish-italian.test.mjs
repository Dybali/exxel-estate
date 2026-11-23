import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
function load(file,extra=''){const m={exports:{}};new Function('require','module','exports',ts.transpile(fs.readFileSync(path.join(root,file),'utf8')+extra,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}))(name=>{if(name.startsWith('@/'))return name.endsWith('.json')?JSON.parse(fs.readFileSync(path.join(root,name.slice(2)),'utf8')):load(name.slice(2)+'.ts');if(name.startsWith('./'))return load(path.join(path.dirname(file),name)+'.ts');return require(name);},m,m.exports);return m.exports;}
// Spanish and Italian (2026-11-23): overlays keyed by the Turkish source text, English where a key has none.
const D=load('lib/i18n-dictionary.ts');
const L=load('lib/locales.ts');

test('Spanish and Italian are site languages with their own flag, left to right',()=>{
 for(const code of ['es','it']){assert.ok(L.isLocale(code));assert.equal(L.isRtl(code),false);assert.ok(fs.existsSync(path.join(root,'public/flags',L.locales.find(l=>l.code===code).flag+'.svg')));}
});

test('every overlay key exists in the dictionary and keeps the placeholders of the English text',()=>{
 const holes=s=>(String(s).match(/\{[a-zA-Z]+\}/g)||[]).sort().join();
 for(const code of ['es','it']){
  const overlay=JSON.parse(fs.readFileSync(path.join(root,`data/${code}-translations.json`),'utf8'));
  assert.ok(Object.keys(overlay).length>4000,`${code}: overlay too small`);
  for(const [key,value] of Object.entries(overlay)){assert.ok(D.words[key],`${code}: unknown key ${key}`);assert.equal(holes(value),holes(D.words[key].en),`${code}: ${key}`);}
 }
});

test('messages: translated text, English for a key without an entry, nothing Turkish left over',()=>{
 assert.equal(D.translate('Satılık','es'),'En venta');
 assert.equal(D.translate('Komisyonsuz','it'),'Senza commissione');
 D.words['Yalnızca test anahtarı']={en:'Test only key'};
 assert.equal(D.translate('Yalnızca test anahtarı','es'),'Test only key');assert.equal(D.translate('Yalnızca test anahtarı','it'),'Test only key');
 delete D.words['Yalnızca test anahtarı'];
 for(const code of ['es','it']){const messages=D.messagesFor(code);assert.equal(Object.keys(messages).length,Object.keys(D.words).filter(key=>D.words[key][code]||D.words[key].en).length);}
});
