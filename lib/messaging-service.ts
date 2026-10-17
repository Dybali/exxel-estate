// Shared by the Sites Worker and standalone API. All queries are parameterized.
export type ChatActor = { id: string; admin: boolean };
export interface ChatStatement {
  bind(...values: (string | number | null)[]): ChatStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
// UUID parameter positions keep Prisma's explicitly typed TEXT bindings compatible
// with PostgreSQL UUID columns. The Worker adapter relies on PostgreSQL inference.
export interface ChatDatabase { prepare(sql: string, uuidParameters?: number[]): ChatStatement }
export class ChatError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const RECEIPTS_SCHEMA = `CREATE TABLE IF NOT EXISTS message_receipts (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at text NOT NULL, PRIMARY KEY(message_id,user_id))`;
const initialized = new WeakMap<ChatDatabase, Promise<unknown>>();
export async function ensureMessagingSchema(database: ChatDatabase) {
  if (!initialized.has(database)) initialized.set(database, database.prepare(RECEIPTS_SCHEMA).run().catch((error) => { initialized.delete(database); throw error; }));
  await initialized.get(database);
}
const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
const uuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const supportKey = (admin: string, member: string) => `admin:${admin}:${member}`;
function threadInput(listing: unknown, peer: unknown, user: string) {
  const listingId = text(listing), peerId = text(peer).toLowerCase();
  if (!listingId || listingId.length > 80 || !uuid(peerId) || peerId === user) throw new ChatError("Görüşme seçimi geçersiz.");
  return { listingId, peerId };
}
function pageNumber(value: unknown) {
  const n = Number(value || 1);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 1000) : 1;
}

export async function chatGet(database: ChatDatabase, actor: ChatActor, params: URLSearchParams) {
  if (params.get("directory") === "1") {
    if (!actor.admin) throw new ChatError("Yönetici yetkisi gerekli.", 403);
    const search = text(params.get("q")).slice(0, 100).toLowerCase();
    const role = params.get("role") || "all", page = pageNumber(params.get("page"));
    if (!["all", "agent", "individual", "buyer"].includes(role)) throw new ChatError("Hesap türü geçersiz.");
    const where = `id<>? AND role<>'admin' AND (?='all' OR role=?) AND
      (?='' OR LOWER(name) LIKE ? ESCAPE '!' OR LOWER(email) LIKE ? ESCAPE '!' OR LOWER(COALESCE(company,'')) LIKE ? ESCAPE '!')`;
    const escaped = `%${search.replace(/[!%_]/g, (c) => `!${c}`)}%`;
    const values = [actor.id, role, role, search, escaped, escaped, escaped];
    const users = await database.prepare(`SELECT id,name,email,role,agent_status,company FROM users WHERE ${where} ORDER BY LOWER(name),id LIMIT 26 OFFSET ?`, [0]).bind(...values, (page - 1) * 25).all();
    return { users: users.results.slice(0, 25), hasMore: users.results.length > 25, page };
  }
  await ensureMessagingSchema(database);
  const listing = params.get("listingId"), peer = params.get("peerId");
  if (listing || peer) {
    const { listingId, peerId } = threadInput(listing, peer, actor.id);
    let beforeClause = "";
    const values: (string | number | null)[] = [listingId, actor.id, peerId, peerId, actor.id];
    if (params.get("before")) {
      if (!uuid(text(params.get("before")))) throw new ChatError("Mesaj sayfası geçersiz.");
      const cursor = await database.prepare(`SELECT created_at,id FROM messages WHERE id=? AND listing_id=? AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))`, [0,2,3,4,5])
        .bind(text(params.get("before")), ...values).first<{ created_at: string; id: string }>();
      if (!cursor) throw new ChatError("Mesaj sayfası bulunamadı.", 404);
      beforeClause = "AND (m.created_at<? OR (m.created_at=? AND m.id<?))";
      values.push(cursor.created_at, cursor.created_at, cursor.id);
    }
    const rows = await database.prepare(`SELECT m.id,m.listing_id,m.sender_id,m.recipient_id,m.body,m.created_at,r.read_at
      FROM messages m LEFT JOIN message_receipts r ON r.message_id=m.id AND r.user_id=m.recipient_id
      WHERE m.listing_id=? AND ((m.sender_id=? AND m.recipient_id=?) OR (m.sender_id=? AND m.recipient_id=?)) ${beforeClause}
      ORDER BY m.created_at DESC,m.id DESC LIMIT 51`, [1,2,3,4,...(beforeClause ? [7] : [])]).bind(...values).all();
    return { messages: rows.results.slice(0, 50).reverse(), hasMore: rows.results.length > 50 };
  }
  const page = pageNumber(params.get("page"));
  const rows = await database.prepare(`WITH ranked AS (
    SELECT m.*,CASE WHEN m.sender_id=? THEN m.recipient_id ELSE m.sender_id END AS peer_id,
      ROW_NUMBER() OVER (PARTITION BY m.listing_id,CASE WHEN m.sender_id=? THEN m.recipient_id ELSE m.sender_id END ORDER BY m.created_at DESC,m.id DESC) AS position
    FROM messages m WHERE (m.sender_id=? OR m.recipient_id=?) AND m.recipient_id IS NOT NULL)
    SELECT ranked.id,ranked.listing_id,ranked.sender_id,ranked.peer_id,ranked.body AS last_body,ranked.created_at AS last_at,
      COALESCE(u.name,'Üye') AS peer_name,u.role AS peer_role,u.company AS peer_company,
      CASE WHEN u.whatsapp_enabled=1 THEN u.phone ELSE NULL END AS peer_whatsapp_phone,
      CASE WHEN ranked.listing_id LIKE 'admin:%' THEN 'Sales or rent · Destek' ELSE COALESCE(l.title,'İlan artık mevcut değil') END AS listing_title,
      CASE WHEN ranked.listing_id LIKE 'admin:%' THEN 'support' ELSE l.status END AS listing_status,
      (SELECT COUNT(*) FROM messages unseen WHERE unseen.listing_id=ranked.listing_id AND unseen.sender_id=ranked.peer_id AND unseen.recipient_id=?
        AND NOT EXISTS(SELECT 1 FROM message_receipts mr WHERE mr.message_id=unseen.id AND mr.user_id=?)) AS unread_count
    FROM ranked LEFT JOIN users u ON u.id=ranked.peer_id LEFT JOIN listings l ON CAST(l.id AS TEXT)=ranked.listing_id
    WHERE ranked.position=1 ORDER BY ranked.created_at DESC,ranked.id DESC LIMIT 31 OFFSET ?`, [0,1,2,3,4,5])
    .bind(actor.id, actor.id, actor.id, actor.id, actor.id, actor.id, (page - 1) * 30).all();
  const total = await database.prepare(`SELECT COUNT(*) AS total FROM messages m WHERE m.recipient_id=? AND NOT EXISTS(SELECT 1 FROM message_receipts r WHERE r.message_id=m.id AND r.user_id=?)`, [0,1])
    .bind(actor.id, actor.id).first<{ total: number }>();
  return { conversations: rows.results.slice(0, 30).map(row => ({ ...row, unread_count: Number(row.unread_count || 0) })), hasMore: rows.results.length > 30, page, unreadTotal: Number(total?.total || 0) };
}

export async function chatPost(database: ChatDatabase, actor: ChatActor, data: Record<string, unknown>) {
  await ensureMessagingSchema(database);
  if (data.action === "read") {
    const { listingId, peerId } = threadInput(data.listingId, data.peerId, actor.id);
    const ids = Array.isArray(data.ids) ? [...new Set(data.ids.filter((v): v is string => typeof v === "string" && uuid(v)))].slice(0, 100) : [];
    if (ids.length) await database.prepare(`INSERT INTO message_receipts(message_id,user_id,read_at)
      SELECT id,recipient_id,? FROM messages WHERE listing_id=? AND sender_id=? AND recipient_id=? AND id IN (${ids.map(() => "?").join(",")})
      ON CONFLICT(message_id,user_id) DO NOTHING`, [2,3,...ids.map((_,i)=>i+4)]).bind(new Date().toISOString(), listingId, peerId, actor.id, ...ids).run();
    return { success: true };
  }
  const message = text(data.message);
  if (message.length < 2 || message.length > 2000) throw new ChatError("Mesaj 2–2000 karakter olmalı.");
  let targetPeer = data.peerId;
  if (!text(targetPeer) && text(data.listingId) && !text(data.listingId).startsWith("admin:")) {
    const owner = await database.prepare("SELECT owner_id FROM listings WHERE CAST(id AS TEXT)=?").bind(text(data.listingId)).first<{ owner_id: string }>();
    targetPeer = owner?.owner_id;
  }
  const { listingId, peerId } = threadInput(data.listingId || (actor.admin && uuid(text(targetPeer)) ? supportKey(actor.id, text(targetPeer)) : ""), targetPeer, actor.id);
  let recipientId: string;
  if (listingId.startsWith("admin:")) {
    const peer = await database.prepare("SELECT id FROM users WHERE id=?", [0]).bind(peerId).first();
    if (!peer) throw new ChatError("Alıcı bulunamadı.", 404);
    if (actor.admin && listingId === supportKey(actor.id, peerId)) recipientId = peerId;
    else {
      if (listingId !== supportKey(peerId, actor.id)) throw new ChatError("Bu görüşmeye mesaj gönderemezsiniz.", 403);
      const invitation = await database.prepare("SELECT id FROM messages WHERE listing_id=? AND sender_id=? AND recipient_id=? LIMIT 1", [1,2]).bind(listingId, peerId, actor.id).first();
      if (!invitation) throw new ChatError("Bu görüşmeye mesaj gönderemezsiniz.", 403);
      recipientId = peerId;
    }
  } else {
    const listing = await database.prepare("SELECT owner_id,status FROM listings WHERE CAST(id AS TEXT)=?").bind(listingId).first<{ owner_id: string; status: string }>();
    if (!listing) throw new ChatError("İlan bulunamadı.", 404);
    const existing = await database.prepare("SELECT id FROM messages WHERE listing_id=? AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)) LIMIT 1", [1,2,3,4]).bind(listingId, actor.id, peerId, peerId, actor.id).first();
    if (listing.owner_id === actor.id) {
      if (!existing) throw new ChatError("Bu üyeyle ilan görüşmeniz bulunamadı.", 403);
    } else if (peerId !== listing.owner_id || (listing.status !== "published" && !existing && !actor.admin)) throw new ChatError("Bu ilan için görüşme seçimi geçersiz.", 403);
    recipientId = peerId;
  }
  const suppliedId = text(data.requestId).toLowerCase();
  if (suppliedId && !uuid(suppliedId)) throw new ChatError("Mesaj kimliği geçersiz.");
  const id = suppliedId || crypto.randomUUID();
  const previous = await database.prepare("SELECT id,listing_id,sender_id,recipient_id,body,created_at FROM messages WHERE id=?", [0]).bind(id).first<Record<string, unknown>>();
  const matches = (row: Record<string, unknown>) => row.sender_id === actor.id && row.recipient_id === recipientId && row.listing_id === listingId && row.body === message;
  if (previous) {
    if (!matches(previous)) throw new ChatError("Mesaj kimliği zaten kullanılıyor.", 409);
    return { id, listingId, peerId: recipientId, createdAt: previous.created_at };
  }
  const recent = await database.prepare("SELECT COUNT(*) AS total FROM messages WHERE sender_id=? AND created_at>?", [0]).bind(actor.id, new Date(Date.now() - 60_000).toISOString()).first<{ total: number }>();
  if (Number(recent?.total || 0) >= 10) throw new ChatError("Çok sık mesaj gönderiyorsunuz. Bir dakika sonra tekrar deneyin.", 429);
  const createdAt = new Date().toISOString();
  await database.prepare("INSERT INTO messages(id,listing_id,sender_id,recipient_id,body,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING", [0,2,3]).bind(id, listingId, actor.id, recipientId, message, createdAt).run();
  const persisted = await database.prepare("SELECT id,listing_id,sender_id,recipient_id,body,created_at FROM messages WHERE id=?", [0]).bind(id).first<Record<string, unknown>>();
  if (!persisted || !matches(persisted)) throw new ChatError("Mesaj gönderilemedi.", 409);
  return { id, listingId, peerId: recipientId, createdAt: persisted.created_at };
}



