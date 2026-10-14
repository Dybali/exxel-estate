import { bucket, currentUser, error, ok, sameOrigin } from "@/lib/server";
import { externalR2Ready, putExternalImage } from "@/lib/external-r2";

export async function POST(request:Request) {
  if(!sameOrigin(request)) return error("Geçersiz kaynak.",403);
  const user=await currentUser(request);
  if(!user || !["agent","individual","admin"].includes(user.role)) return error("Fotoğraf yüklemek için ilan veren hesabı gerekir.",403);
  if(!externalR2Ready()) return error("Fotoğraf deposu yapılandırılmamış.",503);
  let form:FormData;try{form=await request.formData();}catch{return error("Geçersiz dosya.");}
  const part=form.get("file");
  // The multipart File can come from a different runtime realm, so instanceof File is unreliable.
  if(!part || typeof part==="string" || typeof part.size!=="number" || typeof part.type!=="string" || typeof part.slice!=="function" || typeof part.stream!=="function") return error("Geçersiz dosya.");
  const file=part as File;
  if(file.size>8_000_000 || file.size===0 || !["image/jpeg","image/png","image/webp"].includes(file.type)) return error("JPG, PNG veya WEBP; en fazla 8 MB fotoğraf yükleyin.");
  const signature=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const isPng=file.type==="image/png" && [137,80,78,71,13,10,26,10].every((b,i)=>signature[i]===b);
  const isJpeg=file.type==="image/jpeg" && signature[0]===255 && signature[1]===216 && signature[2]===255;
  const isWebp=file.type==="image/webp" && String.fromCharCode(...signature.slice(0,4))==="RIFF" && String.fromCharCode(...signature.slice(8,12))==="WEBP";
  if(!isPng && !isJpeg && !isWebp) return error("Fotoğraf biçimi doğrulanamadı.");
  const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
  const key=`listings/${user.id}/${crypto.randomUUID()}.${ext}`;
  const bytes=new Uint8Array(await file.arrayBuffer());
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map((item)=>item.toString(16).padStart(2,"0")).join("");
  await putExternalImage(key,bytes,file.type,digest);
  return ok({url:`/api/media/${key}`},{status:201});
}
