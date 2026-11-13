// Account types (owner's decision 2026-11-13): Bireysel, Emlakçı, Müteahhit and Hizmet firması each get their own
// Hesabım panel, and one account is one type: a real-estate agent cannot also run a contractor or service firm.
// users.role keeps its old values (buyer / individual / agent / admin; a database CHECK allows only these), so the
// two firm types live in their own table, created on first use. Accounts from before this table are inferred from
// the firm they already own. Works on PostgreSQL and SQLite.
type Statement = { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown> };
export type KindDatabase = { prepare(sql: string): Statement };

export const ACCOUNT_KINDS = ["individual", "agent", "contractor", "service"] as const;
export type AccountKind = typeof ACCOUNT_KINDS[number];
/** Types an account can be registered as or switched to without the agent verification flow. */
export const FIRM_KINDS = ["contractor", "service"] as const;
export type FirmKind = typeof FIRM_KINDS[number];
export const isFirmKind = (value: unknown): value is FirmKind => value === "contractor" || value === "service";

const SCHEMA = "CREATE TABLE IF NOT EXISTS account_kinds(user_id TEXT PRIMARY KEY,kind TEXT NOT NULL,updated_at TEXT NOT NULL)";
const ready = new WeakMap<object, Promise<unknown>>();
async function ensure(db: KindDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = db.prepare(SCHEMA).bind().run(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}
const exists = async (db: KindDatabase, table: string, userId: string) => {
  try { return Boolean(await db.prepare(`SELECT id FROM ${table} WHERE owner_id=? LIMIT 1`).bind(userId).first()); }
  catch { return false; } // The firm tables are created on first use; a missing table means no firm.
};

/** The account's type: agents by their role, firms by account_kinds or (older accounts) the firm they own, else individual. */
export async function accountKind(db: KindDatabase, user: { id: string; role: string }): Promise<AccountKind> {
  if (user.role === "agent") return "agent";
  if (user.role === "admin") return "individual";
  await ensure(db);
  const row = await db.prepare("SELECT kind FROM account_kinds WHERE user_id=?").bind(user.id).first<{ kind: string }>();
  if (isFirmKind(row?.kind)) return row!.kind as FirmKind;
  if (await exists(db, "contractor_firms", user.id)) return "contractor";
  if (await exists(db, "service_firms", user.id)) return "service";
  return "individual";
}

export class AccountKindError extends Error { constructor(message: string, public status = 400) { super(message); } }

/**
 * Sets a non-agent account to a firm type or back to individual. Refused for agents and admins, and while the account
 * still owns a firm of the other type (its public profile would otherwise stay without a panel to manage it).
 */
export async function setAccountKind(db: KindDatabase, user: { id: string; role: string }, kind: unknown, at = new Date().toISOString()) {
  if (user.role === "agent") throw new AccountKindError("Emlakçı hesabı müteahhit veya hizmet firması hesabına çevrilemez.", 409);
  if (user.role === "admin") throw new AccountKindError("Yönetici hesabı değiştirilemez.", 403);
  if (kind !== "individual" && !isFirmKind(kind)) throw new AccountKindError("Geçerli bir hesap türü seçin.");
  await ensure(db);
  if (kind !== "contractor" && await exists(db, "contractor_firms", user.id)) throw new AccountKindError("Önce müteahhit firma profilinizi silin.", 409);
  if (kind !== "service" && await exists(db, "service_firms", user.id)) throw new AccountKindError("Önce hizmet firmanızı silin.", 409);
  if (kind === "individual") await db.prepare("DELETE FROM account_kinds WHERE user_id=?").bind(user.id).run();
  else await db.prepare("INSERT INTO account_kinds(user_id,kind,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET kind=excluded.kind,updated_at=excluded.updated_at").bind(user.id, kind, at).run();
  return kind as AccountKind;
}

/** Firm APIs: only a contractor account may open a contractor firm, only a service account a service firm. */
export async function firmAllowed(db: KindDatabase, user: { id: string; role: string }, firm: FirmKind) {
  return (await accountKind(db, user)) === firm;
}
export const firmRefusal = (firm: FirmKind) => firm === "contractor"
  ? "Müteahhit firma profili yalnızca müteahhit hesaplarıyla açılabilir. Hesap türünüzü Profilim bölümünden değiştirebilirsiniz."
  : "Hizmet firması yalnızca hizmet firması hesaplarıyla açılabilir. Hesap türünüzü Profilim bölümünden değiştirebilirsiniz.";
