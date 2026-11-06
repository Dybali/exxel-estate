// Imports a lib/*.ts module and its relative imports ("./x") as ES modules, transpiled with TypeScript.
// Bare imports (e.g. "react") stay as they are. Used by tests that need a small module graph.
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const urls=new Map();
function moduleUrl(file){
 const path=file.endsWith('.ts')?file:file+'.ts';
 if(urls.has(path))return urls.get(path);
 let code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 code=code.replace(/from\s+(['"])\.\/([\w-]+)\1/g,(_,quote,name)=>`from ${JSON.stringify(moduleUrl(path.replace(/[^/]+$/,'')+name))}`);
 const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
 urls.set(path,url);
 return url;
}
export const importTs=file=>import(moduleUrl(file));
