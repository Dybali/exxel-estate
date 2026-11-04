import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../lib/share-image-policy.ts',import.meta.url),'utf8');
const policy=await import('data:text/javascript;base64,'+Buffer.from(ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));
const listing={id:'sample-devremulk-01',title:'Örnek · Tatil bölgesinde devre mülk',images:['/editorial/photo-1.webp'],price:650000,currency:'TRY',purpose:'satilik',updatedAt:'2026-11-01T10:00:00Z'};

test('listing previews show the first photo, then the branded card',()=>{
  const [photo,card]=policy.listingShareImages(listing,'tr');
  assert.deepEqual(photo,{url:'/editorial/photo-1.webp',alt:listing.title,type:'image/webp'});
  assert.match(card.url,/^\/ilan\/sample-devremulk-01\/share-image\?v=[0-9a-z]+$/);
  assert.equal(card.width,1200);assert.equal(card.height,630);assert.equal(card.type,'image/png');
  assert.equal(policy.listingShareImages({...listing,images:[]},'de').length,1);
  assert.match(policy.listingShareImages({...listing,images:[]},'de')[0].url,/[?&]lang=de/);
});

test('the card URL changes when the price or title changes, so platforms fetch a new image',()=>{
  const url=item=>policy.listingShareCard(item,'tr').url;
  assert.equal(url(listing),url({...listing}));
  assert.notEqual(url(listing),url({...listing,price:700000}));
  assert.notEqual(url(listing),url({...listing,title:'Yeni başlık'}));
});

test('share image URLs are absolute and covers fall back to the default image',()=>{
  assert.equal(policy.absoluteShareUrl('/og-default.png','https://example.test/'),'https://example.test/og-default.png');
  assert.equal(policy.absoluteShareUrl('https://cdn.example.test/a.jpg','https://example.test'),'https://cdn.example.test/a.jpg');
  assert.equal(policy.coverShareImage(null,'x'),policy.DEFAULT_SHARE_IMAGE);
  assert.deepEqual(policy.coverShareImage('/developers/antalya.webp','Proje'),{url:'/developers/antalya.webp',alt:'Proje'});
  assert.ok(statSync(new URL('../public/og-default.png',import.meta.url)).size<300_000,'default share image stays small');
});

test('card prices use the embedded font (TL instead of ₺)',()=>{
  assert.equal(policy.sharePrice(650000,'TRY','tr'),'650.000 TL');
  assert.equal(policy.sharePrice(250000,'EUR','de'),'250.000 €');
  assert.equal(policy.sharePrice(250000,'USD','en'),'$250,000');
});
