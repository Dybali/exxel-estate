// Server side of the e-mail code system (lib/email-codes.ts, docs/auth.md): the hashing secret, the
// shared database object and the e-mail sender over the existing transport (lib/email.ts).
import { env } from "./runtime";
import { db } from "./server";
import { emailReady, sendEmail, type EmailSettings } from "./email";
import { authCodeEmail } from "./auth-email";
import type { EmailCodeDatabase, EmailCodePurpose } from "./email-codes";

type CodeEnv = EmailSettings & { EMAIL_CODE_SECRET?: string; DATABASE_URL?: string; CONTACT_EMAIL?: string };

// One database object per isolate so the CREATE TABLE check runs once (db() returns a new object per call).
let shared: EmailCodeDatabase | null = null;
export const emailCodeDB = () => shared ??= db() as unknown as EmailCodeDatabase;

// Server-only key for the code HMACs: EMAIL_CODE_SECRET (16+ characters, recommended), else a key
// derived from DATABASE_URL, which every deployment already has as a server-only secret (the HMAC
// label keeps the uses apart). Changing either only invalidates codes that are still pending.
// null (codes disabled) when neither is set, e.g. local development on D1 without EMAIL_CODE_SECRET.
export function authCodeSecret(settings: Record<string, string | undefined> = env as unknown as Record<string, string | undefined>) {
  const own = (settings.EMAIL_CODE_SECRET || "").trim();
  if (own.length >= 16) return own;
  const database = (settings.DATABASE_URL || "").trim();
  return database.length >= 16 ? "derived-from-database-url:" + database : null;
}

// Codes are offered when a transport (Resend or SMTP) and a secret exist.
export const emailCodesReady = () => Boolean(authCodeSecret() && emailReady(env as unknown as EmailSettings));

// Sends the code e-mail. Sender EMAIL_FROM (or SMTP_FROM), Reply-To CONTACT_EMAIL. Never logs the code.
export async function sendCodeEmail(to: string, purpose: EmailCodePurpose, code: string, locale: unknown) {
  const settings = env as unknown as CodeEnv;
  const result = await sendEmail(settings, { to, ...authCodeEmail(purpose, code, locale), replyTo: settings.CONTACT_EMAIL?.trim() || undefined });
  if (!result.sent) throw new Error("E-mail not sent: " + result.reason);
}
