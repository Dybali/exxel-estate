import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
function load(file){const m={exports:{}};new Function('require','module','exports',ts.transpile(fs.readFileSync(new URL('../lib/'+file+'.ts',import.meta.url),'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(n=>n==='@/data/province-centers.json'?{default:JSON.parse(fs.readFileSync(new URL('../data/province-centers.json',import.meta.url),'utf8'))}:n.startsWith('./')?load(n.slice(2)):{},m,m.exports);return m.exports;}
const {validArea,areaBounds,insideArea,listingInArea,cleanSearch}=load('search-filters');
const triangle='28.9,41.0;29.1,41.0;29.0,41.2';
test('drawn areas need 3 to 40 numeric corners',()=>{assert.equal(validArea('28.9,41;29,41'),null);assert.equal(validArea('a,b;c,d;e,f'),null);assert.equal(validArea(Array(41).fill('29,41').join(';')),null);assert.equal(validArea(triangle).length,3);});
test('bounding box encloses the polygon',()=>{assert.deepEqual(areaBounds(validArea(triangle)),[28.9,41,29.1,41.2]);});
test('points are tested inside the polygon, not just the box',()=>{const area=validArea(triangle);assert.ok(insideArea(29.0,41.05,area));assert.ok(!insideArea(28.92,41.18,area));});
test('listings without exact coordinates use the province centre',()=>{const area=validArea('25,35;45,35;45,43;25,43');assert.ok(listingInArea({city:'Ankara'},area));assert.ok(!listingInArea({city:'Nowhere'},area));});
test('saved searches keep a valid drawn area and drop an invalid one',()=>{assert.match(cleanSearch('area='+encodeURIComponent(triangle)),/area=/);assert.doesNotMatch(cleanSearch('area=1,2'),/area=/);});
