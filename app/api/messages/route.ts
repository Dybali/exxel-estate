import { body, currentUser, db, error, listingById, now, ok, sameOrigin, str } from "@/lib/server";

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  const params = new URL(request.url).searchParams;
  const listingId = str(params.get("listingId"), 80);
  const peerId = str(params.get("peerId"), 80);

  if (listingId || peerId) {
    if (!listingId || !peerId || peerId === user.id) return error("Görüşme seçimi geçersiz.");
    const rows = await db().prepare(
      "SELECT id,listing_id,sender_id,recipient_id,body,created_at FROM messages WHERE listing_id=? AND recipient_id IS NOT NULL AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)) ORDER BY created_at DESC,id DESC LIMIT 100"
    ).bind(listingId, user.id, peerId, peerId, user.id).all();
    const messages = (rows.results || []).reverse();
    return ok({ messages }, { headers: { "Cache-Control": "no-store" } });
  }

  const rows = await db().prepare(`
    WITH ranked AS (
      SELECT m.id,m.listing_id,m.sender_id,m.recipient_id,m.body,m.created_at,
        CASE WHEN m.sender_id=? THEN m.recipient_id ELSE m.sender_id END AS peer_id,
        ROW_NUMBER() OVER (
          PARTITION BY m.listing_id,CASE WHEN m.sender_id=? THEN m.recipient_id ELSE m.sender_id END
          ORDER BY m.created_at DESC,m.id DESC
        ) AS position
      FROM messages m
      WHERE (m.sender_id=? OR m.recipient_id=?) AND m.recipient_id IS NOT NULL
    )
    SELECT ranked.id,ranked.listing_id,ranked.sender_id,ranked.peer_id,
      ranked.body AS last_body,ranked.created_at AS last_at,
      COALESCE(u.name,'Üye') AS peer_name,
      COALESCE(l.title,'İlan artık yayında değil') AS listing_title,
      l.status AS listing_status
    FROM ranked
    LEFT JOIN users u ON u.id=ranked.peer_id
    LEFT JOIN listings l ON CAST(l.id AS TEXT)=ranked.listing_id
    WHERE ranked.position=1
    ORDER BY ranked.created_at DESC,ranked.id DESC
    LIMIT 100
  `).bind(user.id, user.id, user.id, user.id).all();
  return ok({ conversations: rows.results || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!user) return error("İlan sahibine yazmak için giriş yapın.", 401);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  const listingId = str(data.listingId, 80);
  const message = str(data.message, 2000);
  const peerId = str(data.peerId, 80);
  if (message.length < 2) return error("Mesaj en az 2 karakter olmalı.");
  const listing = await listingById(listingId);
  if (!listing || listing.source !== "user" || !listing.ownerId) return error("Bu ilan için gerçek bir ilan sahibi bulunamadı.", 404);

  let recipientId: string;
  if (listing.ownerId === user.id) {
    if (!peerId || peerId === user.id) return error("Yanıtlanacak görüşmeyi seçin.");
    const first = await db().prepare(
      "SELECT id FROM messages WHERE listing_id=? AND sender_id=? AND recipient_id=? LIMIT 1"
    ).bind(listingId, peerId, user.id).first();
    if (!first) return error("Bu üyeyle ilan görüşmeniz bulunamadı.", 403);
    recipientId = peerId;
  } else {
    if (peerId && peerId !== listing.ownerId) return error("Bu ilan için görüşme seçimi geçersiz.", 403);
    const existing = await db().prepare(
      "SELECT id FROM messages WHERE listing_id=? AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)) LIMIT 1"
    ).bind(listingId, user.id, listing.ownerId, listing.ownerId, user.id).first();
    if (listing.status !== "published" && !existing) return error("İlan şu anda yayında değil.", 403);
    recipientId = listing.ownerId;
  }

  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const recent = await db().prepare("SELECT count(*) AS total FROM messages WHERE sender_id=? AND created_at>?")
    .bind(user.id, minuteAgo).first<{ total: number }>();
  if (Number(recent?.total || 0) >= 10) return error("Çok sık mesaj gönderiyorsunuz. Bir dakika sonra tekrar deneyin.", 429);

  const id = crypto.randomUUID();
  const createdAt = now();
  await db().prepare("INSERT INTO messages(id,listing_id,sender_id,recipient_id,body,created_at) VALUES(?,?,?,?,?,?)")
    .bind(id, listingId, user.id, recipientId, message, createdAt).run();
  return ok({ id, listingId, peerId: recipientId, createdAt }, { status: 201 });
}
