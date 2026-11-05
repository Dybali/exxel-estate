import { currentUser, error, isAdmin, ok, sameOrigin } from "@/lib/server";
import { env } from "@/lib/runtime";
import { siteUrl } from "@/lib/site-url";
import { emailProvider, sendEmail, type EmailSettings } from "@/lib/email";
import { emailTestAllowed, emailTestMessage } from "@/lib/email-test";

const headers = { headers: { "Cache-Control": "private, no-store" } };

async function administrator(request: Request) {
  const user = await currentUser(request);
  return user?.email_verified && isAdmin(user) ? user : null;
}

// Which provider would send e-mail right now (no secrets, no addresses besides the admin's own).
export async function GET(request: Request) {
  const admin = await administrator(request);
  if (!admin) return error("Yönetici yetkisi gerekli.", 403);
  return ok({ provider: emailProvider(env as unknown as EmailSettings), to: admin.email }, headers);
}

// Sends a test e-mail to the signed-in administrator's own address.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const admin = await administrator(request);
  if (!admin) return error("Yönetici yetkisi gerekli.", 403);
  const settings = env as unknown as EmailSettings;
  const provider = emailProvider(settings);
  if (!provider) return error("E-posta gönderimi yapılandırılmamış.", 503);
  if (!emailTestAllowed(String(admin.id))) return error("Çok fazla test e-postası gönderildi. Lütfen birkaç dakika sonra tekrar deneyin.", 429);
  const result = await sendEmail({ ...settings, SITE_URL: siteUrl() }, { to: admin.email, ...emailTestMessage(provider, siteUrl()) });
  if (!result.sent) return ok({ sent: false, provider, reason: result.reason }, { status: 502, ...headers });
  return ok({ sent: true, provider, to: admin.email }, headers);
}
