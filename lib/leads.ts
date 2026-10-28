// Inbound enquiries for a listing owner: one lead per (listing, contact) message thread,
// with the owner's private stage and note. Stages match appointments (lib/appointments.ts).
interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type LeadDatabase = { prepare(sql: string): Statement };

export const LEAD_STAGES = ["new", "contacted", "viewing", "offer", "closed"] as const;
export type LeadStage = typeof LEAD_STAGES[number];
export const LEAD_SCHEMA = "CREATE TABLE IF NOT EXISTS lead_notes(owner_id TEXT NOT NULL,listing_id TEXT NOT NULL,contact_id TEXT NOT NULL,stage TEXT NOT NULL DEFAULT 'new',private_note TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,PRIMARY KEY(owner_id,listing_id,contact_id))";

export class LeadError extends Error { constructor(message: string, public status = 400) { super(message); } }

const ready = new WeakMap<object, Promise<unknown>>();
async function ensure(db: LeadDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = db.prepare(LEAD_SCHEMA).run(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}

export type Lead = { listingId: string; listingTitle: string; contactId: string; contactName: string; messages: number; firstAt: string; lastAt: string; stage: LeadStage; note: string };

export async function ownerLeads(db: LeadDatabase, ownerId: string): Promise<Lead[]> {
  await ensure(db);
  const [threads, notes] = await Promise.all([
    db.prepare("SELECT m.listing_id, CAST(m.sender_id AS TEXT) AS contact_id, u.name AS contact_name, l.title AS listing_title, COUNT(*) AS messages, MIN(m.created_at) AS first_at, MAX(m.created_at) AS last_at FROM messages m JOIN listings l ON CAST(l.id AS TEXT)=m.listing_id JOIN users u ON u.id=m.sender_id WHERE m.recipient_id=? AND m.sender_id<>? AND l.owner_id=? GROUP BY m.listing_id, m.sender_id, u.name, l.title ORDER BY MAX(m.created_at) DESC LIMIT 200")
      .bind(ownerId, ownerId, ownerId).all<{ listing_id: string; contact_id: string; contact_name: string; listing_title: string; messages: number; first_at: string; last_at: string }>(),
    db.prepare("SELECT listing_id, contact_id, stage, private_note FROM lead_notes WHERE owner_id=?").bind(ownerId).all<{ listing_id: string; contact_id: string; stage: string; private_note: string }>(),
  ]);
  const byKey = new Map(notes.results.map((row) => [`${row.listing_id}:${row.contact_id}`, row]));
  return threads.results.map((row) => {
    const note = byKey.get(`${row.listing_id}:${row.contact_id}`);
    return {
      listingId: String(row.listing_id), listingTitle: String(row.listing_title), contactId: String(row.contact_id), contactName: String(row.contact_name),
      messages: Number(row.messages), firstAt: String(row.first_at), lastAt: String(row.last_at),
      stage: (LEAD_STAGES as readonly string[]).includes(note?.stage || "") ? note!.stage as LeadStage : "new", note: note?.private_note || "",
    };
  });
}

export async function updateLead(db: LeadDatabase, ownerId: string, input: Record<string, unknown>, at = new Date()) {
  const listingId = typeof input.listingId === "string" ? input.listingId : "", contactId = typeof input.contactId === "string" ? input.contactId : "";
  const stage = typeof input.stage === "string" ? input.stage : "", note = typeof input.note === "string" ? input.note.trim() : "";
  if (!listingId || listingId.length > 80 || !contactId || contactId.length > 80 || !(LEAD_STAGES as readonly string[]).includes(stage) || note.length > 2000) throw new LeadError("Müşteri notunu ve aşamasını kontrol edin.");
  await ensure(db);
  // Only a contact who actually wrote to the owner about their own listing can be tracked.
  const thread = await db.prepare("SELECT 1 AS ok FROM messages m JOIN listings l ON CAST(l.id AS TEXT)=m.listing_id WHERE m.listing_id=? AND CAST(m.sender_id AS TEXT)=? AND m.recipient_id=? AND l.owner_id=? LIMIT 1").bind(listingId, contactId, ownerId, ownerId).first();
  if (!thread) throw new LeadError("Talep bulunamadı.", 404);
  await db.prepare("INSERT INTO lead_notes(owner_id,listing_id,contact_id,stage,private_note,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id,listing_id,contact_id) DO UPDATE SET stage=excluded.stage,private_note=excluded.private_note,updated_at=excluded.updated_at")
    .bind(ownerId, listingId, contactId, stage, note, at.toISOString()).run();
  return { listingId, contactId, stage, note };
}

// Daily views of the owner's listings and the most viewed ones over the last `days` days.
export async function ownerPerformance(db: LeadDatabase, ownerId: string, days = 30, at = new Date()) {
  const since = new Date(at.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const [daily, top] = await Promise.all([
    db.prepare("SELECT v.day, COUNT(*) AS views FROM listing_view_daily v JOIN listings l ON CAST(l.id AS TEXT)=v.listing_id WHERE l.owner_id=? AND v.day>=? GROUP BY v.day ORDER BY v.day").bind(ownerId, since).all<{ day: string; views: number }>(),
    db.prepare("SELECT CAST(l.id AS TEXT) AS id, l.title, COUNT(v.visitor_hash) AS views FROM listings l LEFT JOIN listing_view_daily v ON v.listing_id=CAST(l.id AS TEXT) AND v.day>=? WHERE l.owner_id=? AND l.status='published' GROUP BY l.id, l.title ORDER BY COUNT(v.visitor_hash) DESC LIMIT 5").bind(since, ownerId).all<{ id: string; title: string; views: number }>(),
  ]);
  const counts = new Map(daily.results.map((row) => [String(row.day), Number(row.views)]));
  const series = Array.from({ length: days }, (_, index) => {
    const day = new Date(Date.parse(since + "T00:00:00Z") + index * 86400000).toISOString().slice(0, 10);
    return { day, views: counts.get(day) || 0 };
  });
  return { days, series, top: top.results.map((row) => ({ id: String(row.id), title: String(row.title), views: Number(row.views) })) };
}
