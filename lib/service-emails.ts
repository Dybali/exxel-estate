// E-mails of the service directory (/hizmetler), bilingual Turkish / English like every notification:
//   firm owner   profile approved / rejected / suspended, document approved / needs correction (always sent:
//                they concern the account), new quote request, offer accepted (follow the member's
//                "messages" e-mail preference, with an unsubscribe link)
//   customer     a firm sent an offer (follows the "messages" preference)
// Every function returns a status string and never throws for a missing recipient, so callers can run
// them with waitUntil(...) after the response.
import { emailLayout, emailReady, escapeHtml, sendEmail } from "./email";
import { emailPreferences, unsubscribeUrl, type NotificationDatabase, type Settings } from "./email-notifications";
import { SERVICE_DOCUMENT_KINDS, type ServiceDocumentKind } from "./service-extras";
import { firmPath } from "./services";

type Recipient = { email: string; name: string };
async function member(db: NotificationDatabase, userId: string): Promise<Recipient | null> {
  const row = await db.prepare("SELECT email,name,email_verified FROM users WHERE CAST(id AS TEXT)=?").bind(userId).first<{ email: string; name: string; email_verified: number }>();
  return row?.email && Number(row.email_verified) ? { email: row.email, name: row.name || "" } : null;
}
// The firm's own panel inside the Hizmetler sub-site (app/hizmetler/panel).
const PANEL = "/hizmetler/panel";
const QUOTES = "/hesabim?tab=teklifler";

/** Firm review decision (approve, reject, suspend). Other admin actions send nothing. */
export async function notifyFirmReview(db: NotificationDatabase, settings: Settings, review: { ownerId: string; firmId: string; firmName: string; action: string; note?: string }) {
  if (!emailReady(settings)) return "not_configured";
  if (!["approve", "reject", "suspend"].includes(review.action)) return "skipped";
  const owner = await member(db, review.ownerId);
  if (!owner) return "no_recipient";
  const name = escapeHtml(review.firmName), note = review.note ? escapeHtml(review.note) : "";
  const copy = review.action === "approve"
    ? { title: "Firmanız yayında", titleEn: "Your firm is live", lines: [`<strong>${name}</strong> Hizmetler bölümünde yayınlandı. Müşteriler artık sizi bulabilir ve teklif isteyebilir.`, "Your firm is now listed in the Services section; customers can find you and ask for quotes.", "İpucu: çalışma saatlerinizi ekleyin ve belgelerinizi yükleyin; \"Belgeli firma\" rozeti daha çok talep getirir. / Tip: add your working hours and upload documents for the \"Documented firm\" badge."], href: firmPath(review.firmId), label: "Profili gör / View profile" }
    : review.action === "reject"
      ? { title: "Firma profilinizde düzeltme gerekli", titleEn: "Your firm profile needs changes", lines: [`<strong>${name}</strong> şu an yayınlanamadı.`, note ? `Yönetici notu / Note: ${note}` : "", "Profili düzenleyip tekrar gönderebilirsiniz. / Edit the profile and send it again."], href: PANEL, label: "Profili düzenle / Edit profile" }
      : { title: "Firma profiliniz askıya alındı", titleEn: "Your firm profile was suspended", lines: [`<strong>${name}</strong> geçici olarak yayından kaldırıldı.`, note ? `Yönetici notu / Note: ${note}` : "", "Sorular için bu e-postayı yanıtlamak yerine iletişim sayfamızı kullanın. / Please use our contact page for questions."], href: PANEL, label: "Hesabımı aç / Open account" };
  const link = `${settings.SITE_URL}${copy.href}`;
  const result = await sendEmail(settings, {
    to: owner.email, subject: `${copy.title} / ${copy.titleEn}: ${review.firmName}`.slice(0, 180),
    html: emailLayout({ title: copy.title, titleEn: copy.titleEn, lines: copy.lines.filter(Boolean), action: { href: link, label: copy.label } }),
    text: `${copy.title} / ${copy.titleEn}: ${review.firmName}\n${review.note ? `${review.note}\n` : ""}${link}`,
  });
  return result.sent ? "sent" : result.reason;
}

export async function notifyDocumentReview(db: NotificationDatabase, settings: Settings, review: { ownerId: string; firmName: string; kind: ServiceDocumentKind; state: "approved" | "rejected"; note: string }) {
  if (!emailReady(settings)) return "not_configured";
  const owner = await member(db, review.ownerId);
  if (!owner) return "no_recipient";
  const kind = SERVICE_DOCUMENT_KINDS[review.kind], approved = review.state === "approved";
  const title = approved ? "Belgeniz onaylandı" : "Belgenizde düzeltme gerekli", titleEn = approved ? "Your document was approved" : "Your document needs a correction";
  const lines = approved
    ? [`<strong>${escapeHtml(review.firmName)}</strong> · ${escapeHtml(kind)}`, "Profilinizde artık \"Belgeli firma\" rozeti görünür. / Your profile now shows the \"Documented firm\" badge."]
    : [`<strong>${escapeHtml(review.firmName)}</strong> · ${escapeHtml(kind)}`, `Yönetici notu / Note: ${escapeHtml(review.note)}`, "Belgeyi silip doğrusunu yükleyebilirsiniz. / Delete it and upload the correct file."];
  const link = `${settings.SITE_URL}${PANEL}`;
  const result = await sendEmail(settings, { to: owner.email, subject: `${title} / ${titleEn}`, html: emailLayout({ title, titleEn, lines, action: { href: link, label: "Belgelerim / My documents" } }), text: `${title} / ${titleEn}: ${kind}\n${approved ? "" : `${review.note}\n`}${link}` });
  return result.sent ? "sent" : result.reason;
}

/** One e-mail per receiving firm owner; the customer's contact details are never in the e-mail. */
export async function notifyQuoteRequest(db: NotificationDatabase, settings: Settings, request: { summary: string; timing: string; recipients: { ownerId: string; name: string }[] }) {
  if (!emailReady(settings)) return { sent: 0 };
  let sent = 0;
  for (const firm of request.recipients) {
    const owner = await member(db, firm.ownerId);
    if (!owner) continue;
    const prefs = await emailPreferences(db, firm.ownerId);
    if (!prefs.messages) continue;
    const unsubscribe = unsubscribeUrl(settings, prefs.token, "messages"), link = `${settings.SITE_URL}${PANEL}?bolum=talepler`;
    const result = await sendEmail(settings, {
      to: owner.email, subject: `Yeni teklif talebi / New quote request: ${request.summary}`.slice(0, 180),
      html: emailLayout({ title: "Yeni teklif talebi", titleEn: "New quote request", lines: [`<strong>${escapeHtml(firm.name)}</strong>`, `${escapeHtml(request.summary)} · ${escapeHtml(request.timing)}`, "Talebi okuyup fiyat teklifinizi site üzerinden gönderin; hızlı yanıt veren firmalar öne çıkar. / Read the request and send your price offer on the site."], action: { href: link, label: "Talebi aç / Open request" }, unsubscribeUrl: unsubscribe }),
      text: `Yeni teklif talebi / New quote request: ${request.summary} · ${request.timing}\n${link}\n\nAbonelikten çık / Unsubscribe: ${unsubscribe}`,
      unsubscribeUrl: unsubscribe,
    });
    if (result.sent) sent++;
  }
  return { sent };
}

export async function notifyQuoteOffer(db: NotificationDatabase, settings: Settings, offer: { userId: string; firmName: string; summary: string }) {
  if (!emailReady(settings)) return "not_configured";
  const customer = await member(db, offer.userId);
  if (!customer) return "no_recipient";
  const prefs = await emailPreferences(db, offer.userId);
  if (!prefs.messages) return "opted_out";
  const unsubscribe = unsubscribeUrl(settings, prefs.token, "messages"), link = `${settings.SITE_URL}${QUOTES}`;
  const result = await sendEmail(settings, {
    to: customer.email, subject: `Yeni fiyat teklifi / New price offer: ${offer.summary}`.slice(0, 180),
    html: emailLayout({ title: "Talebinize yeni teklif geldi", titleEn: "You received a new offer", lines: [`<strong>${escapeHtml(offer.firmName)}</strong> · ${escapeHtml(offer.summary)}`, "Teklifleri yan yana karşılaştırmak için hesabınıza giriş yapın. / Sign in to compare the offers side by side."], action: { href: link, label: "Teklifleri karşılaştır / Compare offers" }, unsubscribeUrl: unsubscribe }),
    text: `Yeni fiyat teklifi / New price offer: ${offer.firmName} · ${offer.summary}\n${link}\n\nAbonelikten çık / Unsubscribe: ${unsubscribe}`,
    unsubscribeUrl: unsubscribe,
  });
  return result.sent ? "sent" : result.reason;
}

export async function notifyOfferAccepted(db: NotificationDatabase, settings: Settings, accepted: { ownerId: string; firmName: string; customerName: string }) {
  if (!emailReady(settings)) return "not_configured";
  const owner = await member(db, accepted.ownerId);
  if (!owner) return "no_recipient";
  const prefs = await emailPreferences(db, accepted.ownerId);
  if (!prefs.messages) return "opted_out";
  const unsubscribe = unsubscribeUrl(settings, prefs.token, "messages"), link = `${settings.SITE_URL}${PANEL}?bolum=talepler`;
  const result = await sendEmail(settings, {
    to: owner.email, subject: `Teklifiniz kabul edildi / Your offer was accepted`,
    html: emailLayout({ title: "Teklifiniz kabul edildi", titleEn: "Your offer was accepted", lines: [`<strong>${escapeHtml(accepted.firmName)}</strong> · ${escapeHtml(accepted.customerName)}`, "Müşterinin iletişim bilgileri artık talep ekranınızda görünür. / The customer's contact details are now visible in your requests."], action: { href: link, label: "Talebi aç / Open request" }, unsubscribeUrl: unsubscribe }),
    text: `Teklifiniz kabul edildi / Your offer was accepted: ${accepted.customerName}\n${link}\n\nAbonelikten çık / Unsubscribe: ${unsubscribe}`,
    unsubscribeUrl: unsubscribe,
  });
  return result.sent ? "sent" : result.reason;
}
