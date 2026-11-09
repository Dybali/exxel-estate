// One-time e-mail codes for e-mail verification and password reset (docs/auth.md). Our own system
// over the existing e-mail transport (lib/email.ts); it replaced Neon Auth's e-mail OTP.
// Codes are 6 digits, stored only as an HMAC-SHA256 with a server secret, valid for 15 minutes and
// 5 attempts, single use, and only the newest code per (e-mail, purpose) is valid. Table email_codes
// is created on first use. The database and secret are passed in, so this module is tested with
// node:sqlite (tests/email-codes.test.mjs).
import { equalStrings, hmacHex } from "./totp";

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type EmailCodeDatabase = { prepare(sql: string): Statement };

export const EMAIL_CODE_MINUTES = 15;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;
export const EMAIL_CODE_RESEND_SECONDS = 60;
export const EMAIL_CODE_PURPOSES = ["verify", "reset"] as const;
export type EmailCodePurpose = typeof EMAIL_CODE_PURPOSES[number];
export const isEmailCodePurpose = (value: unknown): value is EmailCodePurpose => EMAIL_CODE_PURPOSES.includes(value as EmailCodePurpose);

export const EMAIL_CODE_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS email_codes(id TEXT PRIMARY KEY,email TEXT NOT NULL,purpose TEXT NOT NULL,user_id TEXT,code_hash TEXT NOT NULL,expires_at TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,consumed_at TEXT,created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS email_codes_lookup_idx ON email_codes(email,purpose,created_at)",
  "CREATE INDEX IF NOT EXISTS email_codes_created_idx ON email_codes(created_at)",
];

export class EmailCodeError extends Error { constructor(message: string, public status = 400, public retryAfter?: number) { super(message); } }

const ready = new WeakMap<object, Promise<unknown>>();
export async function ensureEmailCodes(db: EmailCodeDatabase) {
  let promise = ready.get(db);
  if (!promise) {
    promise = (async () => { for (const sql of EMAIL_CODE_SCHEMA) await db.prepare(sql).run(); })();
    ready.set(db, promise); promise.catch(() => ready.delete(db));
  }
  await promise;
}

const iso = (ms: number) => new Date(ms).toISOString();
export const normalizeCodeEmail = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
// The row id, purpose and e-mail are part of the MAC, so a hash cannot be replayed for another row.
const codeHash = (secret: string, id: string, purpose: string, email: string, code: string) => hmacHex("em24-email-code:" + secret, `${id}:${purpose}:${email}:${code}`);
// Uniform 6-digit code (rejection sampling avoids modulo bias).
export function generateEmailCode() {
  const buffer = new Uint32Array(1);
  for (;;) { crypto.getRandomValues(buffer); if (buffer[0] < 4_294_000_000) return String(buffer[0] % 1_000_000).padStart(6, "0"); }
}

export type IssueInput = { email: string; purpose: EmailCodePurpose; userId: string | null; secret: string; nowMs?: number };
// Returns the plaintext code for the e-mail only; it is never stored or logged.
// Throws EmailCodeError(429, retryAfter) while the previous code for this address is younger than 60 s.
export async function issueEmailCode(db: EmailCodeDatabase, input: IssueInput) {
  await ensureEmailCodes(db);
  const nowMs = input.nowMs ?? Date.now(), now = iso(nowMs), email = normalizeCodeEmail(input.email);
  if (!isEmailCodePurpose(input.purpose) || !email) throw new EmailCodeError("Geçersiz işlem.");
  const last = await db.prepare("SELECT MAX(created_at) AS last FROM email_codes WHERE email=? AND purpose=?").bind(email, input.purpose).first<{ last: string | null }>();
  if (last?.last && Date.parse(last.last) > nowMs - EMAIL_CODE_RESEND_SECONDS * 1000) {
    const wait = Math.max(1, Math.ceil((Date.parse(last.last) + EMAIL_CODE_RESEND_SECONDS * 1000 - nowMs) / 1000));
    throw new EmailCodeError("Yeni kod istemeden önce biraz bekleyin.", 429, wait);
  }
  // Housekeeping: rows older than a day are no longer needed (the cooldown looks back 60 s).
  await db.prepare("DELETE FROM email_codes WHERE created_at<?").bind(iso(nowMs - 86400_000)).run();
  // Only the newest code is valid.
  await db.prepare("UPDATE email_codes SET expires_at=? WHERE email=? AND purpose=? AND consumed_at IS NULL AND expires_at>?").bind(now, email, input.purpose, now).run();
  const id = crypto.randomUUID(), code = generateEmailCode(), expiresAt = iso(nowMs + EMAIL_CODE_MINUTES * 60_000);
  await db.prepare("INSERT INTO email_codes(id,email,purpose,user_id,code_hash,expires_at,attempts,consumed_at,created_at) VALUES(?,?,?,?,?,?,0,NULL,?)")
    .bind(id, email, input.purpose, input.userId == null ? null : String(input.userId), await codeHash(input.secret, id, input.purpose, email, code), expiresAt, now).run();
  return { id, code, expiresAt };
}

// Makes a code unusable, e.g. when its e-mail could not be sent. The row still counts for the cooldown.
export async function revokeEmailCode(db: EmailCodeDatabase, id: string, nowMs = Date.now()) {
  await db.prepare("UPDATE email_codes SET expires_at=? WHERE id=?").bind(iso(nowMs), id).run();
}

export const INVALID_CODE = "Kod geçersiz veya süresi dolmuş. Yeni bir kod isteyin.";
export const TOO_MANY_ATTEMPTS = "Çok fazla hatalı deneme. Yeni kod isteyin.";

export type VerifyInput = { email: string; purpose: EmailCodePurpose; code: unknown; secret: string; nowMs?: number };
// Checks and consumes the newest active code. Returns the user id stored when the code was issued.
export async function consumeEmailCode(db: EmailCodeDatabase, input: VerifyInput) {
  await ensureEmailCodes(db);
  const nowMs = input.nowMs ?? Date.now(), now = iso(nowMs), email = normalizeCodeEmail(input.email);
  const code = typeof input.code === "string" ? input.code.replace(/\s/g, "") : "";
  if (!/^\d{6}$/.test(code)) throw new EmailCodeError("E-postanızdaki 6 haneli kodu girin.");
  if (!isEmailCodePurpose(input.purpose) || !email) throw new EmailCodeError("Geçersiz işlem.");
  const row = await db.prepare("SELECT id,user_id,code_hash FROM email_codes WHERE email=? AND purpose=? AND consumed_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1")
    .bind(email, input.purpose, now).first<{ id: string; user_id: string | null; code_hash: string }>();
  if (!row) throw new EmailCodeError(INVALID_CODE);
  // Count the attempt before comparing, atomically, so parallel guesses cannot exceed the limit.
  const counted = await db.prepare("UPDATE email_codes SET attempts=attempts+1 WHERE id=? AND attempts<? RETURNING attempts").bind(row.id, EMAIL_CODE_MAX_ATTEMPTS).first<{ attempts: number | string }>();
  if (!counted) { await revokeEmailCode(db, row.id, nowMs); throw new EmailCodeError(TOO_MANY_ATTEMPTS, 429); }
  if (!equalStrings(row.code_hash, await codeHash(input.secret, row.id, input.purpose, email, code))) {
    if (Number(counted.attempts) >= EMAIL_CODE_MAX_ATTEMPTS) { await revokeEmailCode(db, row.id, nowMs); throw new EmailCodeError(TOO_MANY_ATTEMPTS, 429); }
    throw new EmailCodeError(INVALID_CODE);
  }
  const done = await db.prepare("UPDATE email_codes SET consumed_at=? WHERE id=? AND consumed_at IS NULL AND expires_at>? RETURNING user_id").bind(now, row.id, now).first<{ user_id: string | null }>();
  if (!done) throw new EmailCodeError(INVALID_CODE);
  return { userId: done.user_id == null ? null : String(done.user_id) };
}
