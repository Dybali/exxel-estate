// E-mails around "Benim için bul" (lib/home-requests.ts, lib/lead-board.ts). Bilingual like every notification;
// follow the recipient's "messages" e-mail preference; never throw (run with waitUntil).
import { emailLayout, emailReady, escapeHtml, sendEmail } from "./email";
import { emailPreferences, unsubscribeUrl, type NotificationDatabase, type Settings } from "./email-notifications";

export const HOME_REQUEST_PANEL = "/hesabim?tab=crm#talep-akisi";
export const MEMBER_REQUEST_PANEL = "/hesabim?tab=aramalar#benim-icin-bul";

async function sendTo(db: NotificationDatabase, settings: Settings, userId: string, message: (link: string, unsubscribe: string) => { subject: string; title: string; titleEn: string; lines: string[]; label: string; text: string }, path: string) {
  const row = await db.prepare("SELECT email,email_verified FROM users WHERE CAST(id AS TEXT)=?").bind(userId).first<{ email: string; email_verified: number }>();
  if (!row?.email || !Number(row.email_verified)) return false;
  const prefs = await emailPreferences(db, userId);
  if (!prefs.messages) return false;
  const unsubscribe = unsubscribeUrl(settings, prefs.token, "messages"), link = `${settings.SITE_URL}${path}`;
  const mail = message(link, unsubscribe);
  const result = await sendEmail(settings, {
    to: row.email, subject: mail.subject.slice(0, 180),
    html: emailLayout({ title: mail.title, titleEn: mail.titleEn, lines: mail.lines, action: { href: link, label: mail.label }, unsubscribeUrl: unsubscribe }),
    text: `${mail.text}\n${link}\n\nAbonelikten çık / Unsubscribe: ${unsubscribe}`, unsubscribeUrl: unsubscribe,
  });
  return Boolean(result.sent);
}

/** New request on the board, to the agents who follow its province (lib/lead-board.ts agentsToAlert). */
export async function notifyHomeRequest(db: NotificationDatabase, settings: Settings, agents: { id: string }[], summary: string) {
  if (!emailReady(settings)) return "not_configured";
  let sent = 0;
  for (const agent of agents) if (await sendTo(db, settings, agent.id, () => ({
    subject: `Yeni alıcı talebi / New buyer request: ${summary}`, title: "Talep akışında yeni alıcı", titleEn: "New buyer on the request board",
    lines: [`<strong>${escapeHtml(summary)}</strong>`, "Takip ettiğiniz ilde bir üye ev arıyor. Talebe en fazla 4 danışman ulaşabilir. / A member is looking for a home in a province you follow. At most 4 agents can reach the request."],
    label: "Talep akışını aç / Open the board", text: `Yeni alıcı talebi / New buyer request: ${summary}`,
  }), HOME_REQUEST_PANEL)) sent++;
  return `sent:${sent}`;
}

/** An agent answered the member's request with an offer. */
export async function notifyMemberOffer(db: NotificationDatabase, settings: Settings, memberId: string, agentName: string, summary: string) {
  if (!emailReady(settings)) return "not_configured";
  const sent = await sendTo(db, settings, memberId, () => ({
    subject: `${agentName} talebinize teklif gönderdi / sent you an offer`, title: "Talebinize yeni teklif", titleEn: "A new offer for your request",
    lines: [`<strong>${escapeHtml(agentName)}</strong>`, escapeHtml(summary), "Teklifi ve önerilen ilanları Hesabım'da görebilirsiniz. / See the offer and the suggested listings in your account."],
    label: "Teklifi gör / See the offer", text: `${agentName}: ${summary}`,
  }), MEMBER_REQUEST_PANEL);
  return sent ? "sent" : "skipped";
}
