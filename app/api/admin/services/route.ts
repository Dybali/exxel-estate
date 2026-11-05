import { body, currentUser, db, error, isAdmin, ok, sameOrigin } from "@/lib/server";
import { reportsDB } from "@/lib/reports-server";
import { adminFirms, reviewFirm, ServiceError } from "@/lib/services";
import { servicesDB } from "@/lib/services-server";

const headers = { headers: { "Cache-Control": "private, no-store" } };

// Service firms by status (default: waiting for review) with per-status totals.
export async function GET(request: Request) {
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  return ok(await adminFirms(servicesDB(), new URL(request.url).searchParams.get("status")), headers);
}

// approve | reject | suspend (with a note the owner reads) | verify | unverify | feature | unfeature.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  try {
    const result = await reviewFirm(servicesDB(), admin.id, data.id, data.action, data.note);
    try {
      await reportsDB();
      const note = typeof data.note === "string" ? data.note.trim().slice(0, 300) : "";
      await db().prepare("INSERT INTO admin_audit(id,actor_id,actor_name,action,target_id,summary,created_at) VALUES(?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), admin.id, admin.name, `service_${result.action}`, result.id, note ? `${result.name} · ${note}` : result.name, new Date().toISOString()).run();
    } catch { /* The decision stands even if the audit entry cannot be written. */ }
    return ok(result, headers);
  } catch (cause) {
    if (cause instanceof ServiceError) return error(cause.message, cause.status);
    throw cause;
  }
}
