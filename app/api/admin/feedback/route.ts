import { body, currentUser, error, isAdmin, ok, sameOrigin } from "@/lib/server";
import { adminFeedbackList, FeedbackError, feedbackSummary, updateFeedback } from "@/lib/feedback";
import { feedbackDB } from "@/lib/feedback-server";
import { env } from "@/lib/runtime";
import { emailProvider, type EmailSettings } from "@/lib/email";

const headers = { headers: { "Cache-Control": "private, no-store" } };

// "Öneriler" for administrators: filtered, paginated list (or ?summary=1 for the overview card).
// isAdmin() is false while the session still owes its second factor (lib/admin-totp.ts).
export async function GET(request: Request) {
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  const params = new URL(request.url).searchParams;
  if (params.get("summary") === "1") return ok({ summary: await feedbackSummary(feedbackDB()) }, headers);
  const list = await adminFeedbackList(feedbackDB(), Object.fromEntries(["status", "kind", "topic", "role", "hasEmail", "q", "page"].map((key) => [key, params.get(key) || ""])));
  // emailProvider tells the panel whether the inline reply can send (null: only the mailto link works).
  return ok({ ...list, emailProvider: emailProvider(env as unknown as EmailSettings) }, headers);
}

// Status (Yeni → İnceleniyor → Planlandı → Yapıldı / Yapılmayacak) and internal note; audited.
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  try {
    return ok({ item: await updateFeedback(feedbackDB(), { id: String(admin.id), name: admin.name }, data) }, headers);
  } catch (cause) {
    if (cause instanceof FeedbackError) return error(cause.message, cause.status);
    throw cause;
  }
}
