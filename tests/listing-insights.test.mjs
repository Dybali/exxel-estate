import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url),cache=new Map();
function load(file){const full=path.resolve(root,file);if(cache.has(full))return cache.get(full);const m={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(name.startsWith('.')||name.startsWith('@/')){const p=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return p.endsWith('.json')?JSON.parse(readFileSync(p,'utf8')):load(p+'.ts');}return native(name);},m,m.exports);cache.set(full,m.exports);return m.exports;}
const {similarListings,similarListingsQuery,similarSearchHref,similarIn}=load('lib/similar-listings.ts');
const {priceHistory,recentPriceDrop,PRICE_DROP_SQL,PRICE_HISTORY_SQL}=load('lib/price-history.ts');
const {activePublicationQuery}=load('lib/listing-policy.ts');

const day=86400000,ago=n=>new Date(Date.now()-n*day).toISOString(),ahead=n=>new Date(Date.now()+n*day).toISOString();
// Same expiry rewrite as the production adapters (lib/d1-publication.ts, lib/pg-d1.ts).
function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT);CREATE TABLE listings(id TEXT PRIMARY KEY,owner_id TEXT,title TEXT,purpose TEXT,property_type TEXT,price INTEGER,currency TEXT,city TEXT,district TEXT,status TEXT,expires_at TEXT,published_at TEXT,created_at TEXT);CREATE INDEX listings_search_idx ON listings(status,purpose,property_type,city,price);CREATE TABLE price_history(id TEXT PRIMARY KEY,listing_id TEXT,old_price INTEGER,new_price INTEGER,currency TEXT,purpose TEXT,changed_at TEXT);CREATE INDEX price_history_listing_idx ON price_history(listing_id,changed_at);INSERT INTO users VALUES('owner','Owner');`);
 const add=(id,{purpose='satilik',type='daire',price=5000000,currency='TRY',city='İstanbul',district='Kadıköy',status='published',expires=null,published='2026-10-01T00:00:00.000Z'}={})=>sql.prepare('INSERT INTO listings VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'owner',id,purpose,type,price,currency,city,district,status,expires,published,published);
 const db={prepare(q){const query=activePublicationQuery(q);let v=[];return {bind(...a){v=a;return this},async all(){return {results:sql.prepare(query).all(...v)}}}}};
 return {sql,db,add};
}
const parse=row=>({id:String(row.id),title:row.title,purpose:row.purpose,propertyType:row.property_type,price:Number(row.price),currency:row.currency,city:row.city,district:row.district,publishedAt:row.published_at,createdAt:row.created_at,source:'user',images:[],amenities:[],grossArea:100,priceDrop:recentPriceDrop(row.price_drop,Number(row.price))});
const current={id:'current',purpose:'satilik',propertyType:'daire',price:5000000,currency:'TRY',city:'İstanbul',district:'Kadıköy',source:'user'};

test('similar listings: same district first, then same city, then elsewhere; closest price, then newest',async()=>{
 const {db,add}=fixture();
 add('current');
 add('city-close',{district:'Üsküdar',price:5050000});
 add('district-far',{price:6400000});
 add('district-close-old',{price:4900000,published:'2026-09-01T00:00:00.000Z'});
 add('district-close-new',{price:5100000,published:'2026-10-20T00:00:00.000Z'});
 add('elsewhere',{city:'İzmir',district:'Urla',price:5000000});
 add('eur-same-district',{currency:'EUR',price:120000});
 const result=await similarListings(db,current,{parse});
 assert.deepEqual(result.map(l=>l.id),['district-close-new','district-close-old','district-far','eur-same-district','city-close','elsewhere']);
});

test('similar listings: exclusion, purpose, type, price band, unpublished and expired',async()=>{
 const {db,add}=fixture();
 add('current');
 add('ok');
 add('rent',{purpose:'kiralik'});
 add('villa',{type:'villa'});
 add('too-cheap',{price:3400000});
 add('too-expensive',{price:6600000});
 add('edge-low',{price:3500000});
 add('edge-high',{price:6500000});
 add('pending',{status:'pending'});
 add('withdrawn',{status:'withdrawn'});
 add('expired',{expires:ago(1)});
 add('not-yet-expired',{expires:ahead(5)});
 const ids=(await similarListings(db,current,{parse})).map(l=>l.id).sort();
 assert.deepEqual(ids,['edge-high','edge-low','not-yet-expired','ok']);
 // Never more than the limit, even with many candidates.
 for(let i=0;i<10;i++)add(`more-${i}`);
 assert.equal((await similarListings(db,current,{parse})).length,6);
});

test('similar listings: demo content only on demo pages, after real listings, never with the current one',async()=>{
 const {db,add}=fixture();
 add('real-one');
 const demos=[
  {id:'sample-a',purpose:'satilik',propertyType:'daire',price:5200000,currency:'TRY',city:'İstanbul',district:'Kadıköy',source:'demo',images:[],amenities:[],grossArea:90},
  {id:'sample-b',purpose:'satilik',propertyType:'daire',price:4800000,currency:'TRY',city:'İstanbul',district:'Kadıköy',source:'demo',images:[],amenities:[],grossArea:90},
  {id:'sample-villa',purpose:'satilik',propertyType:'villa',price:5000000,currency:'TRY',city:'İstanbul',district:'Kadıköy',source:'demo',images:[],amenities:[],grossArea:90},
 ];
 // A real listing never shows demo content.
 assert.deepEqual((await similarListings(db,current,{parse,demos})).map(l=>l.id),['real-one']);
 // A demo listing: no "l.id<>?" (demo ids are not UUIDs), itself excluded, real listings first.
 const demoCurrent={...current,id:'sample-a',source:'demo'};
 const {sql}=similarListingsQuery(demoCurrent);assert.ok(!sql.includes('l.id<>?'));
 assert.deepEqual((await similarListings(db,demoCurrent,{parse,demos})).map(l=>l.id),['real-one','sample-b']);
 assert.deepEqual(similarIn(demoCurrent,demos).map(l=>l.id),['sample-b']);
});

test('similar listings: query stays parameterized and "Tümünü gör" uses /ilanlar filter names',()=>{
 const hostile={...current,city:"x' OR 1=1 --",district:"'; DROP TABLE listings; --"};
 const {sql,values}=similarListingsQuery(hostile);
 assert.ok(!sql.includes('DROP')&&!sql.includes('OR 1=1'));assert.ok(values.includes(hostile.city));
 const href=new URL(similarSearchHref(current),'https://site.test');
 assert.equal(href.pathname,'/ilanlar');
 assert.deepEqual(Object.fromEntries(href.searchParams),{purpose:'satilik',type:'daire',city:'İstanbul',currency:'TRY',minPrice:'3500000',maxPrice:'6500000'});
});

const row=(id,old_price,new_price,changed_at,currency='TRY',purpose='satilik')=>({id,old_price,new_price,currency,purpose,changed_at});
test('price history: newest first, drop percentage and step series ending at the current price',()=>{
 const rows=[row('b','5500000','5000000','2026-10-10T00:00:00.000Z'),row('a',6000000,5500000,'2026-09-10T00:00:00.000Z')];
 const history=priceHistory(rows,{price:5000000,currency:'TRY',purpose:'satilik',publishedAt:'2026-08-01T00:00:00.000Z'},'2026-11-01T00:00:00.000Z');
 assert.deepEqual(history.changes.map(c=>[c.at.slice(0,10),c.kind,c.oldPrice,c.newPrice]),[['2026-10-10','down',5500000,5000000],['2026-09-10','down',6000000,5500000]]);
 assert.ok(Math.abs(history.changes[0].change-(-500000/5500000))<1e-12);
 assert.deepEqual(history.drop,{oldPrice:5500000,newPrice:5000000,change:-500000/5500000,at:'2026-10-10T00:00:00.000Z'});
 assert.deepEqual(history.points,[{at:'2026-08-01T00:00:00.000Z',price:6000000},{at:'2026-09-10T00:00:00.000Z',price:5500000},{at:'2026-10-10T00:00:00.000Z',price:5000000},{at:'2026-11-01T00:00:00.000Z',price:5000000}]);
});

test('price history: an increase after a drop is not a drop; no rows means nothing to show',()=>{
 const history=priceHistory([row('a',100,90,'2026-10-01T00:00:00.000Z'),row('b',90,95,'2026-10-02T00:00:00.000Z')],{price:95,currency:'TRY',purpose:'satilik'},'2026-10-05T00:00:00.000Z');
 assert.equal(history.drop,null);assert.equal(history.changes[0].kind,'up');assert.ok(history.changes[0].change>0);
 assert.equal(priceHistory([],{price:1,currency:'TRY',purpose:'satilik'}),null);
 assert.equal(priceHistory([row('bad',0,0,'not a date')],{price:1,currency:'TRY',purpose:'satilik'}),null);
});

test('price history: no percentage across a currency or purpose change; chart only for the current currency',()=>{
 // Route writes old_price=new_price when currency or purpose changes (app/api/listings/[id]/route.ts).
 const rows=[row('a',5000000,4500000,'2026-09-01T00:00:00.000Z'),row('b',150000,150000,'2026-09-15T00:00:00.000Z','EUR'),row('c',150000,140000,'2026-10-01T00:00:00.000Z','EUR')];
 const history=priceHistory(rows,{price:140000,currency:'EUR',purpose:'satilik'},'2026-10-10T00:00:00.000Z');
 assert.deepEqual(history.changes.map(c=>[c.kind,c.currency,c.change===null]),[['down','EUR',false],['currency','EUR',true],['down','TRY',false]]);
 assert.deepEqual(history.points.map(p=>p.price),[150000,140000,140000]);
 assert.equal(history.drop.oldPrice,150000);
 // Currency changed last: no badge, no percentage, nothing to chart in the new currency yet.
 const switched=priceHistory(rows.slice(0,2),{price:150000,currency:'EUR',purpose:'satilik'},'2026-10-10T00:00:00.000Z');
 assert.equal(switched.drop,null);assert.deepEqual(switched.points,[]);
 // Purpose changed (same currency): previous segment is not used.
 const rent=priceHistory([row('a',5000000,4000000,'2026-09-01T00:00:00.000Z'),row('b',60000,60000,'2026-09-15T00:00:00.000Z','TRY','kiralik')],{price:60000,currency:'TRY',purpose:'kiralik'});
 assert.equal(rent.changes[0].kind,'purpose');assert.equal(rent.drop,null);assert.deepEqual(rent.points,[]);
 // Out-of-order rows are sorted by date.
 assert.deepEqual(priceHistory([...rows].reverse(),{price:140000,currency:'EUR',purpose:'satilik'}).changes.map(c=>c.at),[...rows].reverse().map(r=>r.changed_at));
});

test('card badge: one subquery per row reports only a recent drop to the current price',async()=>{
 const {sql,db,add}=fixture();
 add('recent',{price:900});add('old',{price:900});add('up',{price:1100});add('switched',{price:900,currency:'EUR'});add('none',{price:900});add('two',{price:800});
 const insert=sql.prepare('INSERT INTO price_history VALUES(?,?,?,?,?,?,?)');
 insert.run('h1','recent',1000,900,'TRY','satilik',ago(3));
 insert.run('h2','old',1000,900,'TRY','satilik',ago(45));
 insert.run('h3','up',1000,1100,'TRY','satilik',ago(2));
 insert.run('h4','switched',1000,900,'TRY','satilik',ago(5));insert.run('h5','switched',900,900,'EUR','satilik',ago(4));
 insert.run('h6','two',1000,900,'TRY','satilik',ago(10));insert.run('h7','two',900,800,'TRY','satilik',ago(1));
 const rows=(await db.prepare(`SELECT l.id,l.price,${PRICE_DROP_SQL} FROM listings l WHERE l.status='published' ORDER BY l.id`).bind().all()).results;
 const drops=Object.fromEntries(rows.map(r=>[r.id,recentPriceDrop(r.price_drop,Number(r.price))?.from??null]));
 assert.deepEqual(drops,{none:null,old:null,recent:1000,switched:null,two:900,up:null});
 assert.equal(recentPriceDrop('garbage',1),undefined);assert.equal(recentPriceDrop(`${ago(1)}|50`,100),undefined);
 // The page's own history query.
 const history=(await db.prepare(PRICE_HISTORY_SQL).bind('two').all()).results;
 assert.deepEqual(history.map(r=>r.id),['h7','h6']);
});
