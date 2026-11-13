import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';import ts from 'typescript';
const compile=source=>ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(compile(readFileSync(new URL('../'+file,import.meta.url),'utf8'))).toString('base64'));
const cookies=await load('lib/cookie-consent.ts'),membership=await load('lib/company-membership.ts'),categories=await load('lib/property-categories.ts');
async function route(file,deps){const key=crypto.randomUUID();globalThis[key]=deps;const source=readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/^import [^\n]*\n/gm,'');const prefix=`const {${Object.keys(deps).join(',')}}=globalThis[${JSON.stringify(key)}];\n`;return import('data:text/javascript;base64,'+Buffer.from(compile(prefix+source)).toString('base64'));}
const now=Date.now(),consent={version:1,analytics:true,externalMedia:false,updatedAt:now};
test('consent is explicit, bounded and versioned; malformed, expired and future choices default off',()=>{
 assert.equal(cookies.parseConsent(''),null);assert.deepEqual(cookies.parseConsent(cookies.consentCookie(consent),now),consent);
 for(const value of ['%bad',JSON.stringify({...consent,version:2}),JSON.stringify({...consent,analytics:'yes'}),JSON.stringify({...consent,updatedAt:now-181*864e5}),JSON.stringify({...consent,updatedAt:now+120000})])assert.equal(cookies.parseConsent('em24_consent='+encodeURIComponent(value),now),null);
});
test('consent endpoint validates origin and booleans, and revocation clears the HttpOnly viewer cookie',async()=>{
 const api=await route('app/api/privacy/consent/route.ts',{body:r=>r.json(),error:(m,s=400)=>Response.json({error:m},{status:s}),ok:(d,i)=>Response.json(d,i),sameOrigin:r=>r.headers.get('origin')==='https://site.test',...cookies});
 const req=(value,origin='https://site.test')=>new Request('https://site.test/api/privacy/consent',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(value)});
 assert.equal((await api.POST(req({analytics:true,externalMedia:true},'https://evil.test'))).status,403);
 assert.equal((await api.POST(req({analytics:'true',externalMedia:false}))).status,400);
 const denied=await api.POST(req({analytics:false,externalMedia:false}));assert.equal(denied.status,200);assert.match(denied.headers.get('set-cookie'),/em24_viewer=;.*Max-Age=0/);assert.equal((await denied.json()).consent.analytics,false);
 const accepted=await api.POST(req({analytics:true,externalMedia:true}));assert.match(accepted.headers.get('set-cookie'),/em24_consent=/);assert.doesNotMatch(accepted.headers.get('set-cookie'),/em24_viewer/);
});
test('view endpoint refuses measurement before touching authentication or the database without consent',async()=>{
 const fail=()=>{throw Error('Analytics storage must not run');};
 const api=await route('app/api/listings/[id]/view/route.ts',{parseConsent:cookies.parseConsent,clearViewerCookie:cookies.clearViewerCookie,sameOrigin:()=>true,clientIp:()=>'local',ok:(d,i)=>Response.json(d,i),error:(m,s=400)=>Response.json({error:m},{status:s}),db:fail,currentUser:fail,consumeRecoveryLimit:fail,statisticsDB:fail,recordListingView:fail,sha256:fail});
 const response=await api.POST(new Request('https://site.test/api/listings/id/view',{method:'POST'}),{params:Promise.resolve({id:crypto.randomUUID()})});assert.equal(response.status,200);assert.deepEqual(await response.json(),{recorded:false});
});
test('business transfer uses purpose, never the timeshare property type, for all property categories',()=>{
 assert.deepEqual(categories.categoryFilter('devren'),{where:'l.purpose=?',values:['devren']});
 assert.equal(categories.categoryMatches('devren',{purpose:'devren',propertyType:'ticari'}),true);
 assert.equal(categories.categoryMatches('devren',{purpose:'satilik',propertyType:'devremulk'}),false);
 assert.equal(categories.categoryMatches('konut',{purpose:'satilik',propertyType:'arsa'}),false);
 assert.equal(categories.categoryMatches('invalid',{purpose:'satilik',propertyType:'daire'}),false);
});
test('company type is an allowlist; website rejects executable URLs and embedded credentials',()=>{
 assert.equal(membership.companyCategory('developer'),'developer');assert.equal(membership.companyCategory('agency'),'agency');assert.throws(()=>membership.companyCategory('admin'));
 for(const value of ['javascript:alert(1)','http://example.com','https://user:password@example.com',{}])assert.throws(()=>membership.companyWebsite(value));
 assert.equal(membership.companyWebsite('https://example.com'),'https://example.com/');assert.equal(membership.companyWebsite(''),'');
});
test('company profile persists privately, isolates owners, rejects stale updates and never self-approves',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE agencies(id TEXT PRIMARY KEY,owner_id TEXT,name TEXT,category TEXT,status TEXT);INSERT INTO agencies VALUES('one','u1','Company One','developer','pending'),('two','u2','Company Two','developer','pending');`);sql.exec(membership.COMPANY_PROFILE_SCHEMA);
 const db={prepare(query){let values=[];return {bind(...v){values=v;return this;},async first(){return sql.prepare(query).get(...values)||null;},async run(){return sql.prepare(query).run(...values);}};}};
 let user={id:'u1',role:'agent',email_verified:1};
 const api=await route('app/api/company-account/route.ts',{body:r=>r.json(),currentUser:async()=>user,error:(m,s=400)=>Response.json({error:m},{status:s}),now:()=>new Date().toISOString(),ok:(d,i)=>Response.json(d,i),sameOrigin:r=>r.headers.get('origin')==='https://site.test',str:(v,n)=>typeof v==='string'?v.trim().slice(0,n):'',companyProfileDB:async()=>db,companyWebsite:membership.companyWebsite,CITIES:['Antalya']});
 const input={city:'Antalya',website:'https://example.com',address:'Office',description:'Developer portfolio',version:0};
 const post=()=>api.POST(new Request('https://site.test/api/company-account',{method:'POST',headers:{origin:'https://site.test','Content-Type':'application/json'},body:JSON.stringify(input)}));
 try{assert.equal((await post()).status,200);assert.equal((await post()).status,409);assert.equal(sql.prepare('SELECT status FROM agencies WHERE owner_id=?').get('u1').status,'pending');
 const get=()=>api.GET(new Request('https://site.test/api/company-account'));
 assert.equal((await (await get()).json()).profile.description,'Developer portfolio');user={id:'u2',role:'agent',email_verified:1};assert.equal((await (await get()).json()).profile,null);
 user={id:'u1',role:'agent',email_verified:0};input.version=1;assert.equal((await post()).status,200);assert.equal(sql.prepare('SELECT status FROM agencies WHERE owner_id=?').get('u1').status,'pending');user={id:'u1',role:'buyer',email_verified:1};assert.equal((await post()).status,403);user=null;assert.equal((await get()).status,401);
 }finally{sql.close();}
});
test('construction registration persists the developer category with pending approval and rejects injected account types',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE,password_hash TEXT,email_verified INTEGER,name TEXT,role TEXT,agent_status TEXT,company TEXT,created_at TEXT);CREATE TABLE agencies(id TEXT PRIMARY KEY,owner_id TEXT UNIQUE,name TEXT,category TEXT,status TEXT,created_at TEXT);`);
 const database={prepare(query){let values=[];return {bind(...v){values=v;return this;},async first(){return sql.prepare(query).get(...values)||null;},async run(){return sql.prepare(query).run(...values);}};},async batch(statements){sql.exec('BEGIN');try{for(const statement of statements)await statement.run();sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const api=await route('app/api/account/route.ts',{body:r=>r.json(),isFirmKind:v=>v==='contractor'||v==='service',setAccountKind:async()=>{},accountKind:async()=>'individual',AccountKindError:class extends Error{},sameOrigin:()=>true,clientIp:()=>'local',str:(v,n)=>typeof v==='string'?v.trim().slice(0,n):'',error:(m,s=400)=>Response.json({error:m},{status:s}),ok:(d,i)=>Response.json(d,i),db:()=>database,sha256:async value=>'hash:'+value,consumeRecoveryLimit:async()=>{},RecoveryError:class extends Error{},companyCategory:membership.companyCategory,now:()=>new Date().toISOString(),passwordHash:async()=> 'hashed-only',createSession:async()=> 'session-token',sessionCookie:token=>'excell_session='+token});
 const payload={action:'register',email:'developer@example.test',password:'secure-Password-123',name:'Company Contact',role:'agent',companyCategory:'developer',company:'Construction Co'};
 const register=data=>api.POST(new Request('https://site.test/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}));
 try{const result=await register(payload);assert.equal(result.status,201);const body=await result.json();assert.equal(body.user.role,'agent');assert.equal(body.user.agent_status,'pending');assert.equal(body.user.password_hash,undefined);
 const saved=sql.prepare('SELECT * FROM agencies').get();assert.equal(saved.category,'developer');assert.equal(saved.status,'pending');assert.equal(sql.prepare('SELECT email_verified FROM users').get().email_verified,0);
 assert.equal((await register({...payload,email:'admin@example.test',role:'admin'})).status,400);assert.equal((await register({...payload,email:'invalid@example.test',companyCategory:'admin'})).status,400);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM users').get().n,1);
 }finally{sql.close();}
});
