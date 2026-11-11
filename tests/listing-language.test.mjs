import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url);
function load(file,overrides={}){const full=path.resolve(root,file),m={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(overrides[name])return overrides[name];if(name.startsWith('.')||name.startsWith('@/')){const p=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return p.endsWith('.json')?JSON.parse(readFileSync(p,'utf8')):load(p+'.ts',overrides);}return native(name);},m,m.exports);return m.exports;}
const L=load('lib/listing-language.ts');
const owner='11111111-1111-4111-8111-111111111111';
test('a listing is Turkish unless it says otherwise; targets are every other site language',()=>{
 assert.equal(L.listingLanguage({}),'tr');assert.equal(L.listingLanguage({presentation:{language:'de'}}),'de');assert.equal(L.listingLanguage({presentation:{language:'xx'}}),'tr');assert.equal(L.listingLanguage(null),'tr');
 assert.deepEqual(L.listingTranslationTargets('de'),['tr','fr','en','ar','fa','ru','nl']);assert.equal(L.listingTranslationTargets('tr').includes('tr'),false);
});
test('the listing form stores a non-Turkish language in the presentation and rejects unknown ones',()=>{
 const {presentationFrom}=load('lib/presentation.ts');
 assert.equal(presentationFrom({language:'de'},owner).language,'de');
 for(const code of L.LISTING_LANGUAGES)assert.equal(presentationFrom({language:code},owner).language,code==='tr'?undefined:code);
 assert.equal('language' in presentationFrom({language:'tr'},owner),false);assert.equal('language' in presentationFrom({},owner),false);
 assert.throws(()=>presentationFrom({language:'xx'},owner),/İlan dilini seçin/);
 // An edit keeps the stored language (the route merges the stored presentation with the form).
 assert.equal(presentationFrom({...presentationFrom({language:'en'},owner),floorPlan:''},owner).language,'en');
});
test('Turkish is a translation target for listings written in another language, never for Turkish text',async()=>{
 const german={status:'published',source:'user',title:'Wohnung mit Meerblick in Alanya',description:'Helle Wohnung mit Balkon, 300 m zum Strand, sofort bezugsfertig.',presentation:{language:'de'},translations:{en:{title:'Manual title',description:'Manual description of the flat.'}}};
 const turkish={status:'published',source:'user',title:'Alanya’da deniz manzaralı daire',description:'Balkonlu, aydınlık daire.',presentation:{}};
 const content=load('lib/translation-content.ts',{'./server':{listingById:async id=>id==='de'?german:turkish},'./editorial':{editorialArticles:[{slug:'post'}],editorialFields:()=>({title:'Başlık'})}});
 assert.equal(await content.translationContent('listing','de','de'),null);
 const toTurkish=await content.translationContent('listing','de','tr');assert.equal(toTurkish.document.fields.title,german.title);assert.deepEqual(toTurkish.manual,{});
 assert.equal((await content.translationContent('listing','de','en')).manual.title,'Manual title');
 assert.equal(await content.translationContent('listing','tr','tr'),null);assert.ok(await content.translationContent('listing','tr','de'));
 assert.equal(await content.translationContent('blog','post','tr'),null);assert.ok(await content.translationContent('blog','post','de'));
});
test('drafts accept the language field and it alone does not count as content',()=>{
 const D=load('lib/listing-drafts.ts');
 const draft=D.validateDraft({fields:{language:'de',purpose:'satilik'},images:[],amenities:[]},owner);assert.equal(draft.fields.language,'de');assert.equal(D.draftHasContent(draft),false);
});
