// Admin "send a test e-mail" action (Hizmet durumu → Site e-postası): content and a small per-process
// limit (5 per administrator per 10 minutes), enough to check the SMTP settings without spamming.
import { emailLayout, escapeHtml } from "./email-layout";

const WINDOW = 10 * 60_000, LIMIT = 5;
const sent = new Map<string, number[]>();

export function emailTestAllowed(adminId: string, now = Date.now()) {
  const recent = (sent.get(adminId) || []).filter((at) => now - at < WINDOW);
  if (recent.length >= LIMIT) { sent.set(adminId, recent); return false; }
  recent.push(now); sent.set(adminId, recent);
  return true;
}

export function emailTestMessage(provider: string, siteUrl: string, at = new Date()) {
  const when = `${at.toISOString().slice(0, 19).replace("T", " ")} UTC`;
  return {
    subject: "estatemarket24 test e-postası / test e-mail",
    html: emailLayout({
      title: "Test e-postası", titleEn: "Test e-mail",
      lines: [
        "Bu e-posta yönetim panelinden gönderildi; e-posta ayarları çalışıyor. / Sent from the admin panel: e-mail delivery works.",
        `Sağlayıcı / Provider: <strong>${escapeHtml(provider)}</strong> · ${escapeHtml(when)}`,
      ],
      action: { href: `${siteUrl}/yonetim?view=health`, label: "Yönetim paneli / Admin" },
    }),
    text: `Bu e-posta yönetim panelinden gönderildi; e-posta ayarları çalışıyor.\nSent from the admin panel: e-mail delivery works.\n\nSağlayıcı / Provider: ${provider} · ${when}\n${siteUrl}/yonetim?view=health\n`,
  };
}
