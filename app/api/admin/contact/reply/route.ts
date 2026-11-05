import { body, currentUser, error, isAdmin, ok, sameOrigin } from "@/lib/server";
import { env } from "@/lib/runtime";
import { siteUrl } from "@/lib/site-url";
import { emailProvider, sendEmail, type EmailSettings } from "@/lib/email";
import { ContactError, replyToContact } from "@/lib/contact";
import { contactDB } from "@/lib/contact-server";

const headers = { headers: { "Cache-Control": "private, no-store" } };

// Reply to a contact form message by e-mail from the admin panel. The reply goes from EMAIL_FROM
// (noreply) with Reply-To CONTACT_EMAIL, is stored under the message and marks it handled.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const admin = await currentUser(request);
  // isAdmin() is false while the session still owes its second factor (lib/admin-totp.ts).
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  const settings = env as unknown as EmailSettings;
  if (!emailProvider(settings)) return error("E-posta gönderimi yapılandırılmamış. Yanıtı e-posta programınızdan gönderin.", 503);
  const site = siteUrl();
  try {
    const message = await replyToContact(contactDB(), { id: String(admin.id), name: admin.name }, data,
      (mail) => sendEmail({ ...settings, SITE_URL: site }, { ...mail, replyTo: settings.CONTACT_EMAIL?.trim() || undefined }), site);
    return ok({ message }, headers);
  } catch (cause) {
    if (cause instanceof ContactError) return error(cause.message, cause.status);
    throw cause;
  }
}
