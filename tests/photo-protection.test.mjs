import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const m={exports:{}};new Function('require','module','exports',ts.transpileModule(readFileSync(path.join(root,'lib/photo-watermark-svg.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(()=>({}),m,m.exports);const W=m.exports;
const read=file=>readFileSync(path.join(root,file),'utf8');

// Listing photo protection (owner's request 2026-11-16).
test('watermark: corner mark plus a faint diagonal centre mark that follows the photo shape',()=>{
 const svg=W.watermarkSvg(2560,1600);
 assert.equal((svg.match(/>estatemarket24</g)||[]).length,2);
 const center=W.centerMarkLayout(2560,1600);
 assert.ok(center.opacity<=0.2,'faint enough to see the home');assert.ok(Math.abs(center.angle+32)<1,'along the diagonal');
 assert.ok(W.centerMarkLayout(1600,2560).angle<-45,'steeper on portrait photos');
 assert.deepEqual(W.watermarkLayout(640,400),{fontSize:14,x:627,y:387});
});
test('server watermark in the Node build, browser watermark otherwise; never both',()=>{
 assert.match(read('next.config.ts'),/"@\/lib\/photo-watermark": "\.\/lib\/photo-watermark-node\.ts"/);
 assert.match(read('lib/photo-watermark.ts'),/| null = null;/);
 const route=read('app/api/media/route.ts');
 assert.match(route,/export async function GET\(\)\{return ok\(\{serverWatermark:Boolean\(serverWatermark\)\}/);
 assert.match(route,/const marked=!purpose&&serverWatermark\?/,'listing photos only');
 assert.match(read('lib/photo-optimize.ts'),/watermark: wanted && !server/);
 assert.match(read('Dockerfile'),/ttf-liberation fontconfig/,'fonts for the watermark text');
});
test('hotlinks from other sites are refused; own pages, previews and e-mails are not',()=>{
 const route=read('app/api/media/[...key]/route.ts');
 const body=route.slice(route.indexOf('function hotlinked'),route.indexOf('export async function GET'));
 const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;const hotlinked=new Function('request',js.slice(js.indexOf('{')+1,js.lastIndexOf('}')));
 const req=(headers,url='https://site.test/api/media/listings/a/b.jpg')=>({url,headers:new Headers(headers)});
 assert.equal(hotlinked(req({'sec-fetch-dest':'image','sec-fetch-site':'cross-site',referer:'https://thief.example/page'})),true);
 assert.equal(hotlinked(req({'sec-fetch-dest':'image','sec-fetch-site':'same-origin',referer:'https://site.test/ilan/1'})),false);
 assert.equal(hotlinked(req({'sec-fetch-dest':'image','sec-fetch-site':'cross-site'})),false,'no referer: webmail, privacy settings');
 assert.equal(hotlinked(req({})),false,'crawlers and link previews');
 assert.match(read('components/PhotoGuard.tsx'),/contextmenu/);
});
