// Office page: consultants with titles, "Danışmanın ilanları", languages (lib/company-office.ts).
import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import ts from 'typescript';
const office=await import('data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/company-office.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));
const wrap=sql=>({prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}});
function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,avatar_url TEXT);CREATE TABLE agencies(id TEXT PRIMARY KEY,owner_id TEXT,name TEXT,status TEXT);
  CREATE TABLE company_team_memberships(id TEXT,agency_id TEXT,user_id TEXT,ended_at TEXT);CREATE TABLE listings(id TEXT,owner_id TEXT,agency_id TEXT,status TEXT);
  CREATE TABLE agent_languages(user_id TEXT PRIMARY KEY,languages TEXT,updated_at TEXT);${office.TEAM_TITLE_SCHEMA};
  INSERT INTO users VALUES('own','Selin Sahip','/api/media/listings/own/a.webp'),('c1','Ali Sarı',NULL),('c2','Bektaş Aras',NULL),('old','Eski Üye',NULL);
  INSERT INTO agencies VALUES('ag','own','Şahmeran Emlak','approved');
  INSERT INTO company_team_memberships VALUES('m1','ag','c1',NULL),('m2','ag','c2',NULL),('m3','ag','old','2026-10-01');
  INSERT INTO listings VALUES('o1','own',NULL,'published'),('o2','own','ag','published'),('a1','c1','ag','published'),('b1','c2','ag','published'),('b2','c2','ag','published'),('b3','c2',NULL,'published'),('x','c2','ag','draft');
  INSERT INTO agent_languages VALUES('own','["de","tr"]','t'),('c2','["en","de"]','t');`);
 return {sql,db:wrap(sql)};
}
test('team: owner first, active consultants with listing counts, titles and languages',async()=>{const f=fixture();try{
 const team=await office.officeTeam(f.db,{id:'ag',owner_id:'own'});
 assert.deepEqual(team.map(m=>[m.name,m.title,m.listing_count,m.owner]),[['Selin Sahip','owner',2,true],['Ali Sarı','consultant',1,false],['Bektaş Aras','consultant',2,false]]);
 assert.deepEqual(office.officeLanguages(team),['tr','de','en']);
 await office.setTeamTitle(f.db,'own','c2','senior');
 assert.equal((await office.officeTeam(f.db,{id:'ag',owner_id:'own'}))[2].title,'senior');
 await assert.rejects(()=>office.setTeamTitle(f.db,'own','old','manager'),/bulunamadı/);
 await assert.rejects(()=>office.setTeamTitle(f.db,'c1','c2','manager'),/yetkisi/);
 await assert.rejects(()=>office.setTeamTitle(f.db,'own','c2','king'),/Geçersiz/);
}finally{f.sql.close()}});
test('Danışmanın ilanları: one consultant\'s office listings; unknown ids show the whole office',async()=>{const f=fixture();try{
 const team=await office.officeTeam(f.db,{id:'ag',owner_id:'own'}),o={id:'ag',owner_id:'own'};
 const ids=filter=>f.sql.prepare(`SELECT id FROM listings l WHERE ${filter.where} AND l.status='published' ORDER BY id`).all(...filter.values).map(r=>r.id);
 assert.deepEqual(ids(office.consultantFilter(o,team,null)),['a1','b1','b2','o1','o2']);
 assert.deepEqual(ids(office.consultantFilter(o,team,'c2')),['b1','b2']);
 assert.deepEqual(ids(office.consultantFilter(o,team,'own')),['o1','o2']);
 assert.equal(office.consultantFilter(o,team,'old').member,null);
}finally{f.sql.close()}});
