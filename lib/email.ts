// Transactional e-mail (docs/email-notifications.md). Provider choice:
//   RESEND_API_KEY + EMAIL_FROM          → Resend HTTP API (every build)
//   else SMTP_HOST/USER/PASSWORD set      → SMTP, e.g. the Mittwald mailbox (Node build only)
//   else                                  → nothing is sent ("not_configured")
import { smtpSend } from "@/lib/email-smtp";
import { parseMailAddress, replyToAddress, smtpConfigured, smtpFrom, unsubscribeHeaders, type SendResult, type SmtpSettings } from "./email-smtp-config";

export { emailLayout, escapeHtml } from "./email-layout";
export type { SendResult } from "./email-smtp-config";

export type EmailSettings = SmtpSettings & { RESEND_API_KEY?: string; SITE_URL?: string };
// `replyTo` overrides EMAIL_REPLY_TO / CONTACT_EMAIL for this message.
export type EmailMessage = { to: string; subject: string; html: string; text: string; unsubscribeUrl?: string; replyTo?: string };
export type EmailProvider = "resend" | "smtp";

const resendReady = (settings: EmailSettings) => Boolean(settings.RESEND_API_KEY && settings.EMAIL_FROM);

export function emailProvider(settings: EmailSettings): EmailProvider | null {
  if (resendReady(settings)) return "resend";
  if (smtpSend && smtpConfigured(settings) && smtpFrom(settings)) return "smtp";
  return null;
}

export const emailReady = (settings: EmailSettings) => emailProvider(settings) !== null;

export async function sendEmail(settings: EmailSettings, message: EmailMessage): Promise<SendResult> {
  const provider = emailProvider(settings);
  if (!provider) return { sent: false, reason: "not_configured" };
  if (!parseMailAddress(message.to)) return { sent: false, reason: "invalid_recipient" };
  const replyTo = replyToAddress(settings, message.replyTo);
  if (provider === "smtp") {
    return smtpSend!(settings, {
      from: smtpFrom(settings)!, to: message.to, replyTo, subject: message.subject, html: message.html, text: message.text,
      headers: unsubscribeHeaders(message.unsubscribeUrl),
    });
  }
  const headers = unsubscribeHeaders(message.unsubscribeUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${settings.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: settings.EMAIL_FROM, to: [message.to], subject: message.subject, html: message.html, text: message.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(Object.keys(headers).length ? { headers } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) { await response.body?.cancel(); return { sent: false, reason: `provider_${response.status}` }; }
  let data: { id?: unknown } | null = null;
  try { data = await response.json() as { id?: unknown }; } catch { /* the id is only logged */ }
  return { sent: true, provider: "resend", ...(typeof data?.id === "string" ? { messageId: data.id } : {}) };
}
