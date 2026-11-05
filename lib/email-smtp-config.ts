// SMTP settings and sender rules (docs/email-notifications.md). Pure functions without imports, so
// both lib/email.ts (every build) and lib/email-smtp-node.ts (Node build only) can use them and the
// tests can check them without nodemailer.
export type SmtpSettings = {
  SMTP_HOST?: string; SMTP_PORT?: string; SMTP_USER?: string; SMTP_PASSWORD?: string;
  EMAIL_FROM?: string; EMAIL_REPLY_TO?: string; CONTACT_EMAIL?: string;
};
export type MailAddress = { name: string; address: string };
// What the transports send. `html` and `text` travel as multipart/alternative.
export type OutgoingMail = {
  from: MailAddress; to: string; replyTo?: string; subject: string; html: string; text: string;
  headers: Record<string, string>;
};
export type SendResult = { sent: true; provider: "resend" | "smtp"; messageId?: string } | { sent: false; reason: string };

const ADDRESS = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
export const isMailAddress = (value: string) => value.length <= 254 && ADDRESS.test(value);
const trim = (value: unknown) => typeof value === "string" ? value.trim() : "";
// Display names never carry line breaks or quotes into a header.
const cleanName = (value: string) => value.replace(/[\r\n"<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

// "EstateMarket24 <noreply@estatemarket24.com>" or "noreply@estatemarket24.com".
export function parseMailAddress(value: unknown): MailAddress | null {
  const text = trim(value);
  const match = text.match(/^(.*?)\s*<([^<>]+)>$/);
  const name = cleanName((match ? match[1] : "").replace(/^"(.*)"$/, "$1")), address = trim(match ? match[2] : text).toLowerCase();
  return isMailAddress(address) ? { name, address } : null;
}

export const recipientDomain = (to: string) => to.includes("@") ? to.slice(to.lastIndexOf("@") + 1).toLowerCase() : "unknown";

export function smtpPort(settings: SmtpSettings) {
  const raw = trim(settings.SMTP_PORT);
  if (!raw) return 465;
  const port = Number(raw);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

export const smtpConfigured = (settings: SmtpSettings) =>
  Boolean(trim(settings.SMTP_HOST) && trim(settings.SMTP_USER) && settings.SMTP_PASSWORD && smtpPort(settings));

// Transport options for nodemailer. 465 = implicit TLS, every other port (587) = STARTTLS, which is
// required: the connection fails instead of falling back to plain text. Certificates are always verified.
export function smtpOptions(settings: SmtpSettings) {
  if (!smtpConfigured(settings)) return null;
  const host = trim(settings.SMTP_HOST), port = smtpPort(settings)!;
  return {
    host, port, secure: port === 465, requireTLS: port !== 465, ignoreTLS: false,
    auth: { user: trim(settings.SMTP_USER), pass: String(settings.SMTP_PASSWORD) },
    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" as const, servername: host },
    pool: true as const, maxConnections: 2, maxMessages: 50,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000,
    logger: false, debug: false,
  };
}

// The sender. Mittwald accepts only the authenticated mailbox as sender, so when SMTP_USER is an
// e-mail address and EMAIL_FROM names another one, the SMTP_USER address is used with EMAIL_FROM's
// display name. (A Mittwald login like "p123456p1" is not an address; EMAIL_FROM is used as given.)
export function smtpFrom(settings: SmtpSettings): MailAddress | null {
  const from = parseMailAddress(settings.EMAIL_FROM), user = parseMailAddress(settings.SMTP_USER);
  const name = from?.name || "EstateMarket24";
  if (user && (!from || from.address !== user.address)) return { name, address: user.address };
  return from ? { name, address: from.address } : null;
}

// Reply-To: the message's own value, else EMAIL_REPLY_TO, else CONTACT_EMAIL (info@estatemarket24.com).
export function replyToAddress(settings: SmtpSettings, explicit?: string) {
  for (const candidate of [explicit, settings.EMAIL_REPLY_TO, settings.CONTACT_EMAIL]) {
    const parsed = parseMailAddress(candidate);
    if (parsed) return parsed.address;
  }
  return undefined;
}

export function unsubscribeHeaders(url?: string): Record<string, string> {
  return url ? { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : {};
}

export const formatAddress = (value: MailAddress) => value.name ? `"${value.name}" <${value.address}>` : value.address;
