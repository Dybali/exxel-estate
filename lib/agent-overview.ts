// Hesabım › Genel Bakış for estate agents (owner's request 2026-11-23, in the style of a professional real-estate
// dashboard): one screen with the numbers an agent works with every day. Everything comes from data the site already
// keeps; nothing is estimated or invented (no income or "closed deals": the site does not record sales).
// - performance: crmStats (lib/crm-stats.ts): totals, previous period, daily series, per-listing metrics and score
// - listings: the agent's own listings with price, type, status and days left (expires_at)
// - appointments: upcoming viewing appointments for the agent's listings (requested or confirmed)
// - reminders: customers waiting for an answer, appointment requests to confirm, listings ending within 7 days,
//   drafts, new buyer requests on the request board (Talep akışı)
// - customers: the latest people who wrote about the agent's listings
// SQL runs on PostgreSQL and SQLite. Tests: tests/agent-overview.test.mjs.
import { crmStats, type CrmDatabase } from "./crm-stats";

type Row = Record<string, unknown>;
export type OverviewListing = { id: string; title: string; city: string; district: string; propertyType: string; purpose: string; price: number; currency: string; status: string; photo: string | null; daysLeft: number | null; views: number; contacts: number; favorites: number; score: number };
export type OverviewAppointment = { id: string; listingId: string; listingTitle: string; buyerName: string; slotAt: string; status: string };
export type OverviewCustomer = { listingId: string; listingTitle: string; peerId: string; name: string; lastAt: string; waiting: boolean };
export type Overview = Awaited<ReturnType<typeof agentOverview>>;

const DAY = 86_400_000;
const photoOf = (images: unknown) => { try { const list = JSON.parse(String(images || "[]")); return Array.isArray(list) && typeof list[0] === "string" ? list[0] as string : null; } catch { return null; } };
const safe = <T>(promise: Promise<T>, fallback: T) => promise.catch(() => fallback);

export async function agentOverview(db: CrmDatabase, ownerId: string, days: number, at = new Date(), extra: { newRequests?: () => Promise<number> } = {}) {
  const now = at.toISOString(), week = new Date(at.getTime() + 7 * DAY).toISOString(), fortnight = new Date(at.getTime() + 14 * DAY).toISOString();
  const all = <T = Row>(sql: string, ...values: (string | number)[]) => db.prepare(sql).bind(...values).all<T>().then((r) => r.results || []);
  const one = (sql: string, ...values: (string | number)[]) => db.prepare(sql).bind(...values).first<{ n: number }>().then((r) => Number(r?.n) || 0);
  const [stats, rows, appointments, pendingAppointments, drafts, customers, newRequests] = await Promise.all([
    crmStats(db, ownerId, days, at),
    all("SELECT CAST(id AS TEXT) AS id,title,city,district,property_type,purpose,price,currency,status,images,expires_at FROM listings WHERE owner_id=? AND status IN ('published','pending','expired','draft','rejected') ORDER BY updated_at DESC LIMIT 200", ownerId),
    safe(all("SELECT CAST(a.id AS TEXT) AS id,CAST(a.listing_id AS TEXT) AS listing_id,a.slot_at,a.status,l.title AS listing_title,b.name AS buyer_name FROM appointments a JOIN listings l ON l.id=a.listing_id JOIN users b ON b.id=a.buyer_id WHERE a.seller_id=? AND a.status IN ('requested','confirmed') AND a.slot_at>=? AND a.slot_at<? ORDER BY a.slot_at ASC LIMIT 30", ownerId, now.slice(0, 10), fortnight), []),
    safe(one("SELECT COUNT(*) AS n FROM appointments WHERE seller_id=? AND status='requested' AND slot_at>=?", ownerId, now), 0),
    safe(one("SELECT COUNT(*) AS n FROM listings WHERE owner_id=? AND status='draft'", ownerId), 0),
    // The last message of each conversation someone started about one of the agent's listings.
    safe(all("SELECT t.listing_id,t.peer_id,t.last_at,l.title AS listing_title,u.name AS peer_name,(SELECT CAST(m2.sender_id AS TEXT) FROM messages m2 WHERE m2.listing_id=t.listing_id AND ((CAST(m2.sender_id AS TEXT)=t.peer_id AND CAST(m2.recipient_id AS TEXT)=?) OR (CAST(m2.sender_id AS TEXT)=? AND CAST(m2.recipient_id AS TEXT)=t.peer_id)) ORDER BY m2.created_at DESC LIMIT 1) AS last_sender FROM (SELECT m.listing_id,CAST(m.sender_id AS TEXT) AS peer_id,MAX(m.created_at) AS last_at FROM messages m JOIN listings ml ON CAST(ml.id AS TEXT)=m.listing_id WHERE ml.owner_id=? AND CAST(m.recipient_id AS TEXT)=? AND CAST(m.sender_id AS TEXT)<>? GROUP BY m.listing_id,CAST(m.sender_id AS TEXT)) t JOIN listings l ON CAST(l.id AS TEXT)=t.listing_id JOIN users u ON CAST(u.id AS TEXT)=t.peer_id ORDER BY t.last_at DESC LIMIT 6", ownerId, ownerId, ownerId, ownerId, ownerId), []),
    safe(extra.newRequests ? extra.newRequests() : Promise.resolve(0), 0),
  ]);
  const metrics = new Map(stats.listings.map((row) => [row.id, row]));
  const listings: OverviewListing[] = rows.map((row) => {
    const id = String(row.id), m = metrics.get(id), expires = row.expires_at ? Date.parse(String(row.expires_at)) : NaN;
    return {
      id, title: String(row.title || ""), city: String(row.city || ""), district: String(row.district || ""), propertyType: String(row.property_type || ""), purpose: String(row.purpose || ""),
      price: Number(row.price) || 0, currency: String(row.currency || "TRY"), status: String(row.status || ""), photo: m?.photo ?? photoOf(row.images),
      daysLeft: row.status === "published" && Number.isFinite(expires) ? Math.max(0, Math.ceil((expires - at.getTime()) / DAY)) : null,
      views: m?.views ?? 0, contacts: m?.contacts ?? 0, favorites: m?.favorites ?? 0, score: m?.score ?? 0,
    };
  });
  const published = listings.filter((row) => row.status === "published");
  // The listing that drew the most interest in the period: views, then contacts.
  const top = [...published].sort((a, b) => b.views + b.contacts * 5 - (a.views + a.contacts * 5) || b.favorites - a.favorites)[0] ?? null;
  const expiringSoon = published.filter((row) => row.daysLeft !== null && row.daysLeft <= 7).length;
  return {
    days: stats.days, generatedAt: now,
    totals: stats.totals, previous: stats.previous, series: stats.series, languages: stats.languages,
    counts: { published: published.length, pending: listings.filter((row) => row.status === "pending").length, expired: listings.filter((row) => row.status === "expired").length, drafts },
    top: top ? { ...top, metrics: metrics.get(top.id) ?? null } : null,
    listings: listings.filter((row) => row.status !== "draft").slice(0, 50),
    appointments: appointments.map((row): OverviewAppointment => ({ id: String(row.id), listingId: String(row.listing_id), listingTitle: String(row.listing_title || ""), buyerName: String(row.buyer_name || ""), slotAt: String(row.slot_at), status: String(row.status) })),
    reminders: { unanswered: stats.unanswered, pendingAppointments, expiringSoon, drafts, newRequests },
    customers: customers.map((row): OverviewCustomer => ({ listingId: String(row.listing_id), listingTitle: String(row.listing_title || ""), peerId: String(row.peer_id), name: String(row.peer_name || ""), lastAt: String(row.last_at), waiting: String(row.last_sender || "") === String(row.peer_id) })),
    weekEnd: week,
  };
}
