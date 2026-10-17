import { body, currentUser, db, error, isAdmin, now, ok, parseListing, sameOrigin, str } from "@/lib/server";

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!isAdmin(user)) return error("Yönetici yetkisi gerekli.", 403);
  const listingId = str(new URL(request.url).searchParams.get("listingId"), 80);
  if (listingId) {
    const row = await db().prepare(
      "SELECT l.*,u.name AS owner_name,u.email AS owner_email,u.role AS owner_role,u.company AS owner_company FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=?"
    ).bind(listingId).first<Record<string, unknown>>();
    if (!row) return error("İlan bulunamadı.", 404);
    return ok({
      listing: parseListing(row),
      owner: { name: row.owner_name, email: row.owner_email, role: row.owner_role, company: row.owner_company },
    }, { headers: { "Cache-Control": "no-store" } });
  }
  const requestedPage = Number(new URL(request.url).searchParams.get("page") || 1);
  const page = Number.isInteger(requestedPage) ? Math.min(1000, Math.max(1, requestedPage)) : 1;
  const pageSize = 50;
  const [users, listings, listingCounts, messages, countries] = await Promise.all([
    db().prepare("SELECT id,email,name,role,agent_status,company,created_at FROM users ORDER BY created_at DESC LIMIT 200").all(),
    db().prepare("SELECT l.id,l.title,l.city,l.district,l.neighborhood,l.price,l.currency,l.status,l.owner_id,l.created_at,u.name AS owner_name FROM listings l JOIN users u ON u.id=l.owner_id ORDER BY CASE l.status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,l.created_at DESC LIMIT ? OFFSET ?").bind(pageSize, (page - 1) * pageSize).all(),
    db().prepare("SELECT count(*) AS total,sum(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending FROM listings").first<{ total: number; pending: number | null }>(),
    db().prepare("SELECT id,listing_id,sender_id,body,created_at FROM messages WHERE recipient_id IS NULL ORDER BY created_at DESC LIMIT 100").all(),
    db().prepare("SELECT country_code,locale,legal_text,payment_provider,enabled FROM country_settings ORDER BY country_code").all(),
  ]);
  return ok({ users: users.results || [], listings: listings.results || [], listingTotal: Number(listingCounts?.total || 0), pendingTotal: Number(listingCounts?.pending || 0), page, pageSize, messages: messages.results || [], countries: countries.results || [] },
    { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!isAdmin(user)) return error("Yönetici yetkisi gerekli.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  const kind = str(data.kind, 20), id = str(data.id, 80), status = str(data.status, 20);
  if (kind === "listing" && ["published", "rejected", "pending"].includes(status)) {
    const note = str(data.note, 1000);
    if (status === "rejected" && note.length < 5) return error("Ret nedenini en az 5 karakterle yazın.");
    const current = await db().prepare("SELECT status FROM listings WHERE id=?").bind(id).first<{ status: string }>();
    if (!current) return error("İlan bulunamadı.", 404);
    if (current.status === status) return error("İlan zaten bu durumda.", 409);
    await db().prepare("UPDATE listings SET status=?,review_note=?,reviewed_by=?,reviewed_at=?,updated_at=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,?) ELSE published_at END WHERE id=?")
      .bind(status, status === "pending" ? null : note || null, user!.id, now(), now(),status,now(), id).run();
    return ok({ success: true, status });
  }
  if (kind === "agent" && ["approved", "rejected", "pending"].includes(status)) {
    if (status === "approved") {
      const applicant = await db().prepare("SELECT company FROM users WHERE id=? AND role='agent'").bind(id).first<{ company: string | null }>();
      if (!applicant?.company?.trim()) return error("Emlakçı onayı için ofis veya şirket adı gerekli.");
    }
    await db().batch([
      db().prepare("UPDATE users SET agent_status=? WHERE id=? AND role='agent'").bind(status, id),
      db().prepare("UPDATE agencies SET status=? WHERE owner_id=?").bind(status, id),
    ]);
    return ok({ success: true });
  }
  if (kind === "country") {
    const countryCode = str(data.countryCode, 2).toUpperCase(), locale = str(data.locale, 10), legalText = str(data.legalText, 10000), paymentProvider = str(data.paymentProvider, 80);
    if (!/^[A-Z]{2}$/.test(countryCode) || !/^[a-z]{2}(-[A-Z]{2})?$/.test(locale)) return error("Ülke ve dil kodlarını kontrol edin.");
    await db().prepare("INSERT INTO country_settings(country_code,locale,legal_text,payment_provider,enabled) VALUES(?,?,?,?,?) ON CONFLICT(country_code) DO UPDATE SET locale=excluded.locale,legal_text=excluded.legal_text,payment_provider=excluded.payment_provider,enabled=excluded.enabled")
      .bind(countryCode, locale, legalText, paymentProvider || null, data.enabled ? 1 : 0).run();
    return ok({ success: true });
  }
  return error("Geçersiz yönetim işlemi.");
}
