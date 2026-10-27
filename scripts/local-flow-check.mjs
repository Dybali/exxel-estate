// Runs only against the disposable loopback audit Worker. It never sends mail.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {DatabaseSync} from 'node:sqlite';
const root=fileURLToPath(new URL('../',import.meta.url)),origin='http://127.0.0.1:8787';
const state=path.resolve(root,'.wrangler/audit-20261028/v3/d1');
const files=readdirSync(state,{recursive:true}).filter(f=>String(f).endsWith('.sqlite')&&path.basename(String(f))!=='metadata.sqlite');
assert.equal(files.length,1,'Start the isolated audit Worker and apply local migrations first.');
const local=new DatabaseSync(path.join(state,files[0]));local.exec('PRAGMA busy_timeout=5000;DELETE FROM auth_limits;');
let closed=false;const report=[];const stamp=Date.now().toString(36),password='Local-Audit-2026!';
async function request(method,url,{actor,json,headers={},body}={}){const r=await fetch(origin+url,{method,redirect:'manual',headers:{...(method!=='GET'?{Origin:origin}:{}),...(actor?{Cookie:actor.cookie}:{}),...(json?{'Content-Type':'application/json'}:{}),...headers},body:json?JSON.stringify(json):body,signal:AbortSignal.timeout(15000)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{}return {status:r.status,data,text,headers:r.headers};}
function check(name,result,status){assert.equal(result.status,status,name+': '+(result.data?.error||result.text.slice(0,150)));report.push({name,status:'passed'});return result.data;}
async function register(role){const email=`audit.${role}.${stamp}@example.test`;const result=await request('POST','/api/account',{json:{action:'register',email,password,name:'LOCAL TEST '+role,role:role==='agent'?'agent':'buyer',company:role==='agent'?'LOCAL TEST OFFICE':undefined,companyCategory:'agency'}});const data=check('register '+role,result,201);return {...data.user,email,cookie:result.headers.get('set-cookie').split(';')[0]};}
try{
 const agent=await register('agent'),buyer=await register('buyer'),admin=await register('admin');
 local.prepare("UPDATE users SET role='admin',email_verified=1 WHERE id=?").run(admin.id);
 local.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(buyer.id);
 check('anonymous document denied',await request('GET','/api/agent-verification'),401);
 check('agent document status before submission',await request('GET','/api/agent-verification',{actor:agent}),200);
 const document=await request('POST','/api/agent-verification',{actor:agent,headers:{'Content-Type':'application/pdf','X-Document-Number':'TEST-12345','X-Document-Version':'0','X-Office-Application':encodeURIComponent(JSON.stringify({name:'LOCAL TEST CONTACT',phone:'+905551112233',address:'Local test office address, no real office',taxNumber:'TEST123456'}))},body:'%PDF-1.4\nLOCAL TEST DOCUMENT - NOT A REAL CERTIFICATE\n%%EOF'});
 const verification=check('upload private office application',document,201).verification;assert.equal(verification.state,'pending');
 check('another account cannot download document',await request('GET','/api/agent-verification?download=1&userId='+agent.id,{actor:buyer}),403);
 const download=await request('GET','/api/agent-verification?download=1',{actor:agent});check('owner can download private document',download,200);assert.match(download.headers.get('cache-control'),/private/);assert.match(download.text,/LOCAL TEST DOCUMENT/);
 const listingId=crypto.randomUUID(),image=`/api/media/listings/${agent.id}/${crypto.randomUUID()}.jpg`,at=new Date().toISOString();
 local.prepare("INSERT INTO listings(id,owner_id,title,description,purpose,property_type,price,currency,city,district,gross_area,net_area,images,presentation,status,created_at,updated_at) VALUES(?,?,'LOCAL TEST VILLA','Only an isolated test listing for end-to-end validation','satilik','villa',5000000,'TRY','Muğla','Bodrum',200,150,?,?,'pending',?,?)").run(listingId,agent.id,JSON.stringify([image]),JSON.stringify({floorPlan:'',videoUrl:'',tourUrl:'',gardenArea:250,plotArea:500}),at,at);
 local.close();closed=true;
 check('pending listing hidden from stranger',await request('GET','/api/listings/'+listingId,{actor:buyer}),404);
 check('buyer cannot approve office',await request('POST','/api/admin/agent-verifications',{actor:buyer,json:{id:agent.id,state:'approved',version:1}}),403);
 const queue=check('admin queue contains application details',await request('GET','/api/admin/agent-verifications',{actor:admin}),200);const row=queue.verifications.find(v=>v.user_id===agent.id);assert.equal(row.tax_number,'TEST123456');
 check('one admin approval publishes first listing',await request('POST','/api/admin/agent-verifications',{actor:admin,json:{id:agent.id,state:'approved',version:1}}),200);
 const listed=check('listing is public after approval',await request('GET','/api/listings/'+listingId),200).listing;assert.equal(listed.status,'published');assert.equal(listed.presentation.gardenArea,250);
 check('repeated admin decision rejected safely',await request('POST','/api/admin/agent-verifications',{actor:admin,json:{id:agent.id,state:'approved',version:1}}),409);
 check('matching province/type search',await request('GET','/api/listings?city='+encodeURIComponent('Muğla')+'&type=villa'),200);
 check('save favorite',await request('POST','/api/favorites',{actor:buyer,json:{id:listingId}}),200);
 check('duplicate favorite is harmless',await request('POST','/api/favorites',{actor:buyer,json:{id:listingId}}),200);
 const favorites=check('favorite appears for its owner',await request('GET','/api/favorites',{actor:buyer}),200);assert.equal(favorites.ids.filter(id=>id===listingId).length,1);
 check('remove favorite',await request('DELETE','/api/favorites?id='+listingId,{actor:buyer}),200);
 const messageId=crypto.randomUUID(),message={listingId,requestId:messageId,message:"LOCAL TEST property inquiry"};
 check("verified buyer sends listing message",await request("POST","/api/messages",{actor:buyer,json:message}),201);
 check("message retry is harmless",await request("POST","/api/messages",{actor:buyer,json:message}),201);
 const thread=check("only recipient receives the listing conversation",await request("GET","/api/messages?listingId="+listingId+"&peerId="+buyer.id,{actor:agent}),200);assert.equal(thread.messages.filter(m=>m.id===messageId).length,1);
 check("anonymous messages denied",await request("GET","/api/messages"),401);
 const appointment=crypto.randomUUID(),slot=new Date(Date.now()+2*86400000).toISOString();
 check('buyer requests appointment',await request('POST','/api/appointments',{actor:buyer,json:{action:'request',listingId,requestId:appointment,slotAt:slot,message:'LOCAL TEST viewing request'}}),200);
 check('appointment retry is harmless',await request('POST','/api/appointments',{actor:buyer,json:{action:'request',listingId,requestId:appointment,slotAt:slot,message:'LOCAL TEST viewing request'}}),200);
 check('seller confirms with private CRM note',await request('POST','/api/appointments',{actor:agent,json:{action:'update',id:appointment,version:1,status:'confirmed',stage:'viewing',privateNote:'PRIVATE LOCAL TEST NOTE'}}),200);
 const appointments=check('buyer can view appointment',await request('GET','/api/appointments',{actor:buyer}),200);const a=appointments.appointments.find(v=>v.id===appointment);assert.equal(a.private_note,null);assert.equal(a.stage,null);
 check('stale appointment update rejected',await request('POST','/api/appointments',{actor:agent,json:{action:'update',id:appointment,version:1,status:'completed'}}),409);
 check('logout',await request('POST','/api/account',{actor:buyer,json:{action:'logout'}}),200);
 assert.equal(check('logged-out session is invalid',await request('GET','/api/account',{actor:buyer}),200).user,null);
 const login=await request('POST','/api/account',{json:{action:'login',email:agent.email,password}});check('login after registration',login,200);
 console.log(JSON.stringify({environment:'isolated loopback Worker + local D1/R2',passed:report.length,notes:['Office document uses actual local R2. Listing fixture represents an already uploaded image; external image storage is tested separately.','No production account, certificate or email was used.'],checks:report},null,2));
 mkdirSync(path.resolve(root,'../audit-results'),{recursive:true});writeFileSync(path.resolve(root,'../audit-results/local-http.json'),JSON.stringify({passed:report.length,checks:report},null,2));
}finally{if(!closed)local.close()}
