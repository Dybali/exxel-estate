import { body, currentUser, db, error, isAdmin, ok, sameOrigin } from "@/lib/server";
import { reportsDB } from "@/lib/reports-server";
import { waitUntil } from "@/lib/runtime";
import { notifyDocumentReview, notifyFirmReview, notifyQuoteRequest } from "@/lib/service-emails";
import { deliverWaitingQuotes, documentsOf, QUOTE_TIMINGS, quoteSummary, reviewDocument } from "@/lib/service-extras";
import { adminFirms, reviewFirm, ServiceError } from "@/lib/services";
import { serviceEmailSettings, serviceNotifyDB, servicesDB } from "@/lib/services-server";

const headers = { headers: { "Cache-Control": "private, no-store" } };

// Service firms by status (default: waiting for review) with per-status totals.
export async function GET(request: Request) {
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  const result = await adminFirms(servicesDB(), new URL(request.url).searchParams.get("status"));
  // Documents of the listed firms, and the number waiting for review across all firms.
  const documents = await documentsOf(servicesDB(), result.firms.map((firm) => firm.id));
  const waiting = await servicesDB().prepare("SELECT COUNT(*) AS n FROM service_firm_documents WHERE state='pending'").bind().first<{ n: number }>();
  return ok({ ...result, firms: result.firms.map((firm) => ({ ...firm, documents: documents.get(firm.id) || [] })), pendingDocuments: Number(waiting?.n) || 0 }, headers);
}

// approve | reject | suspend (with a note the owner reads) | verify | unverify | feature | unfeature,
// and approve_document | reject_document ({ documentId, note }). Owners are e-mailed about decisions.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  if (data.action === "approve_document" || data.action === "reject_document") {
    try {
      const document = await reviewDocument(servicesDB(), admin.id, data.documentId, data.action === "approve_document", data.note);
      waitUntil(notifyDocumentReview(serviceNotifyDB(), serviceEmailSettings(), { ownerId: document.ownerId, firmName: document.firmName, kind: document.kind, state: document.state, note: document.note }).catch(() => {}));
      try {
        await reportsDB();
        await db().prepare("INSERT INTO admin_audit(id,actor_id,actor_name,action,target_id,summary,created_at) VALUES(?,?,?,?,?,?,?)")
          .bind(crypto.randomUUID(), admin.id, admin.name, `service_${data.action}`, document.firmId, `${document.firmName} · ${document.kind}${document.note ? ` · ${document.note.slice(0, 200)}` : ""}`, new Date().toISOString()).run();
      } catch { /* The decision stands even if the audit entry cannot be written. */ }
      return ok({ id: document.id, state: document.state }, headers);
    } catch (cause) {
      if (cause instanceof ServiceError) return error(cause.message, cause.status);
      throw cause;
    }
  }
  try {
    const result = await reviewFirm(servicesDB(), admin.id, data.id, data.action, data.note);
    // An approved firm receives the open requests that were waiting for a firm in its categories and areas.
    if (result.action === "approve") {
      try {
        const waiting = await deliverWaitingQuotes(servicesDB(), result.id);
        if (waiting.firm) for (const item of waiting.requests) waitUntil(notifyQuoteRequest(serviceNotifyDB(), serviceEmailSettings(), { summary: quoteSummary(item), timing: QUOTE_TIMINGS[item.timing], recipients: [waiting.firm] }).catch(() => {}));
      } catch { /* The approval stands even if waiting requests cannot be delivered now. */ }
    }
    waitUntil(notifyFirmReview(serviceNotifyDB(), serviceEmailSettings(), { ownerId: result.ownerId, firmId: result.id, firmName: result.name, action: result.action as string, note: typeof data.note === "string" ? data.note.trim().slice(0, 1000) : "" }).catch(() => {}));
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
