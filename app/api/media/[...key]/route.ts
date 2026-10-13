import { bucket } from "@/lib/server";
export async function GET(_request:Request,{params}:{params:Promise<{key:string[]}>}) {
  const key=(await params).key.join("/");
  if(!/^listings\/[a-f0-9-]+\/[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) return new Response(null,{status:404});
  const file=await bucket()?.get(key);
  if(!file) return new Response(null,{status:404});
  return new Response(file.body,{headers:{"Content-Type":file.httpMetadata?.contentType||"image/jpeg","Cache-Control":"public,max-age=31536000,immutable"}});
}
