import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpile(readFileSync(new URL('../lib/account-deletion.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const A=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
function fixture(){
  const sql=new DatabaseSync(':memory:');
  sql.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE,password_hash TEXT,email_verified INTEGER,name TEXT,phone TEXT,whatsapp_enabled INTEGER,role TEXT,agent_status TEXT,company TEXT,avatar_url TEXT,created_at TEXT);
  CREATE TABLE sessions(token_hash TEXT,user_id TEXT,expires_at TEXT);CREATE TABLE listings(id TEXT,owner_id TEXT,title TEXT,description TEXT,purpose TEXT,property_type TEXT,price INTEGER,currency TEXT,city TEXT,district TEXT,neighborhood TEXT,gross_area INTEGER,net_area INTEGER,rooms TEXT,bedrooms INTEGER,bathrooms INTEGER,building_age INTEGER,floor INTEGER,total_floors INTEGER,heating TEXT,furnished INTEGER,amenities TEXT,images TEXT,presentation TEXT,status TEXT,created_at TEXT,updated_at TEXT);
  CREATE TABLE favorites(user_id TEXT,listing_id TEXT,created_at TEXT);CREATE TABLE saved_searches(user_id TEXT,name TEXT,query TEXT,enabled INTEGER,created_at TEXT);
  CREATE TABLE messages(id TEXT,listing_id TEXT,sender_id TEXT,recipient_id TEXT,body TEXT,created_at TEXT);CREATE TABLE agencies(id TEXT,owner_id TEXT);CREATE TABLE oauth_accounts(provider TEXT,provider_user_id TEXT,user_id TEXT);
  INSERT INTO users VALUES('u1','ayse@example.com','hash',1,'Ayşe','+905551112233',1,'individual','none',NULL,'/api/media/listings/u1/a.webp','2026-11-01'),('u2','can@example.com','hash',1,'Can',NULL,0,'buyer','none',NULL,NULL,'2026-11-01'),('u3','ofis@example.com','hash',1,'Ofis',NULL,0,'agent','approved','Ofis Emlak',NULL,'2026-11-01');
  INSERT INTO sessions VALUES('t1','u1','2099'),('t2','u2','2099');INSERT INTO listings(id,owner_id,title,images,presentation,status) VALUES('l1','u1','Ev','["/api/media/listings/u1/p.webp"]','{}','published'),('l2','u2','Başka','[]','{}','published');
  INSERT INTO favorites VALUES('u1','l2','x');INSERT INTO saved_searches VALUES('u1','İzmir','city=İzmir',1,'x');INSERT INTO messages VALUES('m1','l2','u1','u2','Merhaba','x');INSERT INTO agencies VALUES('a1','u3');INSERT INTO oauth_accounts VALUES('google','g1','u1');`);
  const db={prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}};
  return {sql,db};
}
test('deleting an account removes listings, preferences and sessions and anonymises the member',async()=>{
  const {sql,db}=fixture(),removed=[],avatars=[];
  const result=await A.deleteAccount(db,{id:'u1',role:'individual',email:'ayse@example.com'},async l=>{removed.push(l.id);sql.prepare('DELETE FROM listings WHERE id=?').run(l.id);},async url=>{avatars.push(url);},'unusable');
  assert.deepEqual(result,{listings:1});assert.deepEqual(removed,['l1']);assert.deepEqual(avatars,['/api/media/listings/u1/a.webp']);
  const user=sql.prepare("SELECT * FROM users WHERE id='u1'").get();
  assert.equal(user.email,'deleted+u1@deleted.invalid');assert.equal(user.name,'Silinmiş hesap');assert.equal(user.phone,null);assert.equal(user.avatar_url,null);assert.equal(user.password_hash,'unusable');assert.equal(user.email_verified,0);
  for(const table of ['sessions','favorites','saved_searches','oauth_accounts'])assert.equal(sql.prepare(`SELECT count(*) AS n FROM ${table} WHERE user_id='u1'`).get().n,0,table);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM sessions").get().n,1,'other members keep their sessions');
  assert.equal(sql.prepare("SELECT count(*) AS n FROM messages WHERE sender_id='u1'").get().n,1,'the other side keeps the conversation');
  assert.equal(sql.prepare("SELECT count(*) AS n FROM listings WHERE id='l2'").get().n,1);
});
test('company owners and administrators are not deleted here',async()=>{
  const {db}=fixture();
  await assert.rejects(A.deleteAccount(db,{id:'u3',role:'agent',email:'ofis@example.com'},async()=>{},async()=>{},'x'),e=>e instanceof A.AccountDeletionError&&e.status===409&&/iletişim/.test(e.message));
  assert.equal(await A.deletionBlocker(db,{id:'u9',role:'admin'}),'Yönetici hesapları buradan silinemez.');
  assert.equal(await A.deletionBlocker(db,{id:'u2',role:'buyer'}),null);
});
test('data export contains the member’s own data and never the password hash',async()=>{
  const {db}=fixture(),data=await A.exportAccount(db,'u1',new Date('2026-11-15T10:00:00Z'));
  assert.equal(data.profile.email,'ayse@example.com');assert.equal('password_hash' in data.profile,false);
  assert.equal(data.listings.length,1);assert.equal(data.favorites.length,1);assert.equal(data.savedSearches.length,1);assert.equal(data.messagesSent[0].body,'Merhaba');
  assert.deepEqual(data.appointments,[],'missing tables give empty lists');
});
