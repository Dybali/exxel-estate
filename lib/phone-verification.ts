// Phone number verification by SMS code. Codes are 6 digits, stored only as an HMAC with a
// server secret, valid for 10 minutes and 5 attempts. "Phone verified" is derived: the user's
// current phone has a verified row of their own (the users table is not altered).
// The database, secret and SMS sender are passed in, so this module is tested with node:sqlite.
import { normalizeContactPhone } from "./phone";
import { equalStrings, hmacHex } from "./totp";

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type PhoneDatabase = { prepare(sql: string): Statement };

export const CODE_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const RESEND_SECONDS = 60;
export const LIMITS = { userHour: 3, userDay: 10, phoneDay: 5 };

export const PHONE_VERIFICATION_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS phone_verifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,phone TEXT NOT NULL,code_hash TEXT NOT NULL,expires_at TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,verified_at TEXT,created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS phone_verifications_user_idx ON phone_verifications(user_id,created_at)",
  "CREATE INDEX IF NOT EXISTS phone_verifications_phone_idx ON phone_verifications(phone,created_at)",
];

export class PhoneVerificationError extends Error { constructor(message: string, public status = 400, public retryAfter?: number) { super(message); } }

const ready = new WeakMap<object, Promise<unknown>>();
export async function ensurePhoneVerifications(db: PhoneDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = (async () => { for (const sql of PHONE_VERIFICATION_SCHEMA) await db.prepare(sql).run(); })(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}

const iso = (ms: number) => new Date(ms).toISOString();
const codeHash = (secret: string, id: string, phone: string, code: string) => hmacHex("em24-phone-code:" + secret, `${id}:${phone}:${code}`);
// Uniform 6-digit code (rejection sampling avoids modulo bias).
export function generateCode() {
  const buffer = new Uint32Array(1);
  for (;;) { crypto.getRandomValues(buffer); if (buffer[0] < 4_294_000_000) return String(buffer[0] % 1_000_000).padStart(6, "0"); }
}
export const smsText = (code: string) => `estatemarket24 kodunuz / your code: ${code}. ${CODE_MINUTES} dk gecerli / valid ${CODE_MINUTES} min. Kimseyle paylasmayin.`;

type Count = { n: number | string; last: string | null };
export async function sendPhoneCode(db: PhoneDatabase, input: { userId: string; phone: unknown; secret: string; send: (to: string, text: string) => Promise<void>; nowMs?: number }) {
  await ensurePhoneVerifications(db);
  const nowMs = input.nowMs ?? Date.now(), phone = normalizeContactPhone(input.phone);
  if (!phone) throw new PhoneVerificationError("Telefonu ülke koduyla girin. Örnek: +905551112233.");
  const userId = String(input.userId), hourAgo = iso(nowMs - 3600_000), dayAgo = iso(nowMs - 86400_000);
  const userDay = await db.prepare("SELECT COUNT(*) AS n,MAX(created_at) AS last FROM phone_verifications WHERE user_id=? AND created_at>?").bind(userId, dayAgo).first<Count>();
  if (userDay?.last && Date.parse(userDay.last) > nowMs - RESEND_SECONDS * 1000) {
    const wait = Math.ceil((Date.parse(userDay.last) + RESEND_SECONDS * 1000 - nowMs) / 1000);
    throw new PhoneVerificationError("Yeni kod istemeden önce biraz bekleyin.", 429, wait);
  }
  if (Number(userDay?.n || 0) >= LIMITS.userDay) throw new PhoneVerificationError("Bugün için kod gönderme sınırına ulaştınız. Yarın tekrar deneyin.", 429);
  const userHour = await db.prepare("SELECT COUNT(*) AS n FROM phone_verifications WHERE user_id=? AND created_at>?").bind(userId, hourAgo).first<Count>();
  if (Number(userHour?.n || 0) >= LIMITS.userHour) throw new PhoneVerificationError("Çok fazla kod istendi. Bir saat sonra tekrar deneyin.", 429);
  const phoneDay = await db.prepare("SELECT COUNT(*) AS n FROM phone_verifications WHERE phone=? AND created_at>?").bind(phone, dayAgo).first<Count>();
  if (Number(phoneDay?.n || 0) >= LIMITS.phoneDay) throw new PhoneVerificationError("Bu numaraya bugün çok fazla kod gönderildi. Yarın tekrar deneyin.", 429);

  const id = crypto.randomUUID(), code = generateCode(), now = iso(nowMs);
  // Only the newest code is valid.
  await db.prepare("UPDATE phone_verifications SET expires_at=? WHERE user_id=? AND verified_at IS NULL AND expires_at>?").bind(now, userId, now).run();
  await db.prepare("INSERT INTO phone_verifications(id,user_id,phone,code_hash,expires_at,attempts,verified_at,created_at) VALUES(?,?,?,?,?,0,NULL,?)")
    .bind(id, userId, phone, await codeHash(input.secret, id, phone, code), iso(nowMs + CODE_MINUTES * 60_000), now).run();
  try { await input.send(phone, smsText(code)); }
  catch {
    // The row still counts toward the limits; it just can no longer be used.
    await db.prepare("UPDATE phone_verifications SET expires_at=? WHERE id=?").bind(now, id).run();
    throw new PhoneVerificationError("SMS gönderilemedi. Daha sonra tekrar deneyin.", 502);
  }
  return { phone, expiresAt: iso(nowMs + CODE_MINUTES * 60_000), resendAfter: RESEND_SECONDS };
}

// Returns the verified phone number. The caller stores it as the user's phone.
export async function verifyPhoneCode(db: PhoneDatabase, input: { userId: string; code: unknown; secret: string; nowMs?: number }) {
  await ensurePhoneVerifications(db);
  const nowMs = input.nowMs ?? Date.now(), now = iso(nowMs), code = typeof input.code === "string" ? input.code.replace(/\s/g, "") : "";
  if (!/^\d{6}$/.test(code)) throw new PhoneVerificationError("Kod 6 haneli olmalıdır.");
  const row = await db.prepare("SELECT id,phone,code_hash FROM phone_verifications WHERE user_id=? AND verified_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1")
    .bind(String(input.userId), now).first<{ id: string; phone: string; code_hash: string }>();
  if (!row) throw new PhoneVerificationError("Geçerli bir kod yok. Yeni kod isteyin.", 410);
  // Count the attempt before comparing, atomically, so parallel guesses cannot exceed the limit.
  const counted = await db.prepare("UPDATE phone_verifications SET attempts=attempts+1 WHERE id=? AND attempts<? RETURNING attempts").bind(row.id, MAX_ATTEMPTS).first<{ attempts: number }>();
  if (!counted) throw new PhoneVerificationError("Çok fazla hatalı deneme. Yeni kod isteyin.", 429);
  if (!equalStrings(row.code_hash, await codeHash(input.secret, row.id, row.phone, code))) throw new PhoneVerificationError("Kod hatalı.");
  const done = await db.prepare("UPDATE phone_verifications SET verified_at=? WHERE id=? AND verified_at IS NULL AND expires_at>? RETURNING phone").bind(now, row.id, now).first<{ phone: string }>();
  if (!done) throw new PhoneVerificationError("Geçerli bir kod yok. Yeni kod isteyin.", 410);
  return done.phone;
}

export async function phoneVerified(db: PhoneDatabase, userId: string, phone: string | null | undefined) {
  if (!phone) return false;
  await ensurePhoneVerifications(db);
  return Boolean(await db.prepare("SELECT 1 AS ok FROM phone_verifications WHERE user_id=? AND phone=? AND verified_at IS NOT NULL LIMIT 1").bind(String(userId), phone).first());
}

// For badges on cards or profiles later: the ids among `users` whose current phone is verified.
export async function verifiedPhoneUserIds(db: PhoneDatabase, users: { id: string; phone?: string | null }[]) {
  const withPhone = users.filter((user) => user.phone).slice(0, 200);
  if (!withPhone.length) return new Set<string>();
  await ensurePhoneVerifications(db);
  const rows = await db.prepare(`SELECT DISTINCT user_id,phone FROM phone_verifications WHERE verified_at IS NOT NULL AND user_id IN (${withPhone.map(() => "?").join(",")})`)
    .bind(...withPhone.map((user) => String(user.id))).all<{ user_id: string; phone: string }>();
  const current = new Map(withPhone.map((user) => [String(user.id), user.phone]));
  return new Set(rows.results.filter((row) => current.get(String(row.user_id)) === row.phone).map((row) => String(row.user_id)));
}
