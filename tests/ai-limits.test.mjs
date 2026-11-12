import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {DatabaseSync} from 'node:sqlite';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url),cache=new Map();
function load(file){const full=path.resolve(root,file);if(cache.has(full))return cache.get(full);const m={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(name.startsWith('.')||name.startsWith('@/')){const p=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return p.endsWith('.json')?JSON.parse(readFileSync(p,'utf8')):load(p+'.ts');}return native(name);},m,m.exports);cache.set(full,m.exports);return m.exports;}
const L=load('lib/ai-limits.ts');

// Yönetim › Yapay zekâ kotaları (lib/ai-limits.ts).
function database(agents=0){const sql=new DatabaseSync(':memory:');sql.exec("CREATE TABLE users(id TEXT,role TEXT,agent_status TEXT)");for(let i=0;i<agents;i++)sql.prepare("INSERT INTO users VALUES(?,?,?)").run('a'+i,'agent','approved');sql.prepare("INSERT INTO users VALUES('x','agent','pending')").run();sql.prepare("INSERT INTO users VALUES('y','individual','')").run();
 return {sql,prepare(query){return {values:[],bind(...values){this.values=values;return this;},async first(){return sql.prepare(query).get(...this.values)||null;},async all(){return {results:sql.prepare(query).all(...this.values)};},async run(){return sql.prepare(query).run(...this.values);}};}};}
const byId=(rows,id)=>rows.find(r=>r.id===id);

test('a cap comes from the panel, else the environment, else the default, and grows per approved agent',async()=>{
 const db=database(3);
 let {agents,limits}=await L.aiLimits(db,{TRANSLATION_DAILY_CHAR_LIMIT:'500000'});
 assert.equal(agents,3,'only approved agents count');
 assert.deepEqual([byId(limits,'TRANSLATION_DAILY_CHAR_LIMIT').effective,byId(limits,'TRANSLATION_DAILY_CHAR_LIMIT').source],[500000,'env']);
 assert.deepEqual([byId(limits,'AI_DAILY_CALL_LIMIT').effective,byId(limits,'AI_DAILY_CALL_LIMIT').source],[400,'default']);
 await L.saveAiLimit(db,'admin',{id:'AI_DAILY_CALL_LIMIT',base:'1000',perAgent:'50'});
 await L.saveAiLimit(db,'admin',{id:'TRANSLATION_DAILY_CHAR_LIMIT',base:null,perAgent:100000});
 ({limits}=await L.aiLimits(db,{TRANSLATION_DAILY_CHAR_LIMIT:'500000'}));
 assert.deepEqual([byId(limits,'AI_DAILY_CALL_LIMIT').effective,byId(limits,'AI_DAILY_CALL_LIMIT').source],[1150,'panel']);
 assert.deepEqual([byId(limits,'TRANSLATION_DAILY_CHAR_LIMIT').effective,byId(limits,'TRANSLATION_DAILY_CHAR_LIMIT').source],[800000,'env'],'growth on top of the environment value');
 assert.equal(L.limitOverrides(limits).AI_DAILY_CALL_LIMIT,'1150');
 for(const bad of [{id:'NOPE'},{id:'AI_DAILY_CALL_LIMIT',base:'-1'},{id:'AI_DAILY_CALL_LIMIT',base:'1.5'},{id:'AI_DAILY_CALL_LIMIT',perAgent:'x'},{id:'AI_DAILY_CALL_LIMIT',base:'999999999999'}])
  await assert.rejects(L.saveAiLimit(db,'admin',bad),L.AiLimitError,JSON.stringify(bad));
 await L.saveAiLimit(db,'admin',{id:'AI_DAILY_CALL_LIMIT',base:null,perAgent:0});
 assert.equal(byId((await L.aiLimits(db,{})).limits,'AI_DAILY_CALL_LIMIT').source,'default','back to default');
});

test('usage, daily history, cost estimate and one warning per limit, period and level',async()=>{
 const db=database(),at=new Date('2026-11-12T10:00:00Z');
 await L.ensureAiLimits(db);
 db.sql.prepare("INSERT INTO ai_usage_limits(key,requests,input_tokens,output_tokens,expires_at) VALUES(?,?,?,?,?)").run('assistant:global:2026-11-12',340,100000,20000,'2026-11-15');
 db.sql.prepare("INSERT INTO translation_usage(key,characters) VALUES(?,?),(?,?)").run('day:2026-11-12',1000000,'month:2026-11',5000000);
 const usage=await L.snapshotAiUsage(db,at);
 assert.equal(usage.used.AI_DAILY_CALL_LIMIT,340);assert.equal(usage.used.TRANSLATION_DAILY_CHAR_LIMIT,1000000);
 const history=await L.aiHistory(db,30,at);assert.equal(history.length,30);assert.equal(history.at(-1).day,'2026-11-12');assert.equal(history.at(-1).assistantCalls,340);
 const expected=(100000*0.30+20000*2.50)/1e6+1000000*377/2.1e9;
 assert.ok(Math.abs(history.at(-1).cost-expected)<0.00002,String(history.at(-1).cost));assert.ok(Math.abs(L.aiCost(usage).day-expected)<1e-9);
 const {limits}=await L.aiLimits(db,{});
 let due=await L.dueAiAlerts(db,limits,usage,at);
 assert.deepEqual(due.map(d=>[d.id,d.level,d.percent]),[['AI_DAILY_CALL_LIMIT',80,85]],'340/400 = 85 % → one 80 % warning; translation 50 % → none');
 assert.deepEqual(await L.dueAiAlerts(db,limits,usage,at),[],'not repeated in the same day');
 db.sql.prepare("UPDATE ai_usage_limits SET requests=400").run();
 due=await L.dueAiAlerts(db,limits,await L.aiUsageNow(db,at),at);assert.deepEqual(due.map(d=>d.level),[100]);
 assert.equal(L.capCost({unit:'chars',effective:30000000}).toFixed(2),'5.39');
});
