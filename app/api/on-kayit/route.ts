import { body, clientIp, error, ok, sameOrigin, sha256 } from "@/lib/server";
import { consumeRateLimit, RecoveryError } from "@/lib/recovery-service";
import { env, waitUntil } from "@/lib/runtime";
import { siteUrl } from "@/lib/request-context";
import { sendEmail, type EmailSettings } from "@/lib/email";
import { LANDING_CITIES } from "@/lib/landing-cities";
import { PreRegistrationError, savePreRegistration } from "@/lib/pre-registrations";
import { preRegistrationsDB } from "@/lib/pre-registrations-server";

const headers = { "Cache-Control": "private, no-store" };
const CITIES = LANDING_CITIES.map((city) => city.slug);

// Pre-registration from a city landing page (app/on-kayit/[sehir]). No account; 10 per address per 15 minutes;
// the hidden "website" field catches bots (same answer, nothing stored). The team gets a short notice e-mail.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  if (typeof data.website === "string" && data.website.trim()) return ok({ ok: true, gift: false }, { status: 201, headers });
  try { await consumeRateLimit(preRegistrationsDB() as never, await sha256(`pre-registration:${clientIp(request)}`), 10, 15 * 60_000); }
  catch (cause) { if (cause instanceof RecoveryError) return error(cause.message, cause.status); throw cause; }
  try {
    const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(",")[0].trim() || null;
    const saved = await savePreRegistration(preRegistrationsDB(), data, CITIES, host);
    const settings = env as unknown as EmailSettings & { EXXEL_ADMIN_EMAIL?: string; CONTACT_EMAIL?: string };
    const recipient = settings.CONTACT_EMAIL?.trim() || settings.EXXEL_ADMIN_EMAIL?.trim();
    if (recipient && !saved.updated) {
      const role = data.role === "agent" ? "Emlakçı" : "Bireysel mülk sahibi", city = LANDING_CITIES.find((item) => item.slug === data.city)?.name || "";
      waitUntil(sendEmail({ ...settings, SITE_URL: siteUrl() }, {
        to: recipient, subject: `Yeni ön kayıt: ${role} · ${city}`,
        html: `<p>Yeni ön kayıt: <strong>${role}</strong>, ${city}.</p><p>Ayrıntılar: <a href="${siteUrl()}/yonetim/on-kayitlar">Yönetim › Ön kayıtlar</a></p>`,
        text: `Yeni ön kayıt: ${role}, ${city}. Ayrıntılar: ${siteUrl()}/yonetim/on-kayitlar`,
      }).catch(() => {}));
    }
    return ok({ ok: true, gift: saved.gift }, { status: 201, headers });
  } catch (cause) {
    if (cause instanceof PreRegistrationError) return error(cause.message, cause.status);
    throw cause;
  }
}
