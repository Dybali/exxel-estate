// SMTP transport slot (docs/email-notifications.md). This file is what the Cloudflare (vinext) build
// sees: no SMTP, so nodemailer (net/tls sockets) is never bundled for Workers. The Node build for the
// Mittwald container aliases "@/lib/email-smtp" to lib/email-smtp-node.ts (next.config.ts).
import type { OutgoingMail, SendResult, SmtpSettings } from "./email-smtp-config";

export const smtpSend: ((settings: SmtpSettings, mail: OutgoingMail) => Promise<SendResult>) | null = null;
