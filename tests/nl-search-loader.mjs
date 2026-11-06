// Loads lib/*.ts modules (and their "./" and "@/" imports) as CommonJS for the natural-language search tests.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const requireNative=createRequire(import.meta.url);
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const cache=new Map();
export function load(file,overrides={}){
 if(!Object.keys(overrides).length&&cache.has(file))return cache.get(file);
 const m={exports:{}};if(!Object.keys(overrides).length)cache.set(file,m.exports);
 const resolve=name=>{
  if(overrides[name])return overrides[name];
  if(name.endsWith('.json'))return JSON.parse(read(name.replace(/^@\//,'')));
  if(name.startsWith('./'))return load('lib/'+name.slice(2)+'.ts',overrides);
  if(name.startsWith('@/lib/'))return load(name.slice(2)+'.ts',overrides);
  return requireNative(name);
 };
 new Function('require','module','exports',ts.transpile(read(file),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}))(resolve,m,m.exports);
 if(!Object.keys(overrides).length)cache.set(file,m.exports);
 return m.exports;
}
