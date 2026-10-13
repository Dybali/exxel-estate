import { bucket, currentUser, error, ok, sameOrigin } from "@/lib/server";

export async function POST(request:Request) {
  if(!sameOrigin(request)) return error("Geçersiz kaynak.",403);
  const user=await currentUser(request);
  if(!user || !["agent","individual","admin"].includes(user.role)) return error("Fotoğraf yüklemek için ilan veren hesabı gerekir.",403);
  const storage=bucket(); if(!storage) return error("Dosya depolama kullanılamıyor.",503);
  let form:FormData;try{form=await request.formData();}catch{return error("Geçersiz dosya.");}
  const file=form.get("file");
  if(!(file instanceof File) || file.size>8_000_000 || file.size===0 || !["image/jpeg","image/png","image/webp"].includes(file.type)) return error("JPG, PNG veya WEBP; en fazla 8 MB fotoğraf yükleyin.");
  const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
  const key=`listings/${user.id}/${crypto.randomUUID()}.${ext}`;
  await storage.put(key,file.stream(),{httpMetadata:{contentType:file.type}});
  return ok({url:`/api/media/${key}`},{status:201});
}
