// Administrator two-factor authentication (TOTP). Storage and verification only: the server key
// (ADMIN_TOTP_KEY) and the database are passed in, so this module has no runtime imports and
// is tested with node:sqlite. The table is created on first use.
import { decryptSecret, encryptSecret, equalStrings, generateRecoveryCodes, generateTotpSecret, hmacHex, normalizeRecoveryCode, otpauthUri, verifyTotp } from "./totp";

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type TotpDatabase = { prepare(sql: string): Statement };

export const ADMIN_2FA_COOKIE = "em24_admin_2fa";
export const ADMIN_2FA_HOURS = 12;
export const MAX_FAILURES = 5;
export const FAILURE_WINDOW_MS = 15 * 60_000;
export const MIN_KEY_LENGTH = 32;

export const ADMIN_TOTP_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS admin_totp(user_id TEXT PRIMARY KEY,secret_encrypted TEXT NOT NULL,enabled_at TEXT,last_used_step INTEGER,recovery_codes TEXT NOT NULL DEFAULT '[]',failed_attempts INTEGER NOT NULL DEFAULT 0,failed_window_started_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
];

export class TwoFactorError extends Error { constructor(message: string, public status = 400) { super(message); } }

const ready = new WeakMap<object, Promise<unknown>>();
export async function ensureAdminTotp(db: TotpDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = (async () => { for (const sql of ADMIN_TOTP_SCHEMA) await db.prepare(sql).run(); })(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}

export const usableKey = (key: string | undefined | null) => typeof key === "string" && key.trim().length >= MIN_KEY_LENGTH ? key.trim() : null;
type Row = { user_id: string; secret_encrypted: string; enabled_at: string | null; last_used_step: number | null; recovery_codes: string; failed_attempts: number; failed_window_started_at: string | null };
const iso = (ms: number) => new Date(ms).toISOString();
const context = (userId: string) => "admin_totp:" + userId;
const recoveryHash = (key: string, userId: string, code: string) => hmacHex("em24-admin-recovery:" + key, `${userId}:${normalizeRecoveryCode(code)}`);
const readRow = (db: TotpDatabase, userId: string) => db.prepare("SELECT * FROM admin_totp WHERE user_id=?").bind(userId).first<Row>();

export async function twoFactorStatus(db: TotpDatabase, userId: string) {
  await ensureAdminTotp(db);
  const row = await readRow(db, userId);
  const codes = row?.enabled_at ? JSON.parse(row.recovery_codes || "[]") as string[] : [];
  return { enabled: Boolean(row?.enabled_at), enabledAt: row?.enabled_at || null, recoveryCodesLeft: codes.length };
}

// Starts (or restarts) enrolment: a new secret is stored encrypted but not yet enabled.
export async function startEnrolment(db: TotpDatabase, key: string, userId: string, account: string, nowMs = Date.now()) {
  await ensureAdminTotp(db);
  const existing = await readRow(db, userId);
  if (existing?.enabled_at) throw new TwoFactorError("İki adımlı doğrulama zaten etkin.", 409);
  const secret = generateTotpSecret(), sealed = await encryptSecret(secret, key, context(userId)), time = iso(nowMs);
  await db.prepare("INSERT INTO admin_totp(user_id,secret_encrypted,enabled_at,last_used_step,recovery_codes,failed_attempts,failed_window_started_at,created_at,updated_at) VALUES(?,?,NULL,NULL,'[]',0,NULL,?,?) ON CONFLICT(user_id) DO UPDATE SET secret_encrypted=excluded.secret_encrypted,last_used_step=NULL,recovery_codes='[]',updated_at=excluded.updated_at WHERE admin_totp.enabled_at IS NULL")
    .bind(userId, sealed, time, time).run();
  return { secret, uri: otpauthUri(secret, account) };
}

// Failed attempts are counted per administrator: 5 failures lock the check for 15 minutes.
async function assertNotLocked(row: Row, nowMs: number) {
  if (row.failed_window_started_at && Date.parse(row.failed_window_started_at) > nowMs - FAILURE_WINDOW_MS && Number(row.failed_attempts) >= MAX_FAILURES)
    throw new TwoFactorError("Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.", 429);
}
async function recordFailure(db: TotpDatabase, row: Row, nowMs: number) {
  const fresh = row.failed_window_started_at && Date.parse(row.failed_window_started_at) > nowMs - FAILURE_WINDOW_MS;
  await db.prepare("UPDATE admin_totp SET failed_attempts=?,failed_window_started_at=? WHERE user_id=?")
    .bind(fresh ? Number(row.failed_attempts) + 1 : 1, fresh ? row.failed_window_started_at : iso(nowMs), row.user_id).run();
}

// Claims a time step atomically: a code that was already used (or an older one) is rejected,
// even when two requests race with the same code.
async function claimStep(db: TotpDatabase, userId: string, step: number, enable: boolean, nowMs: number) {
  const sql = enable
    ? "UPDATE admin_totp SET last_used_step=?,enabled_at=?,failed_attempts=0,failed_window_started_at=NULL,updated_at=? WHERE user_id=? AND enabled_at IS NULL AND (last_used_step IS NULL OR last_used_step<?) RETURNING user_id"
    : "UPDATE admin_totp SET last_used_step=?,failed_attempts=0,failed_window_started_at=NULL,updated_at=? WHERE user_id=? AND enabled_at IS NOT NULL AND (last_used_step IS NULL OR last_used_step<?) RETURNING user_id";
  const values = enable ? [step, iso(nowMs), iso(nowMs), userId, step] : [step, iso(nowMs), userId, step];
  return Boolean(await db.prepare(sql).bind(...values).first());
}

export async function confirmEnrolment(db: TotpDatabase, key: string, userId: string, code: string, nowMs = Date.now()) {
  await ensureAdminTotp(db);
  const row = await readRow(db, userId);
  if (!row || row.enabled_at) throw new TwoFactorError("Önce kurulumu başlatın.", 409);
  await assertNotLocked(row, nowMs);
  const step = await verifyTotp(await decryptSecret(row.secret_encrypted, key, context(userId)), code.trim(), nowMs, row.last_used_step == null ? null : Number(row.last_used_step));
  if (step == null || !await claimStep(db, userId, step, true, nowMs)) { await recordFailure(db, row, nowMs); throw new TwoFactorError("Kod hatalı veya süresi doldu."); }
  return { recoveryCodes: await replaceRecoveryCodes(db, key, userId, nowMs) };
}

async function replaceRecoveryCodes(db: TotpDatabase, key: string, userId: string, nowMs: number) {
  const codes = generateRecoveryCodes();
  const hashes = await Promise.all(codes.map((code) => recoveryHash(key, userId, code)));
  await db.prepare("UPDATE admin_totp SET recovery_codes=?,updated_at=? WHERE user_id=?").bind(JSON.stringify(hashes), iso(nowMs), userId).run();
  return codes;
}

// Verifies a 6-digit authenticator code or a one-time recovery code for an enabled account.
export async function verifySecondFactor(db: TotpDatabase, key: string, userId: string, input: string, nowMs = Date.now()): Promise<"totp" | "recovery"> {
  await ensureAdminTotp(db);
  const row = await readRow(db, userId);
  if (!row?.enabled_at) throw new TwoFactorError("İki adımlı doğrulama etkin değil.", 409);
  await assertNotLocked(row, nowMs);
  const code = input.trim().replace(/\s/g, "");
  if (/^\d{6}$/.test(code)) {
    const step = await verifyTotp(await decryptSecret(row.secret_encrypted, key, context(userId)), code, nowMs, row.last_used_step == null ? null : Number(row.last_used_step));
    if (step != null && await claimStep(db, userId, step, false, nowMs)) return "totp";
  } else if (normalizeRecoveryCode(code).length === 10) {
    const hash = await recoveryHash(key, userId, code), list = JSON.parse(row.recovery_codes || "[]") as string[];
    const match = list.find((item) => equalStrings(item, hash));
    if (match) {
      const rest = list.filter((item) => item !== match);
      // Compare-and-swap on the stored list so a recovery code works only once.
      const used = await db.prepare("UPDATE admin_totp SET recovery_codes=?,failed_attempts=0,failed_window_started_at=NULL,updated_at=? WHERE user_id=? AND recovery_codes=? RETURNING user_id")
        .bind(JSON.stringify(rest), iso(nowMs), userId, row.recovery_codes).first();
      if (used) return "recovery";
    }
  }
  await recordFailure(db, row, nowMs);
  throw new TwoFactorError("Kod hatalı veya süresi doldu.");
}

export async function disableTwoFactor(db: TotpDatabase, key: string, userId: string, code: string, nowMs = Date.now()) {
  await verifySecondFactor(db, key, userId, code, nowMs);
  await db.prepare("DELETE FROM admin_totp WHERE user_id=?").bind(userId).run();
}

export async function regenerateRecoveryCodes(db: TotpDatabase, key: string, userId: string, code: string, nowMs = Date.now()) {
  await verifySecondFactor(db, key, userId, code, nowMs);
  return replaceRecoveryCodes(db, key, userId, nowMs);
}

// The confirmation cookie is bound to the login session (hash of the session token) and the
// user, signed with the server key and valid for ADMIN_2FA_HOURS or until the browser closes.
const cookieMessage = (userId: string, sessionHash: string, expires: number) => `admin2fa:${userId}:${sessionHash}:${expires}`;
export async function admin2faCookie(key: string, userId: string, sessionHash: string, nowMs = Date.now()) {
  const expires = Math.floor(nowMs / 1000) + ADMIN_2FA_HOURS * 3600;
  const signature = await hmacHex("em24-admin-2fa-cookie:" + key, cookieMessage(userId, sessionHash, expires));
  return `${ADMIN_2FA_COOKIE}=${expires}.${signature}; HttpOnly; Secure; SameSite=Lax; Path=/`;
}
export const clearAdmin2faCookie = `${ADMIN_2FA_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
export async function validAdmin2faCookie(cookieHeader: string, key: string, userId: string, sessionHash: string, nowMs = Date.now()) {
  const value = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_2FA_COOKIE}=([^;]+)`))?.[1];
  const [expiresText, signature] = (value || "").split(".");
  const expires = Number(expiresText);
  if (!signature || !Number.isSafeInteger(expires) || expires * 1000 <= nowMs || expires * 1000 > nowMs + ADMIN_2FA_HOURS * 3600_000 + 60_000) return false;
  return equalStrings(signature, await hmacHex("em24-admin-2fa-cookie:" + key, cookieMessage(userId, sessionHash, expires)));
}

// True while the current session has not confirmed a second factor. With a usable ADMIN_TOTP_KEY
// 2FA is mandatory: an administrator who has not enrolled yet is also pending and can only reach
// the enrolment screen (/yonetim/guvenlik) until enrolment is confirmed. Without the key the
// feature is off. The database is not needed: only a valid confirmation cookie clears it.
export async function admin2faPending(_database: () => TotpDatabase, userId: string, sessionHash: string, cookieHeader: string, rawKey: string | undefined, nowMs = Date.now()) {
  const key = usableKey(rawKey);
  if (!key) return false;
  return !(await validAdmin2faCookie(cookieHeader, key, userId, sessionHash, nowMs));
}
