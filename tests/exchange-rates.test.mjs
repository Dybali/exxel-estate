import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../lib/exchange-rates.ts',import.meta.url),'utf8');
const compiled=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const {parseEcbDaily,parseDailyRates}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
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

test('additional currencies are converted from ECB euro rates and missing optional rates are omitted',()=>{
  const more=xml.replace('</Cube></Cube>',"<Cube currency='GBP' rate='0.85'/><Cube currency='CHF' rate='0.95'/></Cube></Cube>");
  const rates=parseEcbDaily(more,at);
  assert.ok(Math.abs(rates.gbpTry-55.6715/0.85)<1e-12);
  assert.ok(Math.abs(rates.chfTry-55.6715/0.95)<1e-12);
  assert.equal(parseEcbDaily(xml,at).gbpTry,undefined);
});

test('daily rates carry today\'s date, weekends included, and reject stale or broken data',()=>{
  const sunday=Date.parse('2026-11-01T09:00:00Z');
  const body={result:'success',time_last_update_unix:Date.parse('2026-11-01T00:02:31Z')/1000,rates:{TRY:55.72,USD:1.116,GBP:0.8335,CHF:0.92}};
  const rates=parseDailyRates(body,sunday);
  assert.equal(rates.date,'2026-11-01');assert.equal(rates.source,'ExchangeRate-API');
  assert.equal(rates.eurTry,55.72);assert.ok(Math.abs(rates.usdTry-55.72/1.116)<1e-9);assert.ok(Math.abs(rates.gbpTry-55.72/0.8335)<1e-9);
  assert.throws(()=>parseDailyRates({...body,result:'error'},sunday));
  assert.throws(()=>parseDailyRates({...body,time_last_update_unix:Date.parse('2026-10-25T00:00:00Z')/1000},sunday));
  assert.throws(()=>parseDailyRates({...body,rates:{USD:1.1}},sunday));
});
