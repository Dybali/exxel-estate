// One place for office-document decisions: the admin (Yönetim › Emlakçı başvuruları) and the automatic check
// (lib/office-check.ts, reviewer "system") approve through decideOffice; an approval can later be withdrawn with
// revokeOffice (e.g. when the TTBS lookup does not match). Every write is conditional on a random action token,
// so two reviewers never both win. Works on PostgreSQL and SQLite.
type Statement = { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> };
export type DecisionDatabase = { prepare(sql: string): Statement; batch(statements: unknown[]): Promise<unknown> };
type Actor = { id: string; name: string };
export class OfficeDecisionError extends Error { constructor(message: string, public status = 400) { super(message); } }

/** Approves or rejects a pending document. Returns the listings published with the approval. */
export async function decideOffice(database: DecisionDatabase, input: { userId: string; state: "approved" | "rejected"; note: string; version: number; actor: Actor; summary?: string }, stamp = new Date().toISOString()) {
  const { userId: id, state, note, version, actor } = input;
  const record = await database.prepare("SELECT v.*,u.company,u.role FROM office_verifications v JOIN users u ON CAST(u.id AS TEXT)=v.user_id WHERE v.user_id=?").bind(id).first<{ state: string; version: number; company: string; company_snapshot: string; role: string; document_number: string }>();
  if (!record) throw new OfficeDecisionError("Belge bulunamadı.", 404);
  if (record.state !== "pending" || Number(record.version) !== version) throw new OfficeDecisionError("Belge daha önce incelendi. Listeyi yenileyin.", 409);
  if (record.role !== "agent" || (state === "approved" && record.company !== record.company_snapshot)) throw new OfficeDecisionError("Ofis bilgileri değişmiş. Belgeyi reddedip güncel başvuru isteyin.", 409);
  const action = crypto.randomUUID();
  const pending = state === "approved" ? await database.prepare("SELECT id FROM listings WHERE owner_id=? AND status='pending' AND review_note IS NULL AND (expires_at IS NULL OR expires_at>?) AND NOT EXISTS(SELECT 1 FROM listing_moderation_holds h WHERE h.listing_id=CAST(listings.id AS TEXT) AND h.active=1)").bind(id, stamp).all<{ id: string }>() : { results: [] as { id: string }[] };
  await database.batch([
    database.prepare("UPDATE users SET company=company WHERE CAST(id AS TEXT)=?").bind(id),
    database.prepare("UPDATE office_verifications SET state=?,note=?,version=version+1,reviewer_id=?,reviewed_at=?,updated_at=?,last_action=? WHERE user_id=? AND state='pending' AND version=? AND (?='rejected' OR EXISTS(SELECT 1 FROM users u WHERE CAST(u.id AS TEXT)=office_verifications.user_id AND u.role='agent' AND u.company=office_verifications.company_snapshot))").bind(state, note, actor.id, stamp, stamp, action, id, version, state),
    database.prepare("UPDATE users SET agent_status=? WHERE CAST(id AS TEXT)=? AND EXISTS(SELECT 1 FROM office_verifications WHERE user_id=? AND last_action=?)").bind(state, id, id, action),
    database.prepare("UPDATE agencies SET status=? WHERE CAST(owner_id AS TEXT)=? AND EXISTS(SELECT 1 FROM office_verifications WHERE user_id=? AND last_action=?)").bind(state, id, id, action),
    ...(state === "approved" ? [database.prepare("UPDATE listings SET status='published',published_at=COALESCE(published_at,?),updated_at=?,reviewed_by=?,reviewed_at=? WHERE owner_id=? AND status='pending' AND review_note IS NULL AND (expires_at IS NULL OR expires_at>?) AND NOT EXISTS(SELECT 1 FROM listing_moderation_holds h WHERE h.listing_id=CAST(listings.id AS TEXT) AND h.active=1) AND EXISTS(SELECT 1 FROM office_verifications WHERE user_id=? AND state='approved' AND last_action=?)").bind(stamp, stamp, actor.id, stamp, id, stamp, id, action)] : []),
    database.prepare("INSERT INTO admin_audit(id,actor_id,actor_name,action,target_id,summary,created_at) SELECT ?,?,?,'office_document',?,?,? WHERE EXISTS(SELECT 1 FROM office_verifications WHERE user_id=? AND last_action=?)").bind(crypto.randomUUID(), actor.id, actor.name, id, input.summary || state + " · " + record.document_number + (note ? " · " + note : ""), stamp, id, action),
  ]);
  const saved = await database.prepare("SELECT last_action FROM office_verifications WHERE user_id=?").bind(id).first<{ last_action: string }>();
  if (saved?.last_action !== action) throw new OfficeDecisionError("Belge başka bir yönetici tarafından incelendi.", 409);
  return { published: pending.results.map((row) => String(row.id)) };
}

/** Withdraws an approval: the office is asked for a new document and cannot publish new listings until then. */
export async function revokeOffice(database: DecisionDatabase, userId: string, note: string, actor: Actor, stamp = new Date().toISOString()) {
  if (note.trim().length < 5) throw new OfficeDecisionError("Düzeltme nedenini en az 5 karakterle yazın.");
  const action = crypto.randomUUID();
  await database.batch([
    database.prepare("UPDATE office_verifications SET state='rejected',note=?,version=version+1,reviewer_id=?,reviewed_at=?,updated_at=?,last_action=? WHERE user_id=? AND state='approved'").bind(note, actor.id, stamp, stamp, action, userId),
    database.prepare("UPDATE users SET agent_status='rejected' WHERE CAST(id AS TEXT)=? AND EXISTS(SELECT 1 FROM office_verifications WHERE user_id=? AND last_action=?)").bind(userId, userId, action),
    database.prepare("UPDATE agencies SET status='rejected' WHERE CAST(owner_id AS TEXT)=? AND EXISTS(SELECT 1 FROM office_verifications WHERE user_id=? AND last_action=?)").bind(userId, userId, action),
    database.prepare("INSERT INTO admin_audit(id,actor_id,actor_name,action,target_id,summary,created_at) SELECT ?,?,?,'office_document',?,?,? WHERE EXISTS(SELECT 1 FROM office_verifications WHERE user_id=? AND last_action=?)").bind(crypto.randomUUID(), actor.id, actor.name, userId, "revoked · " + note, stamp, userId, action),
  ]);
  const saved = await database.prepare("SELECT last_action FROM office_verifications WHERE user_id=?").bind(userId).first<{ last_action: string }>();
  if (saved?.last_action !== action) throw new OfficeDecisionError("Belge bulunamadı.", 404);
}
