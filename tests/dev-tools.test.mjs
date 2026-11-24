// Local development helpers (2026-11-24): the S3 stand-in for uploads (lib/dev-storage.ts), the outbox for
// e-mails, and a single licence form on Ofis bilgilerim.
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import ts from 'typescript';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const storage=await import('data:text/javascript;base64,'+Buffer.from(ts.transpile(read('lib/dev-storage.ts'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));

test('dev storage: only under next dev; PUT, HEAD, GET with If-Match, list and DELETE like S3',async()=>{
 const before=process.env.NODE_ENV,cwd=process.cwd(),dir=mkdtempSync(path.join(tmpdir(),'em24-storage-'));
 try{
  process.env.NODE_ENV='production';assert.equal(storage.devStorageEnabled(),false);
  process.env.NODE_ENV='development';assert.equal(storage.devStorageEnabled(),true);
  process.chdir(dir);
  const url=k=>`${storage.DEV_STORAGE_ORIGIN}/exxel-estate-private/${k}`;
  const put=await storage.devStorageFetch(url('private/a/doc.pdf'),{method:'PUT',body:new Uint8Array([1,2,3]),headers:{'Content-Type':'application/pdf','x-amz-meta-owner':'u1'}});
  assert.equal(put.status,200);const etag=put.headers.get('etag');
  const head=await storage.devStorageFetch(url('private/a/doc.pdf'),{method:'HEAD'});assert.equal(head.headers.get('content-type'),'application/pdf');assert.equal(head.headers.get('x-amz-meta-owner'),'u1');assert.equal(head.headers.get('content-length'),'3');
  const got=await storage.devStorageFetch(url('private/a/doc.pdf'));assert.deepEqual([...new Uint8Array(await got.arrayBuffer())],[1,2,3]);
  assert.equal((await storage.devStorageFetch(url('private/a/doc.pdf'),{headers:{'If-Match':'"other"'}})).status,412);
  assert.equal((await storage.devStorageFetch(url('private/a/doc.pdf'),{headers:{'If-Match':etag}})).status,200);
  const list=await (await storage.devStorageFetch(`${storage.DEV_STORAGE_ORIGIN}/exxel-estate-private?list-type=2&prefix=private/`)).text();assert.match(list,/<Key>private\/a\/doc\.pdf<\/Key><Size>3<\/Size>/);
  await storage.devStorageFetch(url('private/%2e%2e/%2e%2e/%2e%2e/escape.txt'),{method:'PUT',body:'x'});assert.equal(existsSync(path.join(dir,'escape.txt')),false,'dot segments never leave .data/storage');
  assert.equal((await storage.devStorageFetch(url('private/a/doc.pdf'),{method:'DELETE'})).status,204);
  assert.equal((await storage.devStorageFetch(url('private/a/doc.pdf'))).status,404);
  assert.equal(existsSync(path.join(dir,'.data','storage','exxel-estate-private','private','a','doc.pdf')),false);
 }finally{process.chdir(cwd);process.env.NODE_ENV=before;rmSync(dir,{recursive:true,force:true});}
});

test('wiring: storage and e-mail fall back to local stand-ins only in development; one licence form',()=>{
 assert.match(read('lib/external-r2.ts'),/if \(devStorageEnabled\(\)\) return \{ endpoint: `\$\{DEV_STORAGE_ORIGIN\}\/exxel-estate-images`/);
 assert.match(read('lib/private-bucket.ts'),/\?\? \(devStorageEnabled\(\) \? s3PrivateBucket\(\{\}, devStorageFetch\) : null\)/);
 const email=read('lib/email.ts');assert.match(email,/process\.env\.NODE_ENV === "development" \? devOutbox\(message\) : \{ sent: false, reason: "not_configured" \}/);
 assert.match(read('lib/email-codes-server.ts'),/process\.env\.NODE_ENV === "development" \? "local-development-only-email-code-key" : null/);
 assert.doesNotMatch(read('components/CompanyAccount.tsx'),/OfficeVerification/,'the licence form is rendered once, by the Dashboard');
 assert.match(read('components/Dashboard.tsx'),/<CompanyAccount\/><OfficeVerification\/>/);
});

test('missing pages answer 404: no page-wide Suspense boundary in the language provider',()=>{
 const i18n=read('lib/i18n.tsx');
 assert.doesNotMatch(i18n,/<Suspense/,'a boundary around every page made notFound() answer 200');
 assert.match(i18n,/<LocaleContext\.Provider value=\{value\}><MessagesGate locale=\{locale\}>\{children\}<\/MessagesGate><\/LocaleContext\.Provider>/);
 assert.match(read('app/ilan/[id]/page.tsx'),/listing\.status!=='published'\)notFound\(\);/);
});

test('office consultants sign up with the office code and join the team after verification',()=>{
 const auth=read('components/AuthForm.tsx');
 assert.match(auth,/<option value="consultant">\{t\("Bir emlak ofisinde danışmanım"\)\}<\/option>/);
 assert.match(auth,/role:role==="developer"\?"agent":consultant\?"buyer":role,/,'a consultant account is a member account, no licence');
 assert.match(auth,/name="companyCode" required minLength=\{4\}/,'the office code is required for consultants');
 assert.match(auth,/params\.get\("role"\) === "consultant"/);
 const team=read('components/CompanyTeam.tsx');
 assert.match(team,/\/giris\?role=consultant&kod=/,'invitation links open sign-up with the code');
 assert.match(team,/if\(autoJoined\.current\|\|!data\|\|!code\|\|data\.membership\|\|data\.company\)return;autoJoined\.current=true;void action\(\{action:'redeem_code',code\}\);/);
 assert.match(read('components/Dashboard.tsx'),/sessionStorage\.getItem\("company-invite-code"\)\)return "ekip";/);
});
