import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {importTs} from './ts-module.mjs';
const {priceHistory,PRICE_DROP_SQL,PRICE_HISTORY_SQL}=await importTs('lib/price-history.ts');
const {pendingMigrations}=await importTs('lib/postgres-migrations.ts');
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const PG='020_listing_prices_try.sql',pgSql=read('postgres/migrations/'+PG),sqliteSql=read('drizzle/0027_listing_prices_try.sql');
// TCMB bulletin 2026/208 of 05.11.2026: ForexSelling and Unit as published.
const BULLETIN={USD:[50.0489,1],AUD:[35.1938,1],DKK:[7.5372,1],EUR:[56.2524,1],GBP:[67.5420,1],CHF:[61.4571,1],SEK:[5.1550,1],CAD:[35.9165,1],KWD:[163.4851,1],NOK:[5.4055,1],SAR:[13.3339,1],JPY:[31.7043,100],RON:[10.5908,1],RUB:[0.61518,1],CNY:[7.5465,1],PKR:[0.18197,1],QAR:[13.8069,1],KRW:[0.03751,1],AZN:[29.6052,1],AED:[13.7035,1],KZT:[0.11146,1]};
const ratesIn=sql=>[...sql.matchAll(/WITH rates\(code, ?forex_selling, ?unit\) AS \(VALUES([\s\S]*?\))\s*\)/g)].map(match=>Object.fromEntries([...match[1].matchAll(/\('([A-Z]{3})', ?([\d.]+)(?:::numeric)?, ?(\d+)\)/g)].map(([,code,selling,unit])=>[code,[Number(selling),Number(unit)]])));

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT);
 CREATE TABLE listings(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,purpose TEXT NOT NULL,price INTEGER NOT NULL,currency TEXT DEFAULT 'TRY' NOT NULL,status TEXT NOT NULL,expires_at TEXT,published_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE price_history(id TEXT PRIMARY KEY NOT NULL,listing_id TEXT NOT NULL,old_price INTEGER NOT NULL,new_price INTEGER NOT NULL,currency TEXT NOT NULL,purpose TEXT NOT NULL,changed_at TEXT NOT NULL,FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE CASCADE);
 CREATE TRIGGER listing_expiry_guard BEFORE UPDATE ON listings
  WHEN (OLD.expires_at IS NOT NULL AND NEW.expires_at IS NOT OLD.expires_at)
   OR (NEW.status='published' AND NEW.expires_at IS NOT NULL AND NEW.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  BEGIN SELECT RAISE(ABORT,'individual_listing_expired'); END;`);
 const add=db.prepare('INSERT INTO listings VALUES(?,?,?,?,?,?,?,?,?,?)');
 const future=new Date(Date.now()+5*864e5).toISOString(),past=new Date(Date.now()-864e5).toISOString(),old='2026-10-01T00:00:00.000Z';
 for(const [id,price,currency,status,expires,purpose='satilik'] of [
  ['tl',6450000,'TRY','published',null],['eur',100000,'EUR','published',future],['usd',120000,'USD','pending',null],['gbp',90000,'GBP','withdrawn',null,'kiralik'],
  ['jpy',10000000,'JPY','published',null],['unknown',5000,'XYZ','published',null],['expired',80000,'EUR','published',past],
 ])add.run(id,'owner',purpose,price,currency,status,expires,old,old,old);
 db.prepare('INSERT INTO price_history VALUES(?,?,?,?,?,?,?)').run('h0','eur',110000,100000,'EUR','satilik','2026-10-10T00:00:00.000Z');
 return db;
}
const run=(db,sql)=>{for(const statement of sql.split('--> statement-breakpoint'))db.exec(statement);};
const row=(db,id)=>db.prepare('SELECT price,currency,updated_at,expires_at,status FROM listings WHERE id=?').get(id);

test('the PostgreSQL migration and its SQLite mirror use exactly the TCMB bulletin rates (ForexSelling / Unit)',()=>{
 const pg=ratesIn(pgSql),lite=ratesIn(sqliteSql);
 assert.equal(pg.length,1);assert.equal(lite.length,3);
 for(const table of [...pg,...lite])assert.deepEqual(table,BULLETIN);
 assert.match(pgSql,/bulletin 2026\/208 dated 05\.11\.2026/);assert.match(sqliteSql,/2026\/208 dated 05\.11\.2026/);
 assert.match(pgSql,/l\.currency <> 'TRY'/);assert.match(pgSql,/DISABLE TRIGGER individual_listing_policy[\s\S]*ENABLE TRIGGER individual_listing_policy;\s*$/);
 assert.doesNotMatch(pgSql+sqliteSql,/\r/,'LF line endings (.gitattributes)');
 const journal=JSON.parse(read('drizzle/meta/_journal.json'));assert.equal(journal.entries.at(-1).tag,'0027_listing_prices_try');
});

test('SQLite: legacy prices become TL at the bulletin rate with two price_history rows each; TRY, unknown and expired rows stay',()=>{
 const db=fixture();run(db,sqliteSql);
 assert.equal(row(db,'eur').price,5625240,'100 000 € × 56.2524');
 assert.equal(row(db,'usd').price,6005868);assert.equal(row(db,'gbp').price,6078780);assert.equal(row(db,'jpy').price,3170430,'Unit 100');
 for(const id of ['eur','usd','gbp','jpy']){assert.equal(row(db,id).currency,'TRY');assert.notEqual(row(db,id).updated_at,'2026-10-01T00:00:00.000Z');}
 assert.deepEqual({price:row(db,'tl').price,currency:row(db,'tl').currency,updated:row(db,'tl').updated_at},{price:6450000,currency:'TRY',updated:'2026-10-01T00:00:00.000Z'});
 assert.equal(row(db,'unknown').currency,'XYZ','no rate: unchanged');
 assert.deepEqual({price:row(db,'expired').price,currency:row(db,'expired').currency},{price:80000,currency:'EUR'},'expired published row is left for the app to convert on display');
 assert.equal(row(db,'eur').status,'published');assert.ok(row(db,'eur').expires_at,'publication untouched');
 const history=db.prepare("SELECT listing_id,old_price,new_price,currency,purpose,changed_at,id FROM price_history WHERE id<>'h0' ORDER BY listing_id,changed_at").all();
 assert.equal(history.length,8);
 const eur=history.filter(h=>h.listing_id==='eur');
 assert.deepEqual(eur.map(h=>[h.old_price,h.new_price,h.currency,h.purpose]),[[100000,100000,'EUR','satilik'],[5625240,5625240,'TRY','satilik']]);
 assert.ok(eur[0].changed_at<eur[1].changed_at);for(const h of history){assert.match(h.changed_at,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);assert.match(h.id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);}
 assert.equal(history.find(h=>h.listing_id==='gbp'&&h.currency==='TRY').purpose,'kiralik');
 // The listing page shows a currency change, no percentage and no price drop across currencies.
 const rows=db.prepare(PRICE_HISTORY_SQL).all('eur'),current={price:5625240,currency:'TRY',purpose:'satilik'};
 const view=priceHistory(rows,current);assert.equal(view.changes[0].kind,'currency');assert.equal(view.changes[0].change,null);assert.equal(view.drop,null);assert.deepEqual(view.points,[]);
 assert.equal(db.prepare(`SELECT ${PRICE_DROP_SQL} FROM listings l WHERE l.id='eur'`).get().price_drop,null);
});

test('SQLite: a second run changes nothing (idempotent)',()=>{
 const db=fixture();run(db,sqliteSql);
 const before=JSON.stringify([db.prepare('SELECT * FROM listings ORDER BY id').all(),db.prepare('SELECT count(*) AS n FROM price_history').get()]);
 run(db,sqliteSql);
 assert.equal(JSON.stringify([db.prepare('SELECT * FROM listings ORDER BY id').all(),db.prepare('SELECT count(*) AS n FROM price_history').get()]),before);
});

test('Mittwald runner: 020 runs once where schema_migrations lacks it, including on data copied from Neon without it',()=>{
 const files=['017_lead_notes.sql','018_individual_listing_45_days.sql','019_listing_videos.sql',PG];
 assert.deepEqual(pendingMigrations(files,['018_individual_listing_45_days.sql','019_listing_videos.sql']),[PG]);
 assert.deepEqual(pendingMigrations(files,['018_individual_listing_45_days.sql','019_listing_videos.sql',PG]),[]);
 // A later Neon → Mittwald copy brings Neon's schema_migrations (without 020): 020 runs again on that data.
 assert.deepEqual(pendingMigrations(files,['017_lead_notes.sql']),['018_individual_listing_45_days.sql','019_listing_videos.sql',PG]);
});
