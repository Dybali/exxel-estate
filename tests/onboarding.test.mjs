// Start checklist in Hesabım (lib/onboarding.ts, 2026-11-23).
import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import ts from 'typescript';
const O=await import('data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/onboarding.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));
const wrap=sql=>({prepare(q){let v=[];return {bind(...a){v=a;return this},async first(){return sql.prepare(q).get(...v)||null}}}});
const none={avatar:false,phone:false,listings:0,officeDocument:false,languages:false,favorites:0,savedSearches:0,homeRequests:0,firm:false,firmAreas:0,firmDocuments:0,firmProjects:0,firmPlan:false};

test('each account type has its own steps with links; done follows the facts',()=>{
 assert.deepEqual(O.onboardingSteps('agent',none).map(s=>s.id),['photo','licence','listing','languages','board']);
 assert.deepEqual(O.onboardingSteps('individual',none).map(s=>s.id),['phone','favorite','search','request']);
 assert.deepEqual(O.onboardingSteps('service',none).map(s=>s.id),['firm','areas','documents','plan']);
 assert.deepEqual(O.onboardingSteps('contractor',none).map(s=>s.id),['firm','areas','projects','plan']);
 const agent=O.onboardingSteps('agent',{...none,avatar:true,listings:2,officeDocument:true},{leadBoard:true});
 assert.deepEqual(agent.filter(s=>s.done).map(s=>s.id),['photo','licence','listing','board']);
 for(const kind of ['agent','individual','service','contractor'])for(const step of O.onboardingSteps(kind,none)){assert.ok(step.href.startsWith('/'));assert.ok(step.title&&step.text);}
});

test('facts: counts per account; tables that do not exist yet read as zero',async()=>{
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE listings(id TEXT,owner_id TEXT);CREATE TABLE favorites(user_id TEXT,listing_id TEXT);CREATE TABLE office_verifications(user_id TEXT,state TEXT);CREATE TABLE firm_plans(user_id TEXT,plan TEXT,ends_at TEXT)");
 sql.exec("INSERT INTO listings VALUES('l1','u1'),('l2','u2');INSERT INTO favorites VALUES('u1','l2');INSERT INTO office_verifications VALUES('u1','rejected');INSERT INTO firm_plans VALUES('u1','service-plus','2027-01-01T00:00:00Z')");
 const facts=await O.onboardingFacts(wrap(sql),{id:'u1',avatar_url:'/a.jpg',phone:null},new Date('2026-11-23T00:00:00Z'));
 assert.deepEqual([facts.avatar,facts.phone,facts.listings,facts.favorites,facts.officeDocument,facts.firmPlan,facts.savedSearches,facts.firm],[true,false,1,1,false,true,0,false]);
});
