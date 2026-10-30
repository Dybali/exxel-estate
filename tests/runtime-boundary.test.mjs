import {test} from 'node:test';import assert from 'node:assert/strict';import {readdirSync,readFileSync,statSync} from 'node:fs';import {join,relative} from 'node:path';
// The site moves to Mittwald (Node.js) later: only lib/runtime.ts may know the Workers runtime.
const root=new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const files=dir=>readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?files(path):/\.(ts|tsx)$/.test(name)?[path]:[];});
test('only lib/runtime.ts imports cloudflare:workers',()=>{
 const offenders=['app','lib','components'].flatMap(dir=>files(join(root,dir))).map(path=>relative(root,path).replaceAll('\\','/')).filter(path=>path!=='lib/runtime.ts'&&/from\s+['"]cloudflare:workers['"]/.test(readFileSync(join(root,path),'utf8')));
 assert.deepEqual(offenders,[]);
});
