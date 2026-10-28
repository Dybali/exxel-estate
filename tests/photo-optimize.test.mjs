import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const m={exports:{}};new Function('require','module','exports',ts.transpile(fs.readFileSync(new URL('../lib/photo-optimize.ts',import.meta.url),'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(()=>({}),m,m.exports);
const {scaledSize,watermarkLayout,MAX_PHOTO_EDGE}=m.exports;
test('large photos shrink to the maximum long edge and keep aspect ratio',()=>{assert.deepEqual(scaledSize(6000,4000),{width:MAX_PHOTO_EDGE,height:1707});assert.deepEqual(scaledSize(3000,4000),{width:1920,height:MAX_PHOTO_EDGE});});
test('photos within the limit are never enlarged',()=>{assert.deepEqual(scaledSize(1600,1200),{width:1600,height:1200});});
test('watermark scales with the shorter edge and stays inside the frame',()=>{const w=watermarkLayout(2560,1707);assert.equal(w.fontSize,60);assert.ok(w.x<2560&&w.y<1707);assert.equal(watermarkLayout(400,300).fontSize,14);});
