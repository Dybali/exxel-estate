import { body, currentUser, error, ok, sameOrigin } from "@/lib/server";
import { env, waitUntil } from "@/lib/runtime";
import { siteUrl } from "@/lib/request-context";
import { sendEmail, type EmailSettings } from "@/lib/email";
import { ContactError, contactNotice, submitContact } from "@/lib/contact";
import { contactDB } from "@/lib/contact-server";

const headers = { "Cache-Control": "private, no-store" };

// Public contact form (/iletisim). Works without an account; the administrator is emailed in the background.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  const user = await currentUser(request).catch(() => null);
  try {
    const saved = await submitContact(contactDB(), data, user?.id || null);
    // Honeypot submissions get the same answer as real ones but are neither stored nor emailed.
    if (!saved) return ok({ ok: true }, { status: 201, headers });
    const settings = env as unknown as EmailSettings & { EXXEL_ADMIN_EMAIL?: string };
    const admin = settings.EXXEL_ADMIN_EMAIL?.trim();
    if (admin) {
      const notice = contactNotice(saved, siteUrl());
      waitUntil(sendEmail({ ...settings, SITE_URL: siteUrl() }, { to: admin, ...notice }).catch(() => {}));
    }
    return ok({ ok: true }, { status: 201, headers });
  } catch (cause) {
    if (cause instanceof ContactError) return error(cause.message, cause.status);
    throw cause;
  }
}
