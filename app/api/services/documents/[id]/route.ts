import { bucket, currentUser, error, isAdmin } from "@/lib/server";
import { documentRow } from "@/lib/service-extras";
import { servicesDB } from "@/lib/services-server";
import { ensureServices } from "@/lib/services";

// Opens a firm document: the firm owner or an administrator only, never cached or rendered inline.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser(request);
  if (!user?.email_verified) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  await ensureServices(servicesDB());
  const document = await documentRow(servicesDB(), (await params).id);
  if (!document || (document.ownerId !== user.id && !isAdmin(user))) return error("Belge bulunamadı.", 404);
  const file = await bucket()?.get(document.objectKey);
  if (!file) return error("Belge deposuna ulaşılamadı.", 503);
  const ext = document.contentType === "application/pdf" ? "pdf" : document.contentType === "image/png" ? "png" : "jpg";
  return new Response(file.body, { headers: {
    "Content-Type": document.contentType, "Content-Disposition": `attachment; filename="firma-belgesi-${document.kind}.${ext}"`, "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'", "Content-Length": String(file.size),
  } });
}
