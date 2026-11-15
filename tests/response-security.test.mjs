import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpile(readFileSync(new URL('../lib/response-security.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const {withResponseSecurity}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('response hardening preserves private caching, cookies and body',async()=>{
 const source=new Response('private response',{status:401,headers:{'Set-Cookie':'session=; HttpOnly; Secure','Cache-Control':'private, no-store','Content-Type':'application/json'}});
 const result=withResponseSecurity(source);
 assert.equal(result.status,401);assert.equal(await result.text(),'private response');
 for(const name of ['Set-Cookie','Cache-Control','Content-Type'])assert.equal(result.headers.get(name),source.headers.get(name));
 assert.equal(result.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(result.headers.get('Referrer-Policy'),'strict-origin-when-cross-origin');
});
test('route-specific privacy and download sandbox policies are retained',()=>{
 const result=withResponseSecurity(new Response(null,{headers:{'Referrer-Policy':'no-referrer','Content-Security-Policy':"sandbox; default-src 'none'",'Content-Disposition':'attachment; filename="document.png"'}}));
 assert.equal(result.headers.get('Referrer-Policy'),'no-referrer');assert.equal(result.headers.get('Content-Security-Policy'),"sandbox; default-src 'none'");assert.match(result.headers.get('Content-Disposition'),/attachment/);
 const redirect=withResponseSecurity(Response.redirect('https://site.example/giris',302));assert.equal(redirect.status,302);assert.equal(redirect.headers.get('Location'),'https://site.example/giris');
});
test('pages can only be framed by the site itself and HTTPS is remembered',()=>{
 const result=withResponseSecurity(new Response('<html></html>',{headers:{'Content-Type':'text/html'}}));
 assert.equal(result.headers.get('Content-Security-Policy'),"frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
 assert.equal(result.headers.get('X-Frame-Options'),'SAMEORIGIN');
 assert.equal(result.headers.get('Strict-Transport-Security'),'max-age=31536000');
});
