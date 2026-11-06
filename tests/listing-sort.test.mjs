import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {importTs} from './ts-module.mjs';
const {listingSort,listingOrderSql,compareListings,tlRates,tlPriceSql,strictSort}=await importTs('lib/listing-sort.ts');
// TL per unit as in a TCMB bulletin snapshot (lib/tcmb.ts).
const snapshot={source:'TCMB',date:'2026-11-05',rates:{EUR:50,USD:40,GBP:60,JPY:0.3},stale:false},rates=tlRates(snapshot);
const rows=[
 {id:'a',price:4000000,currency:'TRY',grossArea:120,featured:1,created_at:'2026-10-01',published_at:'2026-10-02'},
 {id:'b',price:100000,currency:'EUR',grossArea:200,featured:0,created_at:'2026-10-20',published_at:'2026-10-21'},
 {id:'c',price:90000,currency:'USD',grossArea:80,featured:0,created_at:'2026-10-10',published_at:null},
 {id:'d',price:70000,currency:'GBP',grossArea:95,featured:0,created_at:'2026-10-25',published_at:'2026-10-28'},
];
function sql(sort,table=rates){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE listings(id text,price integer,currency text,gross_area integer,featured integer,created_at text,published_at text)');for(const r of rows)db.prepare('INSERT INTO listings VALUES(?,?,?,?,?,?,?)').run(r.id,r.price,r.currency,r.grossArea,r.featured,r.created_at,r.published_at);return db.prepare(`SELECT id FROM listings l ORDER BY ${listingOrderSql(sort,table)}`).all().map(r=>r.id);}
const js=(sort,table=rates)=>rows.map(r=>({...r,createdAt:r.created_at,publishedAt:r.published_at||undefined,featured:Boolean(r.featured)})).sort(compareListings(sort,table)).map(r=>r.id);
test('price sorting uses the TL base: TRY as stored, legacy EUR/USD/GBP rows converted with the bulletin',()=>{
 // TL values: a 4.0M, b 5.0M, c 3.6M, d 4.2M
 assert.deepEqual(sql('priceAsc'),['c','a','d','b']);assert.deepEqual(js('priceAsc'),['c','a','d','b']);
 assert.deepEqual(sql('priceDesc'),['b','d','a','c']);assert.deepEqual(js('priceDesc'),['b','d','a','c']);
});
test('a legacy currency without a rate goes last in both directions (SQLite and in memory alike)',()=>{
 const partial=tlRates({...snapshot,rates:{EUR:50}});
 assert.deepEqual(partial,{TRY:1,EUR:50});
 assert.deepEqual(sql('priceAsc',partial),['a','b','c','d']);assert.deepEqual(js('priceAsc',partial),['a','b','c','d']);
 assert.deepEqual(sql('priceDesc',partial),['b','a','c','d']);assert.deepEqual(js('priceDesc',partial),['b','a','c','d']);
 // No bulletin at all: TRY listings sorted, legacy ones after them.
 assert.deepEqual(tlRates(null),{TRY:1});assert.deepEqual(sql('priceAsc',tlRates(null))[0],'a');
});
test('newest uses the publication date, then creation date',()=>{assert.deepEqual(sql('newest'),['d','b','c','a']);assert.deepEqual(js('newest'),['d','b','c','a']);});
test('area and recommended orders are unchanged',()=>{assert.deepEqual(sql('area'),['b','a','d','c']);assert.equal(sql('new')[0],'a');assert.equal(js('new')[0],'a');});
test('unknown sort values fall back to recommended; only bulletin numbers and legacy codes reach the SQL',()=>{
 assert.equal(listingSort("x'; DROP TABLE listings"),'new');assert.equal(listingSort(null),'new');assert.equal(strictSort('new'),false);assert.equal(strictSort('newest'),true);
 assert.match(listingOrderSql('priceAsc',rates),/WHEN 'EUR' THEN 50\.000000/);
 assert.doesNotMatch(tlPriceSql(rates),/JPY/,'only TRY and legacy listing currencies');
 assert.equal(tlPriceSql({TRY:1,"X' OR 1=1":5,EUR:NaN,USD:-1}),'(l.price*CASE l.currency WHEN \'TRY\' THEN 1 ELSE NULL END)');
});
