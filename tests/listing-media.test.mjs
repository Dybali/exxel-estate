import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
const code=ts.transpile(readFileSync(new URL('../lib/listing-media.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const {listingMediaKeys,removeListingMedia}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const owner='af102d54-cbdf-438f-b531-1e5c9d233b87';
const url=name=>`/api/media/listings/${owner}/${name}.webp`;

test('a listing removes every file it uses: photos, 360° scenes and floor plan',()=>{
 assert.deepEqual(listingMediaKeys([url('a'),url('b'),url('a')],{panoramas:[{url:url('p')}],floorPlan:url('f')}),[`listings/${owner}/a.webp`,`listings/${owner}/b.webp`,`listings/${owner}/p.webp`,`listings/${owner}/f.webp`]);
 assert.deepEqual(listingMediaKeys(null,null),[]);
 // Only listing uploads are touched, never avatars, documents or outside URLs.
 assert.deepEqual(listingMediaKeys(['https://example.com/x.jpg','/api/media/avatars/x.jpg',42],{floorPlan:''}),[]);
});

test('cleanup is best effort and reports failures without throwing',async()=>{
 const removed=[];
 const failed=await removeListingMedia(['k1','k2','k3'],async key=>{if(key==='k2')throw Error('storage down');removed.push(key);});
 assert.equal(failed,1);assert.deepEqual(removed,['k1','k3']);
});

test('the listing routes clean up removed and deleted media',()=>{
 const route=readFileSync(new URL('../app/api/listings/[id]/route.ts',import.meta.url),'utf8');
 assert.match(route,/removeListingMedia\(\[\.\.\.previousKeys\]\.filter\(key=>!keys\.includes\(key\)\)/);
 assert.match(route,/removeListingMedia\(listingMediaKeys\(JSON\.parse\(row\.images/);
});
