import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url),cache=new Map();
function load(file){const full=path.resolve(root,file);if(cache.has(full))return cache.get(full);const m={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(name.startsWith('.')||name.startsWith('@/')){const p=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return p.endsWith('.json')?JSON.parse(readFileSync(p,'utf8')):load(p+'.ts');}return native(name);},m,m.exports);cache.set(full,m.exports);return m.exports;}
const {searchListings,ListingSearchError}=load('lib/listing-search.ts'),{featuredFirst}=load('lib/listings.ts');
const {activePublicationQuery}=load('lib/listing-policy.ts');

// Same expiry rewrite as the production adapters (lib/d1-publication.ts, lib/pg-d1.ts).
function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT);
 CREATE TABLE listings(id TEXT PRIMARY KEY,owner_id TEXT,title TEXT,description TEXT,purpose TEXT,property_type TEXT,price INTEGER,currency TEXT,city TEXT,district TEXT,neighborhood TEXT,gross_area INTEGER,bedrooms INTEGER,bathrooms INTEGER,furnished INTEGER DEFAULT 0,amenities TEXT DEFAULT '[]',latitude REAL,longitude REAL,status TEXT,featured INTEGER DEFAULT 0,expires_at TEXT,published_at TEXT,created_at TEXT);
 CREATE TABLE price_history(id TEXT PRIMARY KEY,listing_id TEXT,old_price INTEGER,new_price INTEGER,currency TEXT,purpose TEXT,changed_at TEXT);
 INSERT INTO users VALUES('owner','Owner');`);
 let n=0;
 const add=(id,{city='İstanbul',price=5000000,currency='TRY',status='published',expires=null,featured=0,area=100}={})=>{n++;sql.prepare('INSERT INTO listings(id,owner_id,title,description,purpose,property_type,price,currency,city,district,gross_area,status,featured,expires_at,published_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'owner',id,'',"satilik",'daire',price,currency,city,'Merkez',area,status,featured,expires,`2026-10-${String(n).padStart(2,'0')}T00:00:00.000Z`,`2026-10-${String(n).padStart(2,'0')}T00:00:00.000Z`);};
 const queries=[];
 const db={prepare(q){const query=activePublicationQuery(q);queries.push(query);let v=[];return {bind(...a){v=a;return this},async first(){return sql.prepare(query).get(...v)||null},async all(){return {results:sql.prepare(query).all(...v)}}}}};
 return {db,add,queries};
}
const parse=row=>({id:String(row.id),title:row.title,description:'',purpose:row.purpose,propertyType:row.property_type,price:Number(row.price),currency:row.currency,city:row.city,district:row.district,grossArea:Number(row.gross_area),featured:Boolean(row.featured),createdAt:row.created_at,publishedAt:row.published_at,source:'user',images:['/api/media/x.jpg'],amenities:[],ownerName:row.owner_name});
const sample=(id,city,price)=>({id,title:id,description:'',purpose:'satilik',propertyType:'daire',price,currency:'TRY',city,district:'Merkez',grossArea:90,source:'demo',sample:true,images:[],amenities:[],locationPrecision:'province'});
const samples=[sample('demo-ist','İstanbul',3000000),sample('demo-izm','İzmir',7000000),sample('demo-ant','Antalya',9000000)];
const run=(db,query,rates=async()=>null,list=samples)=>searchListings(new URLSearchParams(query),{db,parse,ownerColumns:'0 AS owner_verified',loadRates:rates,samples:list});

test('listing search: real listings first, samples fill the page and are counted apart',async()=>{
 const {db,add}=fixture();
 add('real-1');add('real-2',{city:'İzmir'});add('draft',{status:'pending'});add('expired',{expires:'2020-01-01T00:00:00.000Z'});
 const all=await run(db,'page=1');
 assert.deepEqual(all.listings.map(l=>l.id),['real-2','real-1','demo-ist','demo-izm','demo-ant']);
 assert.equal(all.total,5);assert.equal(all.realTotal,2);assert.equal(all.sampleTotal,3);assert.equal(all.pageSize,12);assert.equal(all.page,1);
 assert.ok(all.listings.filter(l=>l.source==='demo').every(l=>l.sample),'samples keep their label');
 const city=await run(db,'city=İzmir');
 assert.deepEqual(city.listings.map(l=>l.id),['real-2','demo-izm']);assert.equal(city.realTotal,1);assert.equal(city.sampleTotal,1);
});

test('listing search: pages continue after the real listings, without repeats',async()=>{
 const {db,add}=fixture();
 for(let i=1;i<=14;i++)add('real-'+String(i).padStart(2,'0'));
 const first=await run(db,'page=1'),second=await run(db,'page=2');
 assert.equal(first.listings.length,12);assert.ok(first.listings.every(l=>l.source==='user'));
 assert.deepEqual(second.listings.map(l=>l.id),['real-02','real-01','demo-ist','demo-izm','demo-ant']);
 assert.equal(second.total,17);assert.equal(second.realTotal,14);
});

test('listing search: price sort merges samples by TL price; rates load only when needed',async()=>{
 const {db,add}=fixture();
 add('real-cheap',{price:2000000});add('real-eur',{price:100000,currency:'EUR'});
 let loads=0;const rates=async()=>{loads++;return {date:'2026-11-13',rates:{EUR:50,USD:40,GBP:60},stale:false};};
 await run(db,'page=1',rates);assert.equal(loads,0,'default sort needs no bulletin');
 const sorted=await run(db,'sort=priceAsc',rates);assert.equal(loads,1);
 assert.deepEqual(sorted.listings.map(l=>l.id),['real-cheap','demo-ist','real-eur','demo-izm','demo-ant']);
 const range=await run(db,'minPrice=4000000&maxPrice=8000000',rates);
 assert.deepEqual(range.listings.map(l=>l.id),['real-eur','demo-izm']);
});

test('listing search: a bad currency or a missing bulletin is a typed error',async()=>{
 const {db}=fixture();
 await assert.rejects(run(db,'currency=euro&minPrice=1'),e=>e instanceof ListingSearchError&&e.status===400);
 await assert.rejects(run(db,'currency=EUR&minPrice=1'),e=>e instanceof ListingSearchError&&e.status===503);
});

test('home page picks featured listings with photos first',()=>{
 const l=(id,featured,images=['x'])=>({id,featured,images});
 assert.deepEqual(featuredFirst([l('a',false),l('b',true),l('c',true,[]),l('d',true),l('e',false)],4).map(x=>x.id),['b','d','a','c']);
});
