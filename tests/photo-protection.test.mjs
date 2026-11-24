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

test('server photo pipeline: PNG listing photos are stored as JPEG, 2560 px at most, smaller copies made',async()=>{
 const {createRequire}=await import('node:module');const req=createRequire(import.meta.url);const sharp=req('sharp');
 const wm={exports:{}};new Function('require','module','exports',ts.transpileModule(read('lib/photo-watermark-node.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText)(n=>n==='./photo-watermark-svg'?m.exports:req(n),wm,wm.exports);
 const png=await sharp({create:{width:3200,height:2000,channels:3,background:{r:40,g:120,b:90}}}).png().toBuffer();
 const out=await wm.exports.serverWatermark(new Uint8Array(png),'image/png',[640,1280]);
 assert.equal(out.type,'image/jpeg');const meta=await sharp(Buffer.from(out.bytes)).metadata();
 assert.equal(meta.format,'jpeg');assert.equal(Math.max(meta.width,meta.height),2560);assert.deepEqual(out.variants.map(v=>v.width),[640,1280]);
 const route=read('app/api/media/route.ts');assert.match(route,/const storedType=marked\?\.type\|\|file\.type;/);assert.match(route,/putExternalImage\(key,bytes,storedType,/);
 assert.match(read('components/ListingGallery.tsx'),/srcSet=\{photoVariantUrl\(gallery\[active\],1280\)===gallery\[active\]\?undefined:/,'the lightbox loads the 1280 copy on phones');
});
