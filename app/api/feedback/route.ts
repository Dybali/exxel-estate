import { body, clientIp, currentUser, db, error, isAdmin, ok, sameOrigin, sha256 } from "@/lib/server";
import { env, waitUntil } from "@/lib/runtime";
import { siteUrl } from "@/lib/request-context";
import { emailProvider, sendEmail, type EmailSettings } from "@/lib/email";
import { FeedbackError, feedbackNotice, feedbackRole, submitFeedback } from "@/lib/feedback";
import { feedbackDB } from "@/lib/feedback-server";

const headers = { "Cache-Control": "private, no-store" };

// "Öneri ve geri bildirim" form (components/FeedbackWidget.tsx). Works without an account. Only a
// salted hash of the IP address is used, for the shared rate limits; it is not stored with the item.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  const database = feedbackDB();
  const user = await currentUser(request).catch(() => null);
  try {
    const role = user ? await feedbackRole(database, user, isAdmin(user)) : null;
    const saved = await submitFeedback(database, data, {
      ipHash: await sha256("feedback-ip:" + clientIp(request)),
      user: user && role ? { id: String(user.id), email: user.email_verified ? String(user.email) : "", role } : null,
      userAgent: request.headers.get("user-agent"),
    });
    // Honeypot submissions get the same answer as real ones but are neither stored nor e-mailed.
    if (!saved) return ok({ ok: true }, { status: 201, headers });
    // Short notice to the team when e-mail is configured; a failure never affects the saved item.
    const settings = env as unknown as EmailSettings & { EXXEL_ADMIN_EMAIL?: string; CONTACT_EMAIL?: string; ALERT_EMAIL?: string };
    const recipient = settings.CONTACT_EMAIL?.trim() || settings.ALERT_EMAIL?.trim() || settings.EXXEL_ADMIN_EMAIL?.trim();
    if (recipient && emailProvider(settings)) {
      const notice = feedbackNotice(saved, siteUrl());
      waitUntil(sendEmail({ ...settings, SITE_URL: siteUrl() }, { to: recipient, ...notice, ...(saved.email ? { replyTo: saved.email } : {}) }).catch(() => {}));
    }
    return ok({ ok: true }, { status: 201, headers });
  } catch (cause) {
    if (cause instanceof FeedbackError) return error(cause.message, cause.status);
    throw cause;
  }
}
