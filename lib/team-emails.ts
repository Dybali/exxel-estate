// E-mail to a consultant an estate office invited by address (Hesabım › Ekibim). The person may not have an
// account yet: the link signs them in or up and opens Hesabım › Ofis ekibi, where the invitation waits.
// Bilingual like every notification; sent once per invitation, never throws (run with waitUntil).
import { emailLayout, emailReady, escapeHtml, sendEmail, type EmailSettings } from "./email";

export const TEAM_JOIN_PATH = "/hesabim?tab=ekip";
export async function notifyTeamInvitation(settings: EmailSettings & { SITE_URL: string }, invitation: { email: string; officeName: string; expires: string }) {
  if (!emailReady(settings)) return "not_configured";
  const link = `${settings.SITE_URL}${TEAM_JOIN_PATH}`, office = escapeHtml(invitation.officeName), until = invitation.expires.slice(0, 10);
  const result = await sendEmail(settings, {
    to: invitation.email,
    subject: `Ekip daveti / Team invitation: ${invitation.officeName}`.slice(0, 180),
    html: emailLayout({
      title: "Emlak ofisi ekibine davet edildiniz", titleEn: "You are invited to join an estate office",
      lines: [
        `<strong>${office}</strong> sizi estatemarket24'te danışman olarak ekibine davet etti. / invited you to its team on estatemarket24.`,
        "Bu e-posta adresiyle giriş yapın veya ücretsiz kayıt olun; davet Hesabım › Ofis ekibi bölümünde sizi bekler. / Sign in or sign up with this e-mail address; the invitation waits under Hesabım › Ofis ekibi.",
        `Son tarih / Valid until: ${until}`,
      ],
      action: { href: link, label: "Daveti aç / Open invitation" },
    }),
    text: `${invitation.officeName} sizi danışman olarak ekibine davet etti / invited you to its team.\n${link}\nSon tarih / Valid until: ${until}`,
  });
  return result.sent ? "sent" : result.reason;
}
