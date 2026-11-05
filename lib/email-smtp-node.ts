// SMTP transport for the Node build (Mittwald mailbox, docs/email-notifications.md). Only reached
// through the "@/lib/email-smtp" alias in next.config.ts; the Cloudflare build sees lib/email-smtp.ts.
import nodemailer from "nodemailer";
import { recipientDomain, smtpOptions, type OutgoingMail, type SendResult, type SmtpSettings } from "./email-smtp-config";

type Transporter = { sendMail(mail: Record<string, unknown>): Promise<{ messageId?: string; rejected?: unknown[] }>; close(): void };
type Factory = (options: NonNullable<ReturnType<typeof smtpOptions>>) => Transporter;

// One pooled transport per configuration; a changed host/user/password builds a new pool.
let cached: { key: string; transport: Transporter } | null = null;
let factory: Factory = (options) => nodemailer.createTransport(options) as unknown as Transporter;
// Tests replace the nodemailer factory (e.g. with a stream transport).
export function setSmtpFactory(next: Factory | null) {
  cached?.transport.close(); cached = null;
  factory = next || ((options) => nodemailer.createTransport(options) as unknown as Transporter);
}

function transportFor(settings: SmtpSettings) {
  const options = smtpOptions(settings);
  if (!options) return null;
  const key = JSON.stringify([options.host, options.port, options.auth.user, options.auth.pass]);
  if (cached?.key !== key) { cached?.transport.close(); cached = { key, transport: factory(options) }; }
  return cached.transport;
}

// Error details safe to log: nodemailer codes and the SMTP status, never the message text (which can
// quote server responses) and never credentials or message bodies.
const errorInfo = (cause: unknown) => {
  const value = cause as { code?: unknown; responseCode?: unknown; command?: unknown };
  return { code: typeof value?.code === "string" ? value.code : "unknown", responseCode: typeof value?.responseCode === "number" ? value.responseCode : undefined, command: typeof value?.command === "string" ? value.command.split(" ")[0] : undefined };
};

export async function smtpSend(settings: SmtpSettings, mail: OutgoingMail): Promise<SendResult> {
  const transport = transportFor(settings);
  if (!transport) return { sent: false, reason: "not_configured" };
  const domain = recipientDomain(mail.to);
  try {
    const info = await transport.sendMail({
      from: { name: mail.from.name, address: mail.from.address },
      sender: mail.from.address,
      envelope: { from: mail.from.address, to: mail.to },
      to: mail.to, ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
      subject: mail.subject, text: mail.text, html: mail.html, headers: mail.headers,
      disableFileAccess: true, disableUrlAccess: true,
    });
    if (info.rejected?.length) { console.warn("[email] smtp rejected", JSON.stringify({ to: domain })); return { sent: false, reason: "smtp_rejected" }; }
    console.info("[email] smtp sent", JSON.stringify({ messageId: info.messageId, to: domain }));
    return { sent: true, provider: "smtp", messageId: info.messageId };
  } catch (cause) {
    const info = errorInfo(cause);
    console.warn("[email] smtp failed", JSON.stringify({ ...info, to: domain }));
    return { sent: false, reason: info.code === "EAUTH" ? "smtp_auth" : info.code === "ETIMEDOUT" || info.code === "ECONNECTION" || info.code === "ESOCKET" || info.code === "EDNS" ? "smtp_connection" : "smtp_error" };
  }
}
