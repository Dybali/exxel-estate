import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';import ts from 'typescript';
const compile=p=>'data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64');
const detailsURL='data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/listing-details.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}).replace("'./property-categories'",JSON.stringify(compile('property-categories')))).toString('base64');
const code=ts.transpile(readFileSync(new URL('../lib/search-categories.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}).replace("'./land'",JSON.stringify(compile('land'))).replace("'./property-subtypes'",JSON.stringify(compile('property-subtypes'))).replace("'./listings'",JSON.stringify('data:text/javascript,'+encodeURIComponent("export const AMENITIES=['Havuz','Asansör','Otopark'];"))).replace("'./listing-details'",JSON.stringify(detailsURL));
const {SEARCH_CATEGORIES,SIDEBARS,searchCategory,extraFilterSql,extraFilterMatches}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const {subtypeFrom}=await import(compile('property-subtypes'));
const {pgPresentationJson}=await import(compile('pg-json'));
const query=o=>new URLSearchParams(o);

test('every category tab asks only fields that fit it',()=>{
 assert.ok(!SEARCH_CATEGORIES.arsa.main.includes('rooms')&&!SEARCH_CATEGORIES.arsa.extra.includes('rooms'));
 assert.ok(SEARCH_CATEGORIES.arsa.main.includes('zoning'));
 assert.ok(SEARCH_CATEGORIES.bina.main.includes('minFloors'));
 assert.ok(SEARCH_CATEGORIES.isyeri.purposes.includes('devren'));
 assert.ok(SEARCH_CATEGORIES.isyeri.main.includes('businessType'));
 assert.ok(SEARCH_CATEGORIES.turistik.main.includes('tourismType'));
 assert.deepEqual([...SEARCH_CATEGORIES.devremulk.purposes],['satilik']);
});

test('land, subtype, age and floor filters run in SQLite and ignore invalid values',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE listings(id TEXT,building_age INTEGER,total_floors INTEGER,presentation TEXT)");
 const add=db.prepare('INSERT INTO listings VALUES(?,?,?,?)');
 add.run('a',null,null,JSON.stringify({land:{zoning:'Konut',deed:'Müstakil Tapulu',credit:'Evet'}}));
 add.run('b',null,null,JSON.stringify({land:{zoning:'Tarla'}}));
 add.run('c',3,8,JSON.stringify({businessType:'Ofis & Büro'}));add.run('d',25,3,JSON.stringify({tourismType:'Butik Otel'}));
 const ids=o=>{const f=extraFilterSql(query(o));return db.prepare(`SELECT id FROM listings l${f.where.length?' WHERE '+f.where.join(' AND '):''} ORDER BY id`).all(...f.values).map(r=>r.id);};
 assert.deepEqual(ids({zoning:'Konut'}),['a']);
 assert.deepEqual(ids({zoning:'Konut',deed:'Müstakil Tapulu',credit:'Evet'}),['a']);
 assert.deepEqual(ids({maxAge:'10'}),['c']);
 assert.deepEqual(ids({minFloors:'5'}),['c']);
 assert.deepEqual(ids({businessType:'Ofis & Büro'}),['c']);
 assert.deepEqual(ids({tourismType:'Butik Otel'}),['d']);
 assert.deepEqual(ids({zoning:"x' OR 1=1 --",maxAge:'abc',businessType:'Kumarhane'}),['a','b','c','d']);
});

test('demo listings are matched the same way',()=>{
 assert.equal(extraFilterMatches(query({zoning:'Konut'}),{presentation:{land:{zoning:'Konut'}}}),true);
 assert.equal(extraFilterMatches(query({zoning:'Konut'}),{}),false);
 assert.equal(extraFilterMatches(query({maxAge:'5'}),{buildingAge:4}),true);
 assert.equal(extraFilterMatches(query({minFloors:'5'}),{totalFloors:2}),false);
 assert.equal(extraFilterMatches(query({tourismType:'Otel'}),{presentation:{tourismType:'Otel'}}),true);
});

test('listing subtypes are validated against the category they belong to',()=>{
 assert.deepEqual(subtypeFrom({propertyType:'ticari',businessType:'Dükkan & Mağaza'}),{businessType:'Dükkan & Mağaza'});
 assert.deepEqual(subtypeFrom({propertyType:'turistik',tourismType:'Kamp Yeri (Mocamp)'}),{tourismType:'Kamp Yeri (Mocamp)'});
 assert.deepEqual(subtypeFrom({propertyType:'daire',businessType:'Dükkan & Mağaza'}),{});
 assert.deepEqual(subtypeFrom({propertyType:'ticari',businessType:''}),{});
 assert.throws(()=>subtypeFrom({propertyType:'turistik',tourismType:'Dükkan & Mağaza'}),/Tesis tipi/);
});

test('PostgreSQL gets jsonb lookups for presentation fields',()=>{
 assert.equal(pgPresentationJson(extraFilterSql(query({zoning:'Konut'})).where[0]),"(l.presentation::jsonb->'land'->>'zoning')=?");
 assert.equal(pgPresentationJson(extraFilterSql(query({businessType:'Otopark'})).where[0]),"(l.presentation::jsonb->>'businessType')=?");
 assert.match(readFileSync(new URL('../lib/pg-d1.ts',import.meta.url),'utf8'),/pgPresentationJson\(/);
});

test('side panel shows only blocks that fit the category',()=>{
 assert.equal(SIDEBARS.arsa.amenities.length,0);assert.equal(SIDEBARS.arsa.rooms,false);assert.equal(SIDEBARS.arsa.land,true);
 assert.ok(!SIDEBARS.arsa.amenities.includes('Şömine'));
 assert.equal(SIDEBARS.bina.building,true);assert.equal(SIDEBARS.turistik.heating,false);
 assert.equal(searchCategory('','arsa'),'arsa');assert.equal(searchCategory('','daire'),'konut');assert.equal(searchCategory('',''),'');
});

test('portal style filters: room and heating lists, ranges, owner, date and media',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE users(id TEXT,role TEXT);CREATE TABLE listings(id TEXT,owner_id TEXT,rooms TEXT,heating TEXT,net_area INTEGER,building_age INTEGER,floor INTEGER,total_floors INTEGER,published_at TEXT,created_at TEXT,latitude REAL,presentation TEXT)");
 db.exec("INSERT INTO users VALUES('agent1','agent'),('owner1','individual')");
 const add=db.prepare('INSERT INTO listings VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
 add.run('a','agent1','2+1','Kombi',90,2,3,5,'2026-10-29T10:00:00.000Z','2026-10-29T10:00:00.000Z',41,JSON.stringify({videoUrl:'https://youtu.be/x'}));
 add.run('b','owner1','3+1','Klima',140,20,1,2,'2026-09-01T10:00:00.000Z','2026-09-01T10:00:00.000Z',null,'{}');
 const now=Date.parse('2026-10-30T10:00:00.000Z');
 const ids=o=>{const f=extraFilterSql(query(o),now);return db.prepare(`SELECT id FROM listings l${f.where.length?' WHERE '+f.where.join(' AND '):''} ORDER BY id`).all(...f.values).map(r=>r.id);};
 assert.deepEqual(ids({rooms:'2+1,3+1'}),['a','b']);
 assert.deepEqual(ids({rooms:'3+1,9+9'}),['b']);
 assert.deepEqual(ids({heating:'Kombi (Doğalgaz)'}),['a']);
 assert.deepEqual(ids({minNetArea:'100'}),['b']);
 assert.deepEqual(ids({minAge:'5',maxAge:'30'}),['b']);
 assert.deepEqual(ids({minFloor:'2',maxFloors:'5'}),['a']);
 assert.deepEqual(ids({from:'agent'}),['a']);
 assert.deepEqual(ids({from:'owner'}),['b']);
 assert.deepEqual(ids({days:'7'}),['a']);
 assert.deepEqual(ids({days:'2'}),['a','b']);
 assert.deepEqual(ids({video:'1'}),['a']);
 assert.deepEqual(ids({mapped:'1'}),['a']);
 const listing={rooms:'2+1',heating:'Kombi',netArea:90,ownerRole:'agent',publishedAt:'2026-10-29T10:00:00.000Z',latitude:41,presentation:{videoUrl:'x'}};
 assert.equal(extraFilterMatches(query({rooms:'2+1',heating:'Kombi (Doğalgaz)',from:'agent',days:'3',video:'1',mapped:'1'}),listing,now),true);
 assert.equal(extraFilterMatches(query({from:'owner'}),listing,now),false);
 assert.equal(extraFilterMatches(query({maxNetArea:'50'}),listing,now),false);
});

test('portal details are validated per category, shown on the page and searchable',async()=>{
 const src=ts.transpile(readFileSync(new URL('../lib/listing-details.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}).replace("'./property-categories'",JSON.stringify(compile('property-categories')));
 const {detailsFrom,detailFacts,validRooms}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
 assert.deepEqual(detailsFrom({propertyType:'daire',detailKitchen:'Kapalı',detailSite:'Evet',detailDeed:'Kat Mülkiyetli'}),{kitchen:'Kapalı',site:'Evet',deed:'Kat Mülkiyetli'});
 assert.equal(detailsFrom({propertyType:'arsa',detailKitchen:'Kapalı'}),undefined);
 assert.deepEqual(detailsFrom({propertyType:'ticari',detailKitchen:'Kapalı',detailUsage:'Kiracılı'}),{usage:'Kiracılı'});
 assert.throws(()=>detailsFrom({propertyType:'villa',detailSwap:'Belki'}),/Takas/);
 assert.equal(detailFacts('daire',{site:'Evet'}).length,6);
 assert.deepEqual(detailFacts('turistik',{}).map(r=>r[0]),['Tapu Durumu','Takas']);
 for(const ok of ['','3+1','7+2','4.5+2','10 Üzeri',undefined])assert.equal(validRooms(ok),true,String(ok));
 for(const bad of ['abc','3+1; DROP','100+1'])assert.equal(validRooms(bad),false,bad);
 assert.equal(pgPresentationJson("json_extract(l.presentation,'$.details.site')=?"),"(l.presentation::jsonb->'details'->>'site')=?");
});

// "Fiyatı düşenler" (/fiyati-dusen-ilanlar → /ilanlar?priceDrop=1): the latest price change is a decrease in the last 30 days.
test('price drop filter: latest change down within 30 days, same currency and purpose',()=>{
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE listings(id TEXT,price INTEGER,currency TEXT,purpose TEXT);CREATE TABLE price_history(id TEXT,listing_id TEXT,old_price INTEGER,new_price INTEGER,currency TEXT,purpose TEXT,changed_at TEXT)");
 sql.exec("INSERT INTO listings VALUES('down',900,'TRY','satilik'),('old',900,'TRY','satilik'),('up',1100,'TRY','satilik'),('backup',1000,'TRY','satilik'),('none',500,'TRY','satilik')");
 sql.exec("INSERT INTO price_history VALUES('1','down',1000,900,'TRY','satilik','2026-11-10T00:00:00Z'),('2','old',1000,900,'TRY','satilik','2026-09-01T00:00:00Z'),('3','up',1000,1100,'TRY','satilik','2026-11-10T00:00:00Z'),('4','backup',1000,900,'TRY','satilik','2026-11-05T00:00:00Z'),('5','backup',900,1000,'TRY','satilik','2026-11-12T00:00:00Z')");
 const now=Date.parse('2026-11-17T00:00:00Z'),{where,values}=extraFilterSql(new URLSearchParams('priceDrop=1'),now);
 const ids=sql.prepare(`SELECT id FROM listings l WHERE ${where.join(' AND ')} ORDER BY id`).all(...values).map(r=>r.id);
 assert.deepEqual(ids,['down']);
 assert.equal(extraFilterMatches(new URLSearchParams('priceDrop=1'),{priceDrop:{from:1000,at:'2026-11-10T00:00:00Z'}},now),true);
 assert.equal(extraFilterMatches(new URLSearchParams('priceDrop=1'),{},now),false);
 sql.close();
});
