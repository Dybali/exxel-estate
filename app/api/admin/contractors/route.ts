import { body, currentUser, db, error, isAdmin, ok, sameOrigin } from "@/lib/server";
import { reportsDB } from "@/lib/reports-server";
import { waitUntil } from "@/lib/runtime";
import { notifyContractorReview } from "@/lib/contractor-emails";
import { adminContractors, ContractorError, reviewContractor } from "@/lib/contractors";
import { contractorEmailSettings, contractorNotifyDB, contractorsDB } from "@/lib/contractors-server";

const headers = { headers: { "Cache-Control": "private, no-store" } };

// Contractor firms by status (default: waiting for review) with per-status totals.
export async function GET(request: Request) {
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  return ok(await adminContractors(contractorsDB(), new URL(request.url).searchParams.get("status")), headers);
}

// approve | reject | suspend (with a note the owner reads) | verify | unverify | feature | unfeature.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  try {
    const result = await reviewContractor(contractorsDB(), admin.id, data.id, data.action, data.note);
    const note = typeof data.note === "string" ? data.note.trim() : "";
    waitUntil(notifyContractorReview(contractorNotifyDB(), contractorEmailSettings(), { ownerId: result.ownerId, firmId: result.id, firmName: result.name, action: result.action, note }).catch(() => {}));
    try {
      await reportsDB();
      await db().prepare("INSERT INTO admin_audit(id,actor_id,actor_name,action,target_id,summary,created_at) VALUES(?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), admin.id, admin.name, `contractor_${result.action}`, result.id, `${result.name}${note ? ` · ${note.slice(0, 200)}` : ""}`, new Date().toISOString()).run();
    } catch { /* The decision stands even if the audit entry cannot be written. */ }
    return ok({ id: result.id, status: result.status }, headers);
  } catch (cause) { if (cause instanceof ContractorError) return error(cause.message, cause.status); throw cause; }
}
