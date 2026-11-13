import {test} from 'node:test';import assert from 'node:assert/strict';import {readdirSync,readFileSync} from 'node:fs';
// A React hook written after a component's closing brace runs at import time and breaks the whole page (2026-11-13:
// /ilan-ver answered 500). Catch hooks on a line that starts by closing a top-level block.
test('no React hook call outside a component body',()=>{
 const bad=[];
 for(const name of readdirSync(new URL('../components/',import.meta.url)).filter(f=>f.endsWith('.tsx'))){
  const lines=readFileSync(new URL('../components/'+name,import.meta.url),'utf8').split(/\r?\n/);
  lines.forEach((line,index)=>{if(/^\}.*\buse(State|Effect|Ref|Memo|Callback|Locale)\(/.test(line))bad.push(`${name}:${index+1}`);});
 }
 assert.deepEqual(bad,[]);
});
