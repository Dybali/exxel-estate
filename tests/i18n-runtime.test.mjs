// The browser loads one language's messages (lib/i18n-runtime.ts) instead of the whole dictionary; the result
// must be the same text the server renders with lib/i18n-dictionary.ts.
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
const compile=(p,map={})=>{let code=ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});for(const [from,to] of Object.entries(map))code=code.split(from).join(to);return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');};
const locales=compile('locales');
const runtime=await import(compile('i18n-runtime',{'"./locales"':JSON.stringify(locales)}));
test('runtime: Turkish needs nothing, other languages load once, "Label: value" keeps the value',async()=>{
 assert.equal(runtime.messagesReady('tr'),true);assert.equal(runtime.translate('Kaydet','tr'),'Kaydet');
 assert.equal(runtime.messagesReady('de'),false);assert.equal(runtime.translate('Kaydet','de'),'Kaydet');
 let calls=0;globalThis.fetch=async url=>{calls++;assert.match(String(url),/^\/i18n\/de\.json\?v=abc$/);return new Response(JSON.stringify({'Kaydet':'Speichern','Geçersiz para birimi':'Ungültige Währung'}));};
 runtime.setMessagesVersion('abc');
 const first=runtime.loadMessages('de'),second=runtime.loadMessages('de');assert.equal(first,second);await first;
 assert.equal(calls,1);assert.equal(runtime.messagesReady('de'),true);
 assert.equal(runtime.translate('Kaydet','de'),'Speichern');
 assert.equal(runtime.translate('Geçersiz para birimi: JPY','de'),'Ungültige Währung: JPY');
 assert.equal(runtime.translate('Bilinmeyen','de'),'Bilinmeyen');
});
