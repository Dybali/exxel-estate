import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),nativeRequire=createRequire(import.meta.url);
function load(file,overrides={}){const full=path.resolve(root,file),module={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(overrides[name])return overrides[name];if(name.startsWith('.')||name.startsWith('@/')){const resolved=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return resolved.endsWith('.json')?JSON.parse(readFileSync(resolved,'utf8')):load(resolved+'.ts',overrides);}return nativeRequire(name);},module,module.exports);return module.exports;}
const core=load('lib/translation.ts'),stored=load('lib/translation-stored.ts');
const seo=load('lib/listing-seo.ts',{'./request-context':{siteUrl:()=>'https://example.test',localizedUrl:(p,l)=>'https://example.test'+p+(l==='tr'?'':'?lang='+l)}});
function database(){const sql=new DatabaseSync(':memory:');const queries=[];return {sql,queries,prepare(query){queries.push(query);return {values:[],bind(...values){this.values=values;return this;},async first(){return sql.prepare(query).get(...this.values)||null;},async all(){return {results:sql.prepare(query).all(...this.values)};},async run(){return sql.prepare(query).run(...this.values);}};},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};}
const key=(locale,text)=>core.translationHash('deepl:auto:realestate-v1:'+locale+':'+text);
async function save(db,locale,text,translated){await stored.storedTranslation(db,{kind:'listing',id:'x',fields:{t:'warm-up'}},locale);db.sql.prepare('INSERT INTO content_translations(key,translated_text,detected_language,created_at) VALUES(?,?,?,?)').run(await key(locale,text),translated,'de','2026-11-16');}
const german={id:'aaaaaaaa-0000-4000-8000-000000000001',title:'Wohnung mit Meerblick',description:'Helle Wohnung, 90 m², nahe am Strand.',presentation:{language:'de'}};

test('a saved translation is returned for the page language and used for title, description and inLanguage',async()=>{const db=database(),original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('no provider during rendering');};try{
 await save(db,'tr',german.title,'Deniz manzaralı daire');await save(db,'tr',german.description,'Aydınlık daire, 90 m², plaja yakın.');
 const result=await stored.storedListingTranslation(db,german,'tr');
 assert.deepEqual(result,{locale:'tr',fields:{title:'Deniz manzaralı daire',description:'Aydınlık daire, 90 m², plaja yakın.'},machine:true});
 const text=seo.localizedListingText({...german,images:[]},'tr',result.fields);
 assert.equal(text.title,'Deniz manzaralı daire');assert.equal(text.locale,'tr');
 const ld=seo.listingStructuredData({...german,images:[],price:1,currency:'TRY',purpose:'satilik',grossArea:90,city:'Antalya',district:'Kaş'},text);
 assert.equal(ld.inLanguage,'tr');assert.equal(ld.name,'Deniz manzaralı daire');assert.doesNotMatch(ld.url,/lang=/);
 assert.equal(calls,0);
}finally{db.sql.close();globalThis.fetch=original;}});

test('nothing saved, a partial translation, the own language or a hand translation give no machine text',async()=>{const db=database();try{
 assert.equal(await stored.storedListingTranslation(db,german,'en'),null);
 assert.equal(seo.localizedListingText({...german,images:[]},'en',null).locale,'de');
 await save(db,'fr',german.title,'Appartement vue mer');
 assert.equal(await stored.storedListingTranslation(db,german,'fr'),null,'only complete documents count, as in GET /api/translations');
 const queries=db.queries.length;assert.equal(await stored.storedListingTranslation(db,german,'de'),null);assert.equal(db.queries.length,queries,'no lookup in the listing language');
 // English title by hand: only the description is looked up, and the hand translation keeps priority.
 const manual={...german,translations:{en:{title:'Sea view flat',description:''}}};
 await save(db,'en',german.description,'Bright flat, 90 m², near the beach.');
 const result=await stored.storedListingTranslation(db,manual,'en');assert.deepEqual(result.fields,{description:'Bright flat, 90 m², near the beach.'});
 const text=seo.localizedListingText({...manual,images:[]},'en',{title:'Machine title',...result.fields});assert.equal(text.title,'Sea view flat');assert.equal(text.description,'Bright flat, 90 m², near the beach.');assert.equal(text.locale,'en');
 assert.equal(await stored.storedListingTranslation(null,german,'tr'),null);
 assert.equal(await stored.storedListingTranslation({prepare(){throw Error('down');}},german,'tr'),null,'database errors fall back to the original');
}finally{db.sql.close();}});
