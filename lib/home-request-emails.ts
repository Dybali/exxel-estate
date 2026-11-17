// E-mail to the estate agents a "Benim için bul" request reached (lib/home-requests.ts). Bilingual like every
// notification; follows the agent's "messages" e-mail preference; never throws (run with waitUntil).
import { emailLayout, emailReady, escapeHtml, sendEmail } from "./email";
import { emailPreferences, unsubscribeUrl, type NotificationDatabase, type Settings } from "./email-notifications";

export const HOME_REQUEST_PANEL = "/hesabim?tab=crm#musteri-talepleri";

export async function notifyHomeRequest(db: NotificationDatabase, settings: Settings, agents: { id: string }[], summary: string) {
  if (!emailReady(settings)) return "not_configured";
  let sent = 0;
  for (const agent of agents) {
    const row = await db.prepare("SELECT email,email_verified FROM users WHERE CAST(id AS TEXT)=?").bind(agent.id).first<{ email: string; email_verified: number }>();
    if (!row?.email || !Number(row.email_verified)) continue;
    const prefs = await emailPreferences(db, agent.id);
    if (!prefs.messages) continue;
    const unsubscribe = unsubscribeUrl(settings, prefs.token, "messages"), link = `${settings.SITE_URL}${HOME_REQUEST_PANEL}`;
    const result = await sendEmail(settings, {
      to: row.email, subject: `Yeni müşteri talebi / New client request: ${summary}`.slice(0, 180),
      html: emailLayout({ title: "Yeni müşteri talebi", titleEn: "New client request", lines: [`<strong>${escapeHtml(summary)}</strong>`, "Bir üye bölgenizde ev arıyor ve iletişim bilgilerini sizinle paylaştı. / A member is looking for a home in your area and shared their contact details with you."], action: { href: link, label: "Talebi aç / Open request" }, unsubscribeUrl: unsubscribe }),
      text: `Yeni müşteri talebi / New client request: ${summary}\n${link}\n\nAbonelikten çık / Unsubscribe: ${unsubscribe}`,
      unsubscribeUrl: unsubscribe,
    });
    if (result.sent) sent++;
  }
  return `sent:${sent}`;
}
