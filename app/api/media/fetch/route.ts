import { body, currentUser, error, sameOrigin } from "@/lib/server";
import { safeImageUrl } from "@/lib/safe-image-url";

const MAX_BYTES = 25_000_000;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

function imageType(bytes: Uint8Array) {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

// Downloads a listing photo for the XML importer. The browser then resizes, watermarks
// and uploads it through POST /api/media like any other photo.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!user || !["agent", "individual", "admin"].includes(user.role)) return error("Fotoğraf aktarmak için ilan veren hesabı gerekir.", 403);
  let url: URL | null;
  try { url = safeImageUrl((await body(request)).url); } catch { return error("Geçersiz istek."); }
  if (!url) return error("Fotoğraf adresi https ile başlayan herkese açık bir adres olmalı.");
  let response: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    try {
      response = await fetch(url, { redirect: "manual", headers: { Accept: TYPES.join(",") }, signal: AbortSignal.timeout(15000) });
    } catch { return error("Fotoğraf indirilemedi.", 502); }
    if (response.status < 300 || response.status >= 400) break;
    const next = safeImageUrl(new URL(response.headers.get("location") || "", url).toString());
    await response.body?.cancel();
    if (!next || hop === 3) return error("Fotoğraf adresi güvenli olmayan bir yere yönlendiriyor.", 400);
    url = next;
  }
  if (!response?.ok || !response.body) return error("Fotoğraf indirilemedi.", 502);
  if (Number(response.headers.get("content-length") || 0) > MAX_BYTES) { await response.body.cancel(); return error("Fotoğraf 25 MB'tan büyük.", 413); }
  const reader = response.body.getReader(), parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); return error("Fotoğraf 25 MB'tan büyük.", 413); }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  const type = imageType(bytes);
  if (!type) return error("Adres JPG, PNG veya WEBP fotoğraf döndürmedi.", 415);
  return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
