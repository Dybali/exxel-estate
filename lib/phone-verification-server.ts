import { env } from "./runtime";
import { db, type User } from "./server";
import { configuredSmsProvider } from "./sms";
import { phoneVerified, verifiedPhoneUserIds, type PhoneDatabase } from "./phone-verification";
import { authCodeSecret } from "./email-codes-server";

// One database object per isolate so the CREATE TABLE check runs once (db() returns a new object per call).
let shared: PhoneDatabase | null = null;
export const phoneDB = () => shared ??= db() as unknown as PhoneDatabase;

// Pepper for code hashes: PHONE_CODE_SECRET, else the e-mail code secret (EMAIL_CODE_SECRET, or a key
// derived from DATABASE_URL; lib/email-codes-server.ts). The HMAC labels differ, so sharing is safe.
export function phoneCodeSecret() {
  const settings = env as unknown as Record<string, string | undefined>;
  const own = (settings.PHONE_CODE_SECRET || "").trim();
  return own.length >= 16 ? own : authCodeSecret(settings);
}
// Phone verification is offered only with a configured SMS provider and a hashing secret.
export const phoneVerificationReady = () => Boolean(phoneCodeSecret() && configuredSmsProvider());

// Helpers for showing a "Telefon doğrulandı" badge elsewhere.
export const userPhoneVerified = (user: Pick<User, "id" | "phone">) => phoneVerified(phoneDB(), String(user.id), user.phone);
export const phoneVerifiedUsers = (users: { id: string; phone?: string | null }[]) => verifiedPhoneUserIds(phoneDB(), users);
