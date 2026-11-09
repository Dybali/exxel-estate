import { body, currentUser, error, isAdmin, ok, sameOrigin } from "@/lib/server";
import { env } from "@/lib/runtime";
import { siteUrl } from "@/lib/site-url";
import { emailProvider, sendEmail, type EmailSettings } from "@/lib/email";
import { FeedbackError, replyToFeedback } from "@/lib/feedback";
import { feedbackDB } from "@/lib/feedback-server";

const headers = { headers: { "Cache-Control": "private, no-store" } };

// Reply to a feedback item by e-mail (only when the sender left an address). Sent from EMAIL_FROM with
// Reply-To CONTACT_EMAIL, like contact form replies; stored in the item's replies and audited.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  const settings = env as unknown as EmailSettings & { CONTACT_EMAIL?: string };
  if (!emailProvider(settings)) return error("E-posta gönderimi yapılandırılmamış. Yanıtı e-posta programınızdan gönderin.", 503);
  const site = siteUrl();
  try {
    const item = await replyToFeedback(feedbackDB(), { id: String(admin.id), name: admin.name }, data,
      (mail) => sendEmail({ ...settings, SITE_URL: site }, { ...mail, replyTo: settings.CONTACT_EMAIL?.trim() || undefined }), site);
    return ok({ item }, headers);
  } catch (cause) {
    if (cause instanceof FeedbackError) return error(cause.message, cause.status);
    throw cause;
  }
}
