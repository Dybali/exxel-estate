// Response compression for large route handler bodies (lib/response-compression-node.ts), 2026-11-24.
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {brotliDecompressSync,gunzipSync} from 'node:zlib';import {createRequire} from 'node:module';import ts from 'typescript';
const req=createRequire(import.meta.url);const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const m={exports:{}};new Function('require','module','exports',ts.transpileModule(read('lib/response-compression-node.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(req,m,m.exports);const {compressedBody}=m.exports;
const ask=enc=>new Request('https://site.test/i18n/de.json',{headers:enc?{'accept-encoding':enc}:{}});
const text=JSON.stringify(Object.fromEntries(Array.from({length:3000},(_,i)=>['Anahtar '+i,'Übersetzung Nummer '+i])));

test('Brotli when accepted (memoized with a key), gzip otherwise, plain without either',()=>{
 const a=compressedBody(text,ask('gzip, deflate, br'),'i18n:de:v1'),b=compressedBody(text,ask('br'),'i18n:de:v1');
 assert.equal(a.headers['Content-Encoding'],'br');assert.equal(a.body,b.body,'same bytes from memory');
 assert.equal(brotliDecompressSync(Buffer.from(a.body)).toString(),text);
 const g=compressedBody(text,ask('gzip'));assert.equal(g.headers['Content-Encoding'],'gzip');assert.equal(gunzipSync(Buffer.from(g.body)).toString(),text);
 assert.ok(a.body.byteLength<g.body.byteLength,'Brotli is smaller');
 const none=compressedBody(text,ask(''));assert.equal(none.body,text);assert.equal(none.headers.Vary,'Accept-Encoding');
 assert.match(read('app/i18n/[file]/route.ts'),/compressedBody\(JSON\.stringify\(messagesFor\(locale\)\), request, current \? `i18n:\$\{locale\}:\$\{messagesVersion\(\)\}` : undefined\)/);
});
