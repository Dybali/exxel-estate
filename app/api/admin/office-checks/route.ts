import { currentUser, error, isAdmin, ok, str } from "@/lib/server";
import { officeDB } from "@/lib/office-verification-server";
import { ensureOfficeChecks } from "@/lib/office-check";

// Yönetim › Emlakçı başvuruları: the automatic check of one applicant (score, checks, what the document says).
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user?.email_verified || !isAdmin(user)) return error("Yönetici yetkisi gerekli.", 403);
  const id = str(new URL(request.url).searchParams.get("userId"), 80);
  const database = await officeDB();
  await ensureOfficeChecks(database as never);
  const row = await database.prepare("SELECT c.*,v.document_id AS current_document,v.state,v.document_number,v.company_snapshot,d.tax_number FROM office_checks c LEFT JOIN office_verifications v ON v.user_id=c.user_id LEFT JOIN office_application_details d ON d.user_id=c.user_id WHERE c.user_id=?").bind(id).first<Record<string, unknown>>();
  if (!row) return ok({ check: null }, { headers: { "Cache-Control": "private, no-store" } });
  const parse = (value: unknown) => { try { return JSON.parse(String(value || "null")); } catch { return null; } };
  return ok({ check: {
    score: Number(row.score), decision: String(row.decision), checks: parse(row.checks) || [], extracted: parse(row.extracted) || {}, validUntil: row.valid_until || null,
    checkedAt: row.checked_at, ttbsCheckedAt: row.ttbs_checked_at || null, current: row.current_document === row.document_id, state: row.state,
    entered: { documentNumber: row.document_number, company: row.company_snapshot, taxNumber: row.tax_number },
  } }, { headers: { "Cache-Control": "private, no-store" } });
}
