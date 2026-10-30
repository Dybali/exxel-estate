import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';import ts from 'typescript';
const compile=p=>'data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64');
const code=ts.transpile(readFileSync(new URL('../lib/search-categories.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}).replace("'./land'",JSON.stringify(compile('land')));
const {SEARCH_CATEGORIES,extraFilterSql,extraFilterMatches}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const query=o=>new URLSearchParams(o);

test('every category tab asks only fields that fit it',()=>{
 assert.ok(!SEARCH_CATEGORIES.arsa.main.includes('rooms')&&!SEARCH_CATEGORIES.arsa.extra.includes('rooms'));
 assert.ok(SEARCH_CATEGORIES.arsa.main.includes('zoning'));
 assert.ok(SEARCH_CATEGORIES.bina.main.includes('minFloors'));
 assert.ok(SEARCH_CATEGORIES.isyeri.purposes.includes('devren'));
 assert.deepEqual([...SEARCH_CATEGORIES.devremulk.purposes],['satilik']);
});

test('land, age and floor filters run in SQLite and ignore invalid values',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE listings(id TEXT,building_age INTEGER,total_floors INTEGER,presentation TEXT)");
 const add=db.prepare('INSERT INTO listings VALUES(?,?,?,?)');
 add.run('a',null,null,JSON.stringify({land:{zoning:'Konut',deed:'Müstakil Tapulu',credit:'Evet'}}));
 add.run('b',null,null,JSON.stringify({land:{zoning:'Tarla'}}));
 add.run('c',3,8,'{}');add.run('d',25,3,'{}');
 const ids=o=>{const f=extraFilterSql(query(o));return db.prepare(`SELECT id FROM listings l${f.where.length?' WHERE '+f.where.join(' AND '):''} ORDER BY id`).all(...f.values).map(r=>r.id);};
 assert.deepEqual(ids({zoning:'Konut'}),['a']);
 assert.deepEqual(ids({zoning:'Konut',deed:'Müstakil Tapulu',credit:'Evet'}),['a']);
 assert.deepEqual(ids({maxAge:'10'}),['c']);
 assert.deepEqual(ids({minFloors:'5'}),['c']);
 assert.deepEqual(ids({zoning:"x' OR 1=1 --",maxAge:'abc'}),['a','b','c','d']);
});

test('demo listings are matched the same way',()=>{
 assert.equal(extraFilterMatches(query({zoning:'Konut'}),{presentation:{land:{zoning:'Konut'}}}),true);
 assert.equal(extraFilterMatches(query({zoning:'Konut'}),{}),false);
 assert.equal(extraFilterMatches(query({maxAge:'5'}),{buildingAge:4}),true);
 assert.equal(extraFilterMatches(query({minFloors:'5'}),{totalFloors:2}),false);
});

test('PostgreSQL gets a jsonb lookup for land fields',()=>{
 const source=readFileSync(new URL('../lib/neon-d1.ts',import.meta.url),'utf8');
 const rule=source.match(/\.replace\((\/json_extract.*?\/g), "(.*?)"\)/);
 assert.ok(rule,'neon-d1 rewrites json_extract');
 const sql=extraFilterSql(query({zoning:'Konut'})).where[0].replace(eval(rule[1]),rule[2]);
 assert.equal(sql,"(l.presentation::jsonb->'land'->>'zoning')=?");
});
