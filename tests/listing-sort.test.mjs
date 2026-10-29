import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync('lib/listing-sort.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {listingSort,listingOrderSql,compareListings,tryRates,strictSort}=await import('data:text/javascript,'+encodeURIComponent(source));
const ecb={date:'2026-10-29',eurTry:50,usdTry:40,eurUsd:1.25,gbpTry:60,source:'ECB'},rates=tryRates(ecb);
const rows=[
 {id:'a',price:4000000,currency:'TRY',grossArea:120,featured:1,created_at:'2026-10-01',published_at:'2026-10-02'},
 {id:'b',price:100000,currency:'EUR',grossArea:200,featured:0,created_at:'2026-10-20',published_at:'2026-10-21'},
 {id:'c',price:90000,currency:'USD',grossArea:80,featured:0,created_at:'2026-10-10',published_at:null},
 {id:'d',price:70000,currency:'GBP',grossArea:95,featured:0,created_at:'2026-10-25',published_at:'2026-10-28'},
];
function sql(sort){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE listings(id text,price integer,currency text,gross_area integer,featured integer,created_at text,published_at text)');for(const r of rows)db.prepare('INSERT INTO listings VALUES(?,?,?,?,?,?,?)').run(r.id,r.price,r.currency,r.grossArea,r.featured,r.created_at,r.published_at);return db.prepare(`SELECT id FROM listings l ORDER BY ${listingOrderSql(sort,sort.startsWith('price')?rates:null)}`).all().map(r=>r.id);}
const js=sort=>rows.map(r=>({...r,createdAt:r.created_at,publishedAt:r.published_at||undefined,featured:Boolean(r.featured)})).sort(compareListings(sort,sort.startsWith('price')?rates:null)).map(r=>r.id);
test('price sorting compares listings in TRY across currencies',()=>{
 // TRY values: a 4.0M, b 5.0M, c 3.6M, d 4.2M
 assert.deepEqual(sql('priceAsc'),['c','a','d','b']);assert.deepEqual(js('priceAsc'),['c','a','d','b']);
 assert.deepEqual(sql('priceDesc'),['b','d','a','c']);assert.deepEqual(js('priceDesc'),['b','d','a','c']);
});
test('newest uses the publication date, then creation date',()=>{assert.deepEqual(sql('newest'),['d','b','c','a']);assert.deepEqual(js('newest'),['d','b','c','a']);});
test('area and recommended orders are unchanged',()=>{assert.deepEqual(sql('area'),['b','a','d','c']);assert.equal(sql('new')[0],'a');assert.equal(js('new')[0],'a');});
test('unknown sort values fall back to recommended and rates must cover every currency',()=>{assert.equal(listingSort("x'; DROP TABLE listings"),'new');assert.equal(listingSort(null),'new');assert.equal(strictSort('new'),false);assert.equal(strictSort('newest'),true);assert.equal(tryRates(null),null);assert.equal(tryRates({...ecb,gbpTry:undefined}),null);assert.match(listingOrderSql('priceAsc',rates),/WHEN 'EUR' THEN 50\.000000/);});
