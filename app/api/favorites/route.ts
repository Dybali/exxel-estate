import { PUBLIC_DEMO_LISTINGS,publicListing } from "@/lib/listings";
import { body, currentUser, db, error, listingById, now, ok, parseListing, sameOrigin, str } from "@/lib/server";

export async function GET(request:Request) {
  const user=await currentUser(request);
  if(!user) return error("Giriş gerekli.",401);
  const rows=await db().prepare("SELECT listing_id FROM favorites WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(user.id).all<{listing_id:string}>();
  const ids=(rows.results||[]).map((row)=>row.listing_id);
  const demo=new Map(PUBLIC_DEMO_LISTINGS.map((listing)=>[listing.id,listing]));
  const realIds=ids.filter((id)=>!demo.has(id)&&/^[a-f0-9-]{36}$/i.test(id));
  const real=new Map<string,ReturnType<typeof parseListing>>();
  if(realIds.length){const marks=realIds.map(()=>"?").join(",");const results=await db().prepare(`SELECT l.*,u.name AS owner_name FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.status='published' AND l.id IN (${marks})`).bind(...realIds).all<Record<string,unknown>>();for(const row of results.results||[])real.set(String(row.id),publicListing(parseListing(row)));}
  const listings=ids.map((id)=>demo.get(id)||real.get(id)).filter((item)=>Boolean(item));
  return ok({ids,listings},{headers:{"Cache-Control":"private, no-store"}});
}
export async function POST(request:Request) {
  if(!sameOrigin(request)) return error("Geçersiz kaynak.",403);
  const user=await currentUser(request);if(!user)return error("Favorilere eklemek için giriş yapın.",401);
  let data;try{data=await body(request);}catch{return error("Geçersiz istek.");}
  const id=str(data.id,80),listing=await listingById(id);
  if(!listing || (listing.source==="user"&&listing.status!=="published")) return error("İlan bulunamadı.",404);
  await db().prepare("INSERT OR IGNORE INTO favorites(user_id,listing_id,created_at) VALUES(?,?,?)").bind(user.id,id,now()).run();
  return ok({success:true});
}
export async function DELETE(request:Request) {
  if(!sameOrigin(request))return error("Geçersiz kaynak.",403);
  const user=await currentUser(request);if(!user)return error("Giriş gerekli.",401);
  const id=new URL(request.url).searchParams.get("id")||"";
  await db().prepare("DELETE FROM favorites WHERE user_id=? AND listing_id=?").bind(user.id,id).run();
  return ok({success:true});
}
