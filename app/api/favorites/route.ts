import { body, currentUser, db, error, listingById, now, ok, sameOrigin, str } from "@/lib/server";

export async function GET(request:Request) {
  const user=await currentUser(request);
  if(!user) return error("Giriş gerekli.",401);
  const rows=await db().prepare("SELECT listing_id FROM favorites WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all<{listing_id:string}>();
  return ok({ids:(rows.results||[]).map((row)=>row.listing_id)});
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
