import { bucket, currentUser, db, isAdmin } from "@/lib/server";
import { getExternalImage } from "@/lib/external-r2";
import { projectMediaPublic } from "@/lib/projects";
import { projectsDB } from "@/lib/projects-server";
import { serviceMediaPublic } from "@/lib/services";
import { servicesDB } from "@/lib/services-server";
import { VIDEO_MEDIA_KEY } from "@/lib/listing-video";
import { videoMediaAccess, type VideoDatabase } from "@/lib/listing-video-store";
import { videoFeatureEnabled, videoStorageFromEnv } from "@/lib/listing-video-server";

// Single byte range ("bytes=0-1", "bytes=100-", "bytes=-500"); anything else is ignored and the
// whole file is sent, as HTTP allows.
const SINGLE_RANGE = /^bytes=(\d+-\d*|-\d+)$/;
const PASSED = ["content-type", "content-length", "content-range", "etag", "last-modified"];

// Listing video MP4 and poster (videos/<id>/video.mp4|poster.jpg, docs/listing-videos.md): public
// once the video belongs to a published listing, otherwise only for its owner and admins. Range
// requests are passed to R2 and answered with 206, which iPhone Safari needs to play and seek.
async function videoMedia(request: Request, key: string, id: string) {
  const storage = videoStorageFromEnv();
  if (!videoFeatureEnabled() || !storage) return new Response(null, { status: 404 });
  const access = await videoMediaAccess(db() as unknown as VideoDatabase, id);
  if (!access || access.status !== "ready") return new Response(null, { status: 404 });
  const isPublic = access.listing_status === "published";
  if (!isPublic) {
    const user = await currentUser(request);
    if (!user || (!isAdmin(user) && user.id !== String(access.owner_id))) return new Response(null, { status: 404 });
  }
  const range = request.headers.get("range")?.replace(/\s+/g, "");
  const upstream = await storage.getMedia(key, range && SINGLE_RANGE.test(range) ? range : null);
  if (upstream.status === 404) { await upstream.body?.cancel().catch(() => {}); return new Response(null, { status: 404 }); }
  if (upstream.status !== 200 && upstream.status !== 206 && upstream.status !== 416) { await upstream.body?.cancel().catch(() => {}); return new Response(null, { status: 502 }); }
  const headers = new Headers({ "Accept-Ranges": "bytes", "Cache-Control": isPublic ? "public,max-age=31536000,immutable" : "private,no-store", "X-Content-Type-Options": "nosniff" });
  for (const name of PASSED) { const value = upstream.headers.get(name); if (value) headers.set(name, value); }
  if (upstream.status === 416) { await upstream.body?.cancel().catch(() => {}); headers.delete("content-length"); return new Response(null, { status: 416, headers }); }
  return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
}

export async function GET(request:Request,{params}:{params:Promise<{key:string[]}>}) {
  const key=(await params).key.join("/");
  const video=key.match(VIDEO_MEDIA_KEY);
  if(video) return videoMedia(request,key,video[1]);
  if(!/^listings\/[a-f0-9-]+\/[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) return new Response(null,{status:404});
  const row=await db().prepare("SELECT l.status,l.owner_id FROM property_images p JOIN listings l ON l.id=p.property_id WHERE p.object_key=?").bind(key).first<{status:string;owner_id:string}>();
  const profile=row?null:await db().prepare('SELECT id FROM users WHERE avatar_url=?').bind('/api/media/'+key).first();
  // Photos of approved projects (lib/projects.ts) are public as well.
  const project=row||profile?false:await projectMediaPublic(projectsDB(),key).catch(()=>false);
  // Logo, cover and work photos of approved service firms (lib/services.ts) as well.
  const service=row||profile||project?false:await serviceMediaPublic(servicesDB(),key).catch(()=>false);
  const isPublic=row?.status==="published"||Boolean(profile)||project||service;
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
