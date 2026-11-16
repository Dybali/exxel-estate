import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=(file,deps)=>{const m={exports:{}};new Function('require','module','exports',ts.transpile(readFileSync(new URL('../lib/'+file+'.ts',import.meta.url),'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(name=>deps[name],m,m.exports);return m.exports;};
const districts={__esModule:true,default:JSON.parse(readFileSync(new URL('../data/locations/districts.json',import.meta.url),'utf8'))};
const regions=load('region-pages',{'@/data/locations/districts.json':districts,'./turkey-locations':load('turkey-locations',{'@/data/locations/districts.json':districts})});
const turkey=load('turkey-locations',{'@/data/locations/districts.json':districts});
const L=load('service-locations',{'./turkey-locations':turkey,'./region-pages':regions});
test('Hizmetler and Müteahhitler accept Turkish provinces with districts and German cities without',()=>{
  assert.equal(L.areaCountry('İzmir'),'TR');assert.equal(L.areaCountry('München'),'DE');assert.equal(L.areaCountry('Paris'),null);
  assert.equal(L.validArea('İzmir','Bornova'),true);assert.equal(L.validArea('İzmir',''),true);assert.equal(L.validArea('İzmir','Mitte'),false);
  assert.equal(L.validArea('Berlin',''),true);assert.equal(L.validArea('Berlin','Mitte'),false,'German cities have no districts');
  assert.deepEqual(L.areaDistricts('Berlin'),[]);assert.ok(L.areaDistricts('İzmir').includes('Bornova'));
  assert.equal(L.areaCityBySlug('munchen'),'München');assert.equal(L.areaCityBySlug('frankfurt-am-main'),'Frankfurt am Main');assert.equal(L.areaCityBySlug('izmir'),'İzmir');
  assert.equal(L.areaDistrictBySlug('Berlin','mitte'),null);
});
test('no German city shares a name or URL slug with a Turkish province',()=>{
  const slugs=new Set(turkey.CITIES.map(regions.regionSlug));
  for(const city of L.GERMAN_CITIES){assert.equal(turkey.CITIES.includes(city),false,city);assert.equal(slugs.has(regions.regionSlug(city)),false,city);}
  assert.equal(new Set(L.GERMAN_CITIES).size,L.GERMAN_CITIES.length);
});
