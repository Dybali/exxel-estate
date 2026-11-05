// Test helper (not a test file): lib/email.ts and its imports as data: URLs, so tests can import the
// e-mail module without a bundler. `smtp` replaces the "@/lib/email-smtp" slot (default: the
// Cloudflare stand-in, i.e. no SMTP).
import {readFileSync} from 'node:fs';
import ts from 'typescript';
export const transpile=p=>ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
export const dataUrl=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
export const layoutUrl=()=>dataUrl(transpile('email-layout'));
export const configUrl=()=>dataUrl(transpile('email-smtp-config'));
export function emailUrl(smtp){
 const slot=smtp||dataUrl(transpile('email-smtp'));
 const code=transpile('email').replaceAll('"@/lib/email-smtp"',JSON.stringify(slot)).replaceAll('"./email-smtp-config"',JSON.stringify(configUrl())).replaceAll('"./email-layout"',JSON.stringify(layoutUrl()));
 if(/from "(\.\/|@\/)/.test(code))throw Error('unresolved import in lib/email.ts');
 return dataUrl(code);
}
