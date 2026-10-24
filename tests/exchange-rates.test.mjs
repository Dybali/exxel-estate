import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../lib/exchange-rates.ts',import.meta.url),'utf8');
const compiled=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const {parseEcbDaily}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const at=Date.parse('2026-10-24T12:00:00Z');
const xml="<Cube><Cube time='2026-10-23'><Cube currency='USD' rate='1.1193'/><Cube currency='TRY' rate='55.6715'/></Cube></Cube>";

test('ECB euro base is converted into USD/TRY without treating the cross rate as a direct quote',()=>{
  const rates=parseEcbDaily(xml,at);
  assert.equal(rates.date,'2026-10-23');
  assert.equal(rates.eurTry,55.6715);
  assert.equal(rates.eurUsd,1.1193);
  assert.ok(Math.abs(rates.usdTry-55.6715/1.1193)<1e-12);
});

test('missing currencies and old or future publications are not displayed as current',()=>{
  assert.throws(()=>parseEcbDaily(xml.replace("<Cube currency='TRY' rate='55.6715'/>",''),at));
  assert.throws(()=>parseEcbDaily(xml.replace('2026-10-23','2026-10-01'),at));
  assert.throws(()=>parseEcbDaily(xml.replace('2026-10-23','2026-10-27'),at));
});
