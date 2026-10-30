import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';import ts from 'typescript';
const compile=p=>'data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64');
const code=ts.transpile(readFileSync(new URL('../lib/search-categories.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}).replace("'./land'",JSON.stringify(compile('land'))).replace("'./property-subtypes'",JSON.stringify(compile('property-subtypes')));
const {SEARCH_CATEGORIES,extraFilterSql,extraFilterMatches}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
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
 assert.match(readFileSync(new URL('../lib/neon-d1.ts',import.meta.url),'utf8'),/pgPresentationJson\(/);
});
