// Housing market page data from TCMB EVDS (lib/market-stats.ts, 2026-11-18).
import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import ts from 'typescript';
const load=p=>import('data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));
const m=await load('market-stats');
const centers=JSON.parse(readFileSync(new URL('../data/province-centers.json',import.meta.url),'utf8'));

test('81 provinces, each in one region, matching the site province list',()=>{
 assert.equal(m.MARKET_PROVINCES.length,81);
 assert.deepEqual([...m.MARKET_PROVINCES].sort(),Object.keys(centers).sort());
 for(const p of m.MARKET_PROVINCES)assert.ok(m.regionOf(p),p);
});

test('TCMB series codes (taken from the EVDS series lists)',()=>{
 assert.equal(m.priceSeries('İstanbul'),'TP.BIRIMFIYAT.IST');assert.equal(m.priceSeries('Gaziantep'),'TP.BIRIMFIYAT.ANTEP');
 assert.equal(m.priceSeries('Şanlıurfa'),'TP.BIRIMFIYAT.URFA');assert.equal(m.priceSeries('Kırklareli'),'TP.BIRIMFIYAT.KIRKLARELI');
 assert.equal(m.priceSeries('Iğdır'),'TP.BIRIMFIYAT.IGDIR');assert.equal(m.priceSeries('Muğla'),'TP.BIRIMFIYAT.MUGLA');
 assert.equal(m.rentSeries('İstanbul'),'TP.BK.ISTANBUL');assert.equal(m.rentSeries('Afyonkarahisar'),'TP.BK.AFYONKARAHISAR');
 assert.equal(m.rentSeries('Kahramanmaraş'),'TP.BK.KAHRAMANMARAS');assert.equal(m.rentSeries('Şanlıurfa'),'TP.BK.SANLIURFA');
 const all=m.marketSeriesBatches().flatMap(b=>b.series);
 assert.equal(all.length,4+81*2+19*2);assert.equal(new Set(all).size,all.length);
 assert.ok(m.marketSeriesBatches().every(b=>b.series.length<=20));
 // One frequency per request: quarterly unit prices and rents, monthly indices.
 for(const b of m.marketSeriesBatches())assert.ok(b.series.every(s=>/^TP\.(BIRIMFIYAT|BK)\./.test(s)===(b.frequency===6)),b.series[0]);
 assert.equal(m.evdsUrl(['TP.KFE.TR'],new Date('2021-01-05'),new Date('2026-11-18'),5).endsWith('&type=json&frequency=5'),true);
 assert.equal(m.evdsUrl(['TP.KFE.TR','TP.BK.TR'],new Date('2021-01-05'),new Date('2026-11-18')),'https://evds3.tcmb.gov.tr/igmevdsms-dis/series=TP.KFE.TR-TP.BK.TR&startDate=05-01-2021&endDate=18-11-2026&type=json');
});

test('periods and EVDS answers',()=>{
 assert.equal(m.normalizePeriod('2026-10',false),'2026-10');assert.equal(m.normalizePeriod('2026-3',true),'2026-Q3');
 assert.equal(m.normalizePeriod('2026-Q2',true),'2026-Q2');assert.equal(m.normalizePeriod('01-07-2026',true),'2026-Q3');
 assert.equal(m.normalizePeriod('01-07-2026',false),'2026-07');assert.equal(m.normalizePeriod('x',false),null);
 const parsed=m.parseEvds({items:[{Tarih:'2025-3',TP_BIRIMFIYAT_IST:'50000.5',TP_KFE_TR:null},{Tarih:'2025-4',TP_BIRIMFIYAT_IST:'',TP_KFE_TR:'1,5'},{Tarih:'2024-4',TP_BIRIMFIYAT_IST:'40000'}]},['TP.BIRIMFIYAT.IST','TP.KFE.TR']);
 assert.deepEqual(parsed['TP.BIRIMFIYAT.IST'],[['2024-Q4',40000],['2025-Q3',50000.5]]);
 assert.deepEqual(parsed['TP.KFE.TR'],[['2025-04',1.5]]);
 assert.deepEqual(m.parseEvds(null,['TP.KFE.TR']),{'TP.KFE.TR':[]});
});

test('figures: yearly change, gross yield only for the same quarter, payback',()=>{
 const price=[['2025-Q2',30000],['2025-Q3',32000],['2025-Q4',34000],['2026-Q1',36000],['2026-Q2',40000]];
 const rent=[['2026-Q1',150],['2026-Q2',200]];
 const f=m.figures('İzmir',price,rent,[],[],'TR31');
 assert.equal(f.price,40000);assert.ok(Math.abs(f.priceChange-33.333)<0.01);
 assert.equal(f.rent,200);assert.equal(f.grossYield,6);assert.ok(Math.abs(f.paybackYears-16.667)<0.01);
 assert.equal(f.rentChange,null);
 assert.equal(m.figures('X',price,[['2026-Q1',150]],[],[],null).grossYield,null);
 const empty=m.figures('X',[],[],[],[],null);assert.equal(empty.price,null);assert.equal(empty.grossYield,null);
});

test('snapshot is kept only when the national series and most provinces came back',()=>{
 const values={'TP.BIRIMFIYAT.TR':[['2026-Q2',40000]]};
 assert.equal(m.snapshotUsable(m.buildSnapshot(values)),false);
 for(const p of m.MARKET_PROVINCES)values[m.priceSeries(p)]=[['2026-Q2',30000]];
 const snap=m.buildSnapshot(values,new Date('2026-11-18T06:00:00Z'));
 assert.equal(m.snapshotUsable(snap),true);
 const view=m.marketView(snap);assert.equal(view.provinces.length,81);assert.equal(view.turkey.price,40000);
 assert.equal(view.provinces.find(p=>p.name==='Ankara').region,'TR51');
});

test('storage: one row, created on first use (SQLite and PostgreSQL)',async()=>{
 const s=await import('data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/market-stats-store.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));
 const sql=new DatabaseSync(':memory:');
 const db={prepare(q){let v=[];return {bind(...a){v=a;return this},async first(){return sql.prepare(q).get(...v)||null},async run(){return sql.prepare(q).run(...v)}}}};
 assert.equal(await s.readMarketSnapshot(db),null);
 const values={'TP.BIRIMFIYAT.TR':[['2026-Q2',40000]]};for(const p of m.MARKET_PROVINCES)values[m.priceSeries(p)]=[['2026-Q2',30000]];
 const snap=m.buildSnapshot(values);
 await s.writeMarketSnapshot(db,snap);await s.writeMarketSnapshot(db,snap);
 assert.equal(sql.prepare('SELECT count(*) n FROM market_stats').get().n,1);
 assert.equal((await s.readMarketSnapshot(db)).turkey.price[0][1],40000);
});
