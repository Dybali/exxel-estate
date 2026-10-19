import { bucket, currentUser, db, isAdmin } from "@/lib/server";
import { getExternalImage } from "@/lib/external-r2";
export async function GET(request:Request,{params}:{params:Promise<{key:string[]}>}) {
  const key=(await params).key.join("/");
  if(!/^listings\/[a-f0-9-]+\/[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) return new Response(null,{status:404});
  const row=await db().prepare("SELECT l.status,l.owner_id FROM property_images p JOIN listings l ON l.id=p.property_id WHERE p.object_key=?").bind(key).first<{status:string;owner_id:string}>();
  const profile=await db().prepare('SELECT id FROM users WHERE avatar_url=?').bind('/api/media/'+key).first();
  const isPublic=row?.status==="published"||Boolean(profile);
  if(!isPublic) {
    const user=await currentUser(request);
    const uploaderId=key.split("/")[1];
    if(!user || (!isAdmin(user) && user.id!==(row?.owner_id || uploaderId))) return new Response(null,{status:404});
  }
  const cacheControl=isPublic?"public,max-age=31536000,immutable":"private,no-store";
  const external=await getExternalImage(key);
  if(external?.body) return new Response(external.body,{headers:{"Content-Type":external.contentType,"Cache-Control":cacheControl}});
  const legacy=await bucket()?.get(key);
  if(!legacy) return new Response(null,{status:404});
  return new Response(legacy.body,{headers:{"Content-Type":legacy.httpMetadata?.contentType||"image/jpeg","Cache-Control":cacheControl}});
}
