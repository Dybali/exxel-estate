import { cleanSearch, searchSql } from "./search-filters";
type Value=string|number|null;
export interface DiscoveryDatabase {prepare(query:string):{bind(...values:Value[]):{all<T=Record<string,unknown>>():Promise<{results:T[]}>;first<T=Record<string,unknown>>():Promise<T|null>;run():Promise<unknown>}}}
type SavedRow={id:string;name:string;query:string;enabled:number;created_at:string;seen_at:string};
export class DiscoveryError extends Error {constructor(message:string,public status=400){super(message);}}
const uuid=(value:unknown)=>typeof value==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export async function discoveryFeed(db:DiscoveryDatabase,userId:string){
  const checkedAt=new Date().toISOString();
  const [saved,state]=await Promise.all([
    db.prepare("SELECT id,name,query,enabled,created_at,seen_at FROM saved_searches WHERE user_id=? ORDER BY created_at DESC LIMIT 10").bind(userId).all<SavedRow>(),
    db.prepare("SELECT price_seen_at,price_enabled FROM discovery_preferences WHERE user_id=?").bind(userId).first<{price_seen_at:string;price_enabled:number}>()
  ]);
  const searches=saved.results.map(item=>({...item,enabled:Boolean(item.enabled)}));
  const searchAlerts=await Promise.all(saved.results.filter(item=>item.enabled).map(async item=>{
    const filter=searchSql(item.query);
    const row=await db.prepare(`SELECT count(*) AS count,max(l.published_at) AS latest FROM listings l WHERE ${filter.where} AND l.published_at>? AND l.published_at<=?`).bind(...filter.values,item.seen_at,checkedAt).first<{count:number;latest:string}>();
    return Number(row?.count)?{id:`search:${item.id}`,kind:"search",name:item.name,count:Number(row!.count),createdAt:row!.latest,href:`/ilanlar?${item.query}`} : null;
  }));
  const drops=state?.price_enabled===0?{results:[]}:await db.prepare("SELECT h.id,h.listing_id,h.old_price,h.new_price,h.currency,h.changed_at,l.title FROM price_history h JOIN listings l ON l.id=h.listing_id JOIN favorites f ON f.listing_id=CAST(l.id AS TEXT) WHERE f.user_id=? AND l.status='published' AND h.currency=l.currency AND h.purpose=l.purpose AND h.new_price<h.old_price AND h.changed_at>f.created_at AND h.changed_at>? AND h.changed_at<=? ORDER BY h.changed_at DESC LIMIT 50").bind(userId,state?.price_seen_at||"",checkedAt).all<Record<string,unknown>>();
  const alerts=[...searchAlerts.filter(Boolean),...drops.results.map(row=>({id:`price:${row.id}`,kind:"price",name:row.title,oldPrice:Number(row.old_price),newPrice:Number(row.new_price),currency:row.currency,createdAt:row.changed_at,href:`/ilan/${row.listing_id}`}))].sort((a,b)=>String(b!.createdAt).localeCompare(String(a!.createdAt)));
  return {searches,alerts,unread:alerts.length,checkedAt,priceEnabled:state?.price_enabled!==0};
}
export async function mutateDiscovery(db:DiscoveryDatabase,userId:string,data:Record<string,unknown>){
  const time=new Date().toISOString();
  if(data.action==="save"){
    const name=typeof data.name==="string"?data.name.trim().slice(0,70):"";
    if(!name||typeof data.query!=="string"||data.query.length>3000)throw new DiscoveryError("Arama adını ve filtreleri kontrol edin.");
    const query=cleanSearch(data.query),id=crypto.randomUUID();
    const existing=await db.prepare("SELECT id FROM saved_searches WHERE user_id=? AND query=?").bind(userId,query).first<{id:string}>();
    if(existing){await db.prepare("UPDATE saved_searches SET name=? WHERE id=? AND user_id=?").bind(name,existing.id,userId).run();return {success:true};}
    // Bound saved searches per account and deduplicate identical filters.
    await db.prepare("INSERT INTO saved_searches(id,user_id,name,query,enabled,created_at,seen_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM saved_searches WHERE user_id=?)<10 ON CONFLICT(user_id,query) DO UPDATE SET name=excluded.name,enabled=excluded.enabled").bind(id,userId,name,query,1,time,time,userId).run();
    const saved=await db.prepare("SELECT id FROM saved_searches WHERE user_id=? AND query=?").bind(userId,query).first();
    if(!saved)throw new DiscoveryError("En fazla 10 arama kaydedebilirsiniz.",409);
  }else if(data.action==="delete"||data.action==="toggle"){
    if(!uuid(data.id))throw new DiscoveryError("Geçersiz arama.");
    const existing=await db.prepare("SELECT id FROM saved_searches WHERE id=? AND user_id=?").bind(String(data.id),userId).first();
    if(!existing)throw new DiscoveryError("Arama bulunamadı.",404);
    if(data.action==="delete")await db.prepare("DELETE FROM saved_searches WHERE id=? AND user_id=?").bind(String(data.id),userId).run();
    else {if(typeof data.enabled!=="boolean")throw new DiscoveryError("Bildirim tercihi geçersiz.");await db.prepare("UPDATE saved_searches SET enabled=?,seen_at=? WHERE id=? AND user_id=?").bind(data.enabled?1:0,time,String(data.id),userId).run();}
  }else if(data.action==="read"||data.action==="price_preference"){
    if(data.action==="price_preference"&&typeof data.enabled!=="boolean")throw new DiscoveryError("Bildirim tercihi geçersiz.");
    // Only acknowledge events the client actually fetched; never swallow a later event.
    const checked=typeof data.checkedAt==="string"&&/^\d{4}-\d\d-\d\dT/.test(data.checkedAt)&&Number.isFinite(Date.parse(data.checkedAt))?new Date(Math.min(Date.parse(data.checkedAt),Date.now())).toISOString():null;
    if(data.action==="read"&&!checked)throw new DiscoveryError("Bildirim zamanı geçersiz.");
    if(data.action==="read"){
      await db.prepare("UPDATE saved_searches SET seen_at=CASE WHEN seen_at<? THEN ? ELSE seen_at END WHERE user_id=?").bind(checked,checked,userId).run();
      await db.prepare("INSERT INTO discovery_preferences(user_id,price_seen_at,price_enabled) VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET price_seen_at=CASE WHEN discovery_preferences.price_seen_at<excluded.price_seen_at THEN excluded.price_seen_at ELSE discovery_preferences.price_seen_at END").bind(userId,checked).run();
    }else await db.prepare("INSERT INTO discovery_preferences(user_id,price_seen_at,price_enabled) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET price_enabled=excluded.price_enabled,price_seen_at=excluded.price_seen_at").bind(userId,time,data.enabled?1:0).run();
  }else throw new DiscoveryError("Geçersiz işlem.");
  return {success:true};
}
