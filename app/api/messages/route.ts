import { body, currentUser, db, error, isAdmin, listingById, now, ok, sameOrigin, str } from "@/lib/server";

export async function GET(request:Request) {
  const user=await currentUser(request);if(!user)return error("Giriş gerekli.",401);
  const query=isAdmin(user)?"SELECT m.*,u.name AS sender_name FROM messages m JOIN users u ON u.id=m.sender_id ORDER BY m.created_at DESC LIMIT 100":"SELECT m.*,u.name AS sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.sender_id=? OR m.recipient_id=? ORDER BY m.created_at DESC LIMIT 100";
  const statement=db().prepare(query);const rows=await (isAdmin(user)?statement:statement.bind(user.id,user.id)).all();
  return ok({messages:rows.results||[]});
}
export async function POST(request:Request) {
  if(!sameOrigin(request))return error("Geçersiz kaynak.",403);
  const user=await currentUser(request);if(!user)return error("İlan sahibine yazmak için giriş yapın.",401);
  let data;try{data=await body(request);}catch{return error("Geçersiz istek.");}
  const listingId=str(data.listingId,80),message=str(data.message,2000),listing=await listingById(listingId);
  if(!listing||(listing.source==="user"&&listing.status!=="published"))return error("İlan bulunamadı.",404);
  if(message.length<10)return error("Mesaj en az 10 karakter olmalı.");
  if(listing.ownerId===user.id)return error("Kendi ilanınıza mesaj gönderemezsiniz.");
  await db().prepare("INSERT INTO messages(id,listing_id,sender_id,recipient_id,body,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),listingId,user.id,listing.source==="demo"?null:listing.ownerId||null,message,now()).run();
  return ok({success:true},{status:201});
}
