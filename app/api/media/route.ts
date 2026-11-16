import { bucket, currentUser, db, error, ok, sameOrigin, sha256 } from "@/lib/server";
import { stripImageMetadata } from "@/lib/image-metadata";
import { consumeRateLimit, RecoveryError } from "@/lib/recovery-service";
import { externalR2Ready, putExternalImage } from "@/lib/external-r2";
import {panoramaDimensions} from '@/lib/panoramas';
import {validPhotoHash} from '@/lib/listing-risk';
import {PHOTO_VARIANT_WIDTHS,validPhotoVariant,variantUploadKey} from '@/lib/listing-media';

const sha256Hex=async(bytes:Uint8Array<ArrayBuffer>)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map((item)=>item.toString(16).padStart(2,"0")).join("");
// The multipart File can come from a different runtime realm, so instanceof File is unreliable.
const filePart=(part:FormDataEntryValue|null)=>part && typeof part!=="string" && typeof part.size==="number" && typeof part.type==="string" && typeof part.slice==="function" && typeof part.stream==="function"?part as File:null;

export async function POST(request:Request) {
  if(!sameOrigin(request)) return error("Geçersiz kaynak.",403);
  const user=await currentUser(request);
  // Profile photos, service firm and contractor photos (Hesabım → Hizmet / Müteahhit firmam) may come from any verified member.
  const purpose=new URL(request.url).searchParams.get("purpose");
  if(!user || purpose!=="profile"&&purpose!=="service"&&purpose!=="contractor"&&!["agent","individual","admin"].includes(user.role)) return error("Fotoğraf yüklemek için ilan veren hesabı gerekir.",403);
  if(!externalR2Ready()) return error("Fotoğraf deposu yapılandırılmamış.",503);
  // Storage cost: any verified member may upload profile, firm and contractor photos, so cap uploads per
  // member (profile photos 10, everything together 200 per 15 minutes).
  try{
    if(purpose==="profile")await consumeRateLimit(db(),await sha256(`upload-profile:${user.id}`),10,15*60_000);
    await consumeRateLimit(db(),await sha256(`upload:${user.id}`),200,15*60_000);
  }catch(cause){if(cause instanceof RecoveryError)return error(cause.message,cause.status);throw cause;}
  let form:FormData;try{form=await request.formData();}catch{return error("Geçersiz dosya.");}
  const file=filePart(form.get("file"));
  if(!file) return error("Geçersiz dosya.");
  if(file.size>8_000_000 || file.size===0 || !["image/jpeg","image/png","image/webp"].includes(file.type)) return error("JPG, PNG veya WEBP; en fazla 8 MB fotoğraf yükleyin.");
  const signature=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const isPng=file.type==="image/png" && [137,80,78,71,13,10,26,10].every((b,i)=>signature[i]===b);
  const isJpeg=file.type==="image/jpeg" && signature[0]===255 && signature[1]===216 && signature[2]===255;
  const isWebp=file.type==="image/webp" && String.fromCharCode(...signature.slice(0,4))==="RIFF" && String.fromCharCode(...signature.slice(8,12))==="WEBP";
  if(!isPng && !isJpeg && !isWebp) return error("Fotoğraf biçimi doğrulanamadı.");
  const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
  const key=`listings/${user.id}/${crypto.randomUUID()}.${ext}`;
  const original=new Uint8Array(await file.arrayBuffer());
  if(purpose==='panorama'){try{if(file.type!=='image/jpeg')throw Error('360° fotoğraf JPG biçiminde olmalıdır.');panoramaDimensions(original);}catch(cause){return error((cause as Error).message);}}
  // GPS and other personal metadata never reach storage, even when the browser re-encode was skipped.
  const bytes=stripImageMetadata(original,file.type,{keepXmp:purpose==='panorama'});
  const digest=await sha256Hex(bytes);
  // Listing photos carry a dHash computed in the browser (Workers cannot decode WebP/JPEG; docs/listing-risk.md).
  // It is advisory only: a malformed value is dropped, never an error.
  const photoHash=form.get("photoHash"),hash=typeof photoHash==="string"&&validPhotoHash(photoHash.trim().toLowerCase())?photoHash.trim().toLowerCase():null;
  // Smaller WebP copies made by the browser (fields variant640, variant1280; lib/listing-media.ts) for cards
  // and galleries. They come in this same request, so a photo and its copies count once against the limit
  // above, and they are stored only next to the key generated here, never at a key the client names. They are
  // checked like the main photo (signature, size, metadata) plus their pixel size; any bad copy refuses the upload.
  const variants:{key:string;bytes:Uint8Array<ArrayBuffer>}[]=[];
  if(purpose!=='panorama'&&purpose!=='profile') for(const width of PHOTO_VARIANT_WIDTHS){
    const entry=form.get(`variant${width}`);if(entry===null)continue;
    const part=filePart(entry),target=variantUploadKey(key,user.id,width);
    if(!part||!target) return error("Geçersiz dosya.");
    const raw=new Uint8Array(await part.arrayBuffer());
    if(!validPhotoVariant(raw,part.type,width)) return error("Fotoğraf biçimi doğrulanamadı.");
    variants.push({key:target,bytes:stripImageMetadata(raw,"image/webp")});
  }
  await putExternalImage(key,bytes,file.type,digest,purpose?null:hash);
  // Best effort: without a copy the media route serves the main photo instead.
  await Promise.allSettled(variants.map(async(variant)=>putExternalImage(variant.key,variant.bytes,"image/webp",await sha256Hex(variant.bytes))));
  return ok({url:`/api/media/${key}`},{status:201});
}
