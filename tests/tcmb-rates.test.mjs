import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {importTs} from './ts-module.mjs';
const tcmb=await importTs('lib/tcmb.ts');
const {parseTcmbXml,bulletinUsable,createBulletinCache,tlPerUnit,toTl,fromTl,TCMB_REFRESH_MS}=tcmb;
const display=await importTs('lib/display-currency.ts');
const {priceView,roundDisplay,formatMoney,formatRateDate,resolveDisplayCurrency,defaultDisplayCurrency,currencyFromCookies,currencyCookie,COUNTRY_CURRENCY,currencySupported,priceInTl,isolate}=display;
const {tlPriceRange,priceCurrency,listingCurrencyAllowed}=await importTs('lib/price-filters.ts');
const {tlRates,tlPriceSql}=await importTs('lib/listing-sort.ts');

// Shape of https://www.tcmb.gov.tr/kurlar/today.xml (bulletin 2026/208 of 05.11.2026, trimmed).
const currency=(code,unit,selling,extra='')=>`<Currency CrossOrder="0" Kod="${code}" CurrencyCode="${code}">\n\t\t\t<Unit>${unit}</Unit>\n\t\t\t<Isim>X</Isim>\n\t\t\t<CurrencyName>X</CurrencyName>\n\t\t\t<ForexBuying>1.0</ForexBuying>\n\t\t\t<ForexSelling>${selling}</ForexSelling>\n\t\t\t<BanknoteBuying>1</BanknoteBuying>${extra}\n\t</Currency>`;
const bulletinXml=(body,date='05.11.2026')=>`<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="isokur.xsl"?>\n<Tarih_Date Tarih="${date}" Date="11/05/2026"  Bulten_No="2026/208" >\n${body}\n</Tarih_Date>`;
const XML=bulletinXml([currency('USD',1,'50.0489'),currency('EUR',1,'56.2524'),currency('GBP',1,'67.5420'),currency('SAR',1,'13.3339'),currency('JPY',100,'31.7043'),currency('RUB',1,'0.61518'),currency('AED',1,'13.7035'),currency('XDR',1,'')].join('\n'));
const at=iso=>Date.parse(iso);

test('TCMB XML: ForexSelling / Unit per currency, the bulletin date from Tarih, the bulletin number',()=>{
 const b=parseTcmbXml(XML);
 assert.equal(b.source,'TCMB');assert.equal(b.date,'2026-11-05');assert.equal(b.bulletinNo,'2026/208');
 assert.equal(b.rates.USD,50.0489);assert.equal(b.rates.EUR,56.2524);assert.equal(b.rates.RUB,0.61518);
 assert.ok(Math.abs(b.rates.JPY-0.317043)<1e-12,'Unit 100: TL per one yen');
 assert.equal('XDR' in b.rates,false,'empty ForexSelling is skipped');assert.equal('TRY' in b.rates,false);
});

test('TCMB XML: missing, zero, negative and non-numeric values are skipped; malformed bulletins are rejected',()=>{
 const b=parseTcmbXml(bulletinXml([currency('USD',1,'50.0489'),currency('EUR',1,'0'),currency('GBP',1,'-67.5'),currency('CHF',1,'abc'),currency('SAR',0,'13.3'),currency('AED','x','13.7'),currency('RUB',1,'1e3'),currency('CAD',1,'35.9165').replace(/<ForexSelling>[^<]*<\/ForexSelling>/,'')].join('\n')));
 assert.deepEqual(Object.keys(b.rates),['USD']);
 assert.throws(()=>parseTcmbXml(bulletinXml(currency('EUR',1,'0'))),/no usable rates/);
 assert.throws(()=>parseTcmbXml(XML.replace(/Tarih="[^"]*"/,'')),/date missing/);
 assert.throws(()=>parseTcmbXml(XML.replace('05.11.2026','31.02.2026')),/date invalid/);
 assert.throws(()=>parseTcmbXml('<html><body>Service unavailable</body></html>'));
 assert.throws(()=>parseTcmbXml('x'.repeat(200_001)));
 assert.throws(()=>parseTcmbXml(null));
});

test('weekends and holidays: the last bulletin stays usable with its own date; future or very old bulletins are not',()=>{
 const friday=parseTcmbXml(XML.replace('05.11.2026','06.11.2026'));
 assert.equal(friday.date,'2026-11-06');
 assert.equal(bulletinUsable(friday,at('2026-11-08T10:00:00Z')),true,'Sunday shows Friday’s bulletin');
 assert.equal(bulletinUsable(parseTcmbXml(XML),at('2026-11-14T10:00:00Z')),true,'nine-day holiday');
 assert.equal(bulletinUsable(parseTcmbXml(XML),at('2026-12-10T10:00:00Z')),false,'older than three weeks');
 assert.equal(bulletinUsable(parseTcmbXml(XML.replace('05.11.2026','09.11.2026')),at('2026-11-06T10:00:00Z')),false,'dated in the future');
 assert.equal(bulletinUsable({source:'ECB',date:'2026-11-05',rates:{EUR:1}},at('2026-11-06T10:00:00Z')),false);
 assert.equal(bulletinUsable({source:'TCMB',date:'2026-11-05',rates:{EUR:-1}},at('2026-11-06T10:00:00Z')),false);
});

test('conversion: TL per unit, TL → display amount, through TL for legacy currencies; display rounding only',()=>{
 const rates={...parseTcmbXml(XML),stale:false};
 assert.equal(tlPerUnit('TRY',rates),1);assert.equal(tlPerUnit('IRR',rates),undefined);assert.equal(tlPerUnit('EUR',null),undefined);
 assert.equal(toTl(100_000,'EUR',rates),5_625_240);assert.equal(fromTl(5_625_240,'EUR',rates),100_000);
 assert.ok(Math.abs(fromTl(6_450_000,'JPY',rates)-6_450_000/0.317043)<1e-6);
 assert.deepEqual([roundDisplay(987.6),roundDisplay(9_999.4),roundDisplay(114_663),roundDisplay(10_484_736),roundDisplay(0.4)],[988,9_999,114_700,10_485_000,0]);
 // 6 450 000 TL in EUR: 114 661.77 → 114 700; the stored price itself never changes.
 const view=priceView(6_450_000,'TRY','EUR',rates);
 assert.deepEqual(view,{kind:'converted',amount:114_700,currency:'EUR',base:{amount:6_450_000,currency:'TRY'},date:'2026-11-05',stale:false});
 assert.ok(Math.abs(priceView(6_450_000,'TRY','EUR',rates,{round:false}).amount-114_661.77)<0.01);
 assert.deepEqual(priceView(6_450_000,'TRY','TRY',rates),{kind:'base',amount:6_450_000,currency:'TRY'});
 // Legacy EUR listing: TL base computed with the same bulletin; EUR display shows it as stored.
 assert.deepEqual(priceView(100_000,'EUR','EUR',rates),{kind:'base',amount:100_000,currency:'EUR'});
 assert.equal(priceView(100_000,'EUR','TRY',rates).amount,5_625_000);
 assert.equal(priceView(100_000,'EUR','USD',rates).amount,112_400);
 assert.equal(priceInTl(100_000,'EUR',rates),5_625_240);assert.equal(priceInTl(100_000,'EUR',null),undefined);
});

test('unsupported currency or no bulletin: the stored TL price, never an invented amount',()=>{
 const rates={...parseTcmbXml(XML),stale:false};
 assert.deepEqual(priceView(6_450_000,'TRY','IRR',rates),{kind:'unavailable',amount:6_450_000,currency:'TRY',requested:'IRR'});
 assert.deepEqual(priceView(6_450_000,'TRY','EUR',null),{kind:'unavailable',amount:6_450_000,currency:'TRY',requested:'EUR'});
 assert.equal(priceView(100_000,'GBP','EUR',{...rates,rates:{EUR:56}}).kind,'unavailable','legacy currency without a rate');
 assert.equal(currencySupported('IRR',rates),false);assert.equal(currencySupported('TRY',null),true);assert.equal(currencySupported('SAR',rates),true);
});

test('cache: TCMB at most every 15 minutes, last good bulletin on failure (marked stale), recovery, persistence',async()=>{
 let now=at('2026-11-06T09:00:00Z'),calls=0,mode='ok',xml=XML;const saved=[];
 const cache=createBulletinCache({now:()=>now,fetchXml:async()=>{calls++;if(mode==='fail')throw new Error('offline');if(mode==='broken')return '<html>maintenance</html>';return xml;},store:{read:async()=>null,write:async b=>{saved.push(b.date);}}});
 assert.equal(cache.peek(),null);
 const first=await cache.get();assert.equal(first.date,'2026-11-05');assert.equal(first.stale,false);assert.equal(calls,1);assert.deepEqual(saved,['2026-11-05']);
 now+=TCMB_REFRESH_MS-1;await cache.get();assert.equal(calls,1,'no second request within 15 minutes');
 now+=1;mode='fail';const failed=await cache.get();assert.equal(calls,2);assert.equal(failed.date,'2026-11-05','last good bulletin with its real date');assert.equal(failed.stale,true);
 now+=60_000;await cache.get();assert.equal(calls,2,'a failure also waits 15 minutes before the next try');
 now+=TCMB_REFRESH_MS;mode='broken';assert.equal((await cache.get()).stale,true);assert.equal(calls,3);
 now+=TCMB_REFRESH_MS;mode='ok';xml=XML.replace('05.11.2026','06.11.2026');const fresh=await cache.get();assert.equal(fresh.date,'2026-11-06');assert.equal(fresh.stale,false);
 now+=TCMB_REFRESH_MS;xml=XML;assert.equal((await cache.get()).date,'2026-11-06','an older copy never replaces a newer bulletin');
 // Concurrent requests share one TCMB call.
 now+=TCMB_REFRESH_MS;const before=calls;await Promise.all([cache.get(),cache.get(),cache.get()]);assert.equal(calls,before+1);
 // The snapshot is a copy: callers cannot change the cached rates.
 const copy=await cache.get();copy.rates.EUR=1;assert.notEqual(cache.peek().rates.EUR,1);
});

test('cache: no usable bulletin means no rates (TL only); a persisted bulletin is used while TCMB is down',async()=>{
 const now=at('2026-11-07T09:00:00Z');
 const down=createBulletinCache({now:()=>now,fetchXml:async()=>{throw new Error('offline');}});
 assert.equal(await down.get(),null);
 const persisted=createBulletinCache({now:()=>now,fetchXml:async()=>{throw new Error('offline');},store:{read:async()=>({...parseTcmbXml(XML)}),write:async()=>{}}});
 const snapshot=await persisted.get();assert.equal(snapshot.date,'2026-11-05');assert.equal(snapshot.stale,true);
 const tooOld=createBulletinCache({now:()=>at('2026-12-30T09:00:00Z'),fetchXml:async()=>{throw new Error('offline');},store:{read:async()=>parseTcmbXml(XML),write:async()=>{}}});
 assert.equal(await tooOld.get(),null,'a stale copy older than three weeks is not shown');
});

test('display currency: language defaults, explicit choice wins, cookie and country shortcuts',()=>{
 assert.deepEqual(Object.fromEntries(['tr','de','fr','nl','en','ru','fa','ar'].map(l=>[l,defaultDisplayCurrency(l)])),{tr:'TRY',de:'EUR',fr:'EUR',nl:'EUR',en:'GBP',ru:'RUB',fa:'IRR',ar:'SAR'});
 assert.equal(defaultDisplayCurrency('xx'),'TRY');
 assert.equal(resolveDisplayCurrency(null,'de'),'EUR');assert.equal(resolveDisplayCurrency('USD','de'),'USD');assert.equal(resolveDisplayCurrency('TRY','fa'),'TRY');
 assert.equal(resolveDisplayCurrency('IRR','tr'),'TRY','IRR is never an explicit choice');assert.equal(resolveDisplayCurrency('<script>','en'),'GBP');
 assert.equal(currencyFromCookies('a=1; em24_currency=GBP; b=2'),'GBP');assert.equal(currencyFromCookies('em24_currency=JPY'),null);assert.equal(currencyFromCookies(''),null);assert.equal(currencyFromCookies(null),null);
 assert.match(currencyCookie('USD'),/^em24_currency=USD; Path=\/; SameSite=Lax; Max-Age=31536000$/);assert.match(currencyCookie(null),/Max-Age=0$/);
 assert.deepEqual(['TR','GB','US','SA','AE','DE','FR','NL','AT','ES','BG'].map(c=>COUNTRY_CURRENCY[c]),['TRY','GBP','USD','SAR','AED','EUR','EUR','EUR','EUR','EUR','EUR']);
});

test('formatting follows the UI locale (Intl), RTL included; bulletin dates are Gregorian',()=>{
 assert.equal(formatMoney(6_450_000,'TRY','tr'),'₺6.450.000');
 assert.match(formatMoney(114_700,'EUR','de'),/^114\.700\s€$/);
 assert.equal(formatMoney(114_700,'EUR','en'),'€114,700');
 assert.match(formatMoney(114_700,'EUR','fr'),/^114\s700\s€$/);
 assert.match(formatMoney(10_485_000,'RUB','ru'),/^10\s485\s000\s₽$/);
 assert.match(formatMoney(483_700,'SAR','ar'),/ر\.س/);assert.match(formatMoney(483_700,'SAR','ar'),/483|٤٨٣/);
 assert.match(formatMoney(6_450_000,'TRY','fa'),/۶٬۴۵۰٬۰۰۰/);
 assert.equal(formatMoney(12.5,'TRY','tr',2),'₺12,5');
 assert.equal(formatRateDate('2026-11-05','tr'),'05.11.2026');
 assert.equal(formatRateDate('2026-11-05','de'),'05.11.2026');
 assert.match(formatRateDate('2026-11-05','fa'),/۲۰۲۶/,'Gregorian year, Persian digits');
 assert.match(formatRateDate('2026-11-05','ar'),/2026|٢٠٢٦/);
 assert.equal(isolate('€1'),'⁨€1⁩');
});

test('price filter: the range in the display currency becomes a TL range; legacy rows are compared in TL (SQLite)',()=>{
 const rates={...parseTcmbXml(XML),stale:false};const q=o=>new URLSearchParams(o);
 assert.deepEqual(tlPriceRange(q({minPrice:'100000',maxPrice:'120000',currency:'EUR'}),rates),{currency:'EUR',min:5_625_240,max:6_750_288});
 assert.deepEqual(tlPriceRange(q({minPrice:'5000000'}),null),{currency:'TRY',min:5_000_000,max:undefined});
 assert.equal(tlPriceRange(q({minPrice:'1',currency:'IRR'}),rates),null,'no rate: the caller answers with an error');
 assert.equal(priceCurrency(q({currency:'EUR'})),'','without a range the currency filters nothing');
 assert.throws(()=>priceCurrency(q({currency:"EUR' OR 1=1",minPrice:'1'})));
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE listings(id text,price integer,currency text)');
 for(const [id,price,code] of [['tl-low',5_000_000,'TRY'],['tl-mid',6_450_000,'TRY'],['tl-high',7_000_000,'TRY'],['eur',110_000,'EUR'],['usd',120_000,'USD'],['gbp',90_000,'GBP']])db.prepare('INSERT INTO listings VALUES(?,?,?)').run(id,price,code);
 const search=(range,table)=>{const tl=tlPriceSql(table);return db.prepare(`SELECT id FROM listings l WHERE ${tl}>=? AND ${tl}<=? ORDER BY ${tl} ASC`).all(range.min,range.max).map(r=>r.id);};
 // 100 000–120 000 € = 5 625 240–6 750 288 TL: eur 6 187 764, usd 6 005 868, gbp 6 078 780, tl-mid 6 450 000.
 assert.deepEqual(search(tlPriceRange(q({minPrice:'100000',maxPrice:'120000',currency:'EUR'}),rates),tlRates(rates)),['usd','gbp','eur','tl-mid']);
 // Without a bulletin only TRY listings can be compared.
 assert.deepEqual(search({min:0,max:10_000_000},tlRates(null)),['tl-low','tl-mid','tl-high']);
});

test('listing price entry: TRY (or TL) only',()=>{
 for(const ok of [undefined,null,'','TRY','try','TL',' tl '])assert.equal(listingCurrencyAllowed(ok),true,String(ok));
 for(const bad of ['EUR','USD','GBP','IRR',5,{}])assert.equal(listingCurrencyAllowed(bad),false,String(bad));
});
