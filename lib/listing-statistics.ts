export interface StatisticsDatabase {prepare(sql:string):{bind(...values:(string|number|null)[]):ReturnType<StatisticsDatabase["prepare"]>;run():Promise<unknown>;first<T>():Promise<T|null>;all<T>():Promise<{results:T[]}>}}
export const STATISTICS_SCHEMA=[`CREATE TABLE IF NOT EXISTS listing_view_daily (listing_id TEXT NOT NULL,day TEXT NOT NULL,visitor_hash TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(listing_id,day,visitor_hash))`,`CREATE INDEX IF NOT EXISTS favorites_listing_stats_idx ON favorites(listing_id)`];
export async function ensureStatistics(db:StatisticsDatabase){for(const sql of STATISTICS_SCHEMA)await db.prepare(sql).run();}
export async function recordListingView(db:StatisticsDatabase,listingId:string,actorId:string|null,visitorHash:string,at=new Date()){
 const day=at.toISOString().slice(0,10);
 const row=await db.prepare(`INSERT INTO listing_view_daily(listing_id,day,visitor_hash,created_at) SELECT CAST(id AS TEXT),?,?,? FROM listings WHERE CAST(id AS TEXT)=? AND status='published' AND CAST(owner_id AS TEXT)<>? ON CONFLICT(listing_id,day,visitor_hash) DO NOTHING RETURNING listing_id`).bind(day,visitorHash,at.toISOString(),listingId,actorId||'').first();return Boolean(row);
}
export async function ownerStatistics(db:StatisticsDatabase,ownerId:string){
 const rows=await db.prepare(`SELECT CAST(l.id AS TEXT) AS id,(SELECT count(*) FROM listing_view_daily v WHERE v.listing_id=CAST(l.id AS TEXT)) AS views,(SELECT count(*) FROM favorites f WHERE f.listing_id=CAST(l.id AS TEXT)) AS favorites,(SELECT count(*) FROM messages m WHERE m.listing_id=CAST(l.id AS TEXT) AND m.recipient_id=l.owner_id AND m.sender_id<>l.owner_id) AS messages FROM listings l WHERE l.owner_id=?`).bind(ownerId).all<{id:string;views:number;favorites:number;messages:number}>();return Object.fromEntries(rows.results.map(row=>[row.id,{views:Number(row.views),favorites:Number(row.favorites),messages:Number(row.messages)}]));
}
