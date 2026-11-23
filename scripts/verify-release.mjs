import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// npm run verify: tests, type check and the production build (the same Next.js build as the Docker image).
const root=fileURLToPath(new URL('../',import.meta.url));
for(const args of [
 ['--test','tests/*.test.mjs'],
 ['node_modules/typescript/bin/tsc','--project','tsconfig.site.json','--pretty','false'],
 ['node_modules/next/dist/bin/next','build'],
]){const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
