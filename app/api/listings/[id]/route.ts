import { currentUser, db, error, isAdmin, listingById, ok, sameOrigin } from "@/lib/server";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params,listing=await listingById(id);
  if(!listing) return error("İlan bulunamadı.",404);
  if(listing.source==="user" && listing.status!=="published") {
    const user=await currentUser(request);
    if(!user || (user.id!==listing.ownerId&&!isAdmin(user))) return error("İlan bulunamadı.",404);
  }
  return ok({listing});
}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}) {
  if(!sameOrigin(request)) return error("Geçersiz kaynak.",403);
  const user=await currentUser(request),{id}=await params;
  if(!user) return error("Giriş gerekli.",401);
  const row=await db().prepare("SELECT owner_id FROM listings WHERE id=?").bind(id).first<{owner_id:string}>();
  if(!row) return error("İlan bulunamadı.",404);
  if(row.owner_id!==user.id&&!isAdmin(user)) return error("Yetkiniz yok.",403);
  await db().prepare("DELETE FROM listings WHERE id=?").bind(id).run();
  return ok({success:true});
}
