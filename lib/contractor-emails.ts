// E-mails of the contractor directory (/muteahhitler), bilingual Turkish / English like every notification:
//   firm owner   profile approved / rejected / suspended (always sent: it concerns the account),
//                new land request, offer accepted (follow the "messages" e-mail preference)
//   landowner    a contractor sent an offer (follows the "messages" preference)
// Every function returns a status string and never throws for a missing recipient (run with waitUntil).
import { emailLayout, emailReady, escapeHtml, sendEmail } from "./email";
import { emailPreferences, unsubscribeUrl, type NotificationDatabase, type Settings } from "./email-notifications";
import { CONTRACTOR_PANEL, contractorPath, LAND_PANEL } from "./contractors";

type Recipient = { email: string; name: string };
async function member(db: NotificationDatabase, userId: string): Promise<Recipient | null> {
  const row = await db.prepare("SELECT email,name,email_verified FROM users WHERE CAST(id AS TEXT)=?").bind(userId).first<{ email: string; name: string; email_verified: number }>();
  return row?.email && Number(row.email_verified) ? { email: row.email, name: row.name || "" } : null;
}
async function send(settings: Settings, to: string, mail: { title: string; titleEn: string; lines: string[]; href: string; label: string; subject: string; unsubscribe?: string }) {
  const link = `${settings.SITE_URL}${mail.href}`;
  const result = await sendEmail(settings, {
    to, subject: `${mail.title} / ${mail.titleEn}: ${mail.subject}`.slice(0, 180),
    html: emailLayout({ title: mail.title, titleEn: mail.titleEn, lines: mail.lines.filter(Boolean), action: { href: link, label: mail.label }, ...(mail.unsubscribe ? { unsubscribeUrl: mail.unsubscribe } : {}) }),
    text: `${mail.title} / ${mail.titleEn}: ${mail.subject}\n${link}${mail.unsubscribe ? `\n\nAbonelikten çık / Unsubscribe: ${mail.unsubscribe}` : ""}`,
    ...(mail.unsubscribe ? { unsubscribeUrl: mail.unsubscribe } : {}),
  });
  return result.sent ? "sent" : result.reason;
}
/** Recipient who accepts "messages" e-mails, with the unsubscribe link, or null. */
async function messageRecipient(db: NotificationDatabase, settings: Settings, userId: string) {
  const person = await member(db, userId);
  if (!person) return null;
  const prefs = await emailPreferences(db, userId);
  return prefs.messages ? { ...person, unsubscribe: unsubscribeUrl(settings, prefs.token, "messages") } : null;
}

export async function notifyContractorReview(db: NotificationDatabase, settings: Settings, review: { ownerId: string; firmId: string; firmName: string; action: string; note?: string }) {
  if (!emailReady(settings)) return "not_configured";
  if (!["approve", "reject", "suspend"].includes(review.action)) return "skipped";
  const owner = await member(db, review.ownerId);
  if (!owner) return "no_recipient";
  const name = escapeHtml(review.firmName), note = review.note ? `Yönetici notu / Note: ${escapeHtml(review.note)}` : "";
  const copy = review.action === "approve"
    ? { title: "Müteahhit profiliniz yayında", titleEn: "Your contractor profile is live", lines: [`<strong>${name}</strong> Müteahhitler bölümünde yayınlandı. Arsa sahipleri artık size kat karşılığı talebi gönderebilir.`, "Your firm is now listed; landowners can send you land-for-flats requests.", "İpucu: yetki belgesi numaranızı ekleyin; kontrol edildiğinde \"Doğrulanmış müteahhit\" rozeti alırsınız. / Tip: add your licence number for the verified badge."], href: contractorPath(review.firmId), label: "Profili gör / View profile" }
    : review.action === "reject"
      ? { title: "Müteahhit profilinizde düzeltme gerekli", titleEn: "Your contractor profile needs changes", lines: [`<strong>${name}</strong> şu an yayınlanamadı.`, note, "Profili düzenleyip tekrar gönderebilirsiniz. / Edit the profile and send it again."], href: CONTRACTOR_PANEL, label: "Profili düzenle / Edit profile" }
      : { title: "Müteahhit profiliniz askıya alındı", titleEn: "Your contractor profile was suspended", lines: [`<strong>${name}</strong> geçici olarak yayından kaldırıldı.`, note, "Sorular için iletişim sayfamızı kullanın. / Please use our contact page for questions."], href: CONTRACTOR_PANEL, label: "Hesabımı aç / Open account" };
  return send(settings, owner.email, { ...copy, subject: review.firmName });
}

export async function notifyLandRequest(db: NotificationDatabase, settings: Settings, firms: { ownerId: string; name: string }[], summary: string) {
  if (!emailReady(settings)) return "not_configured";
  let sent = 0;
  for (const firm of firms) {
    const person = await messageRecipient(db, settings, firm.ownerId);
    if (!person) continue;
    const status = await send(settings, person.email, { title: "Yeni kat karşılığı talebi", titleEn: "New land-for-flats request", subject: summary, unsubscribe: person.unsubscribe,
      lines: [`<strong>${escapeHtml(firm.name)}</strong>`, escapeHtml(summary), "Arsa bilgilerini okuyup teklifinizi site üzerinden gönderin. / Read the plot details and send your offer on the site."],
      href: `${CONTRACTOR_PANEL}&bolum=talepler`, label: "Talebi aç / Open request" });
    if (status === "sent") sent++;
  }
  return `sent:${sent}`;
}

export async function notifyLandOffer(db: NotificationDatabase, settings: Settings, offer: { userId: string; firmName: string; ownerShare: number; deliveryMonths: number }) {
  if (!emailReady(settings)) return "not_configured";
  const person = await messageRecipient(db, settings, offer.userId);
  if (!person) return "no_recipient";
  return send(settings, person.email, { title: "Kat karşılığı talebinize teklif geldi", titleEn: "You received an offer for your land", subject: offer.firmName, unsubscribe: person.unsubscribe,
    lines: [`<strong>${escapeHtml(offer.firmName)}</strong>: arsa sahibine %${offer.ownerShare} pay, ${offer.deliveryMonths} ay teslim süresi.`, `Landowner share ${offer.ownerShare}%, delivery in ${offer.deliveryMonths} months.`, "Teklifleri yan yana karşılaştırıp birini kabul edebilirsiniz. / Compare the offers and accept one."],
    href: LAND_PANEL, label: "Teklifleri gör / View offers" });
}

export async function notifyLandAccepted(db: NotificationDatabase, settings: Settings, accepted: { firmOwnerId: string; firmName: string }) {
  if (!emailReady(settings)) return "not_configured";
  const person = await messageRecipient(db, settings, accepted.firmOwnerId);
  if (!person) return "no_recipient";
  return send(settings, person.email, { title: "Kat karşılığı teklifiniz kabul edildi", titleEn: "Your land-for-flats offer was accepted", subject: accepted.firmName, unsubscribe: person.unsubscribe,
    lines: [`<strong>${escapeHtml(accepted.firmName)}</strong>`, "Arsa sahibinin iletişim bilgileri artık hesabınızda görünüyor. / The landowner's contact details are now shown in your account."],
    href: `${CONTRACTOR_PANEL}&bolum=talepler`, label: "Talebi aç / Open request" });
}
