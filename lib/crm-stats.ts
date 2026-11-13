// CRM › İstatistikler (owner's request 2026-11-13): listing performance for the listing owner, with a funnel
// (views → favourites → contacts → appointments), visitor languages, a comparison with similar listings and plain
// advice per listing. Rules only, no AI call, so it costs nothing to run. SQL works on PostgreSQL and SQLite.
//
// New data: listing_event_daily counts contact clicks (phone, WhatsApp) and the page language of each counted view,
// once per visitor (hashed with the day, like listing_view_daily) and kind; nothing identifies a person.
type Statement = { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> };
export type CrmDatabase = { prepare(sql: string): Statement };

export const EVENT_KINDS = ["phone", "whatsapp", "view"] as const;
export type EventKind = typeof EVENT_KINDS[number];
export const CRM_PERIODS = [7, 30, 90] as const;
const LOCALES = ["tr", "de", "fr", "en", "ar", "fa", "ru", "nl"];
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS listing_event_daily(listing_id TEXT NOT NULL,day TEXT NOT NULL,kind TEXT NOT NULL,actor_hash TEXT NOT NULL,locale TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,PRIMARY KEY(listing_id,day,kind,actor_hash))",
  "CREATE INDEX IF NOT EXISTS listing_event_daily_day_idx ON listing_event_daily(day)",
];
const ready = new WeakMap<object, Promise<unknown>>();
export async function ensureCrm(db: CrmDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = (async () => { for (const sql of SCHEMA) await db.prepare(sql).bind().run(); })(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}

/** Counts one event per visitor, listing, day and kind; only for published listings and never the owner's own clicks. */
export async function recordListingEvent(db: CrmDatabase, listingId: string, kind: EventKind, actorHash: string, actorId: string | null, locale = "", at = new Date()) {
  if (!(EVENT_KINDS as readonly string[]).includes(kind)) return false;
  await ensureCrm(db);
  const row = await db.prepare("INSERT INTO listing_event_daily(listing_id,day,kind,actor_hash,locale,created_at) SELECT CAST(id AS TEXT),?,?,?,?,? FROM listings WHERE CAST(id AS TEXT)=? AND status='published' AND CAST(owner_id AS TEXT)<>? ON CONFLICT(listing_id,day,kind,actor_hash) DO NOTHING RETURNING listing_id")
    .bind(at.toISOString().slice(0, 10), kind, actorHash, LOCALES.includes(locale) ? locale : "", at.toISOString(), listingId, actorId || "").first();
  return Boolean(row);
}

export type ListingRow = { id: string; title: string; city: string; property_type: string; status: string; images: string; description: string; published_at: string | null; created_at: string };
export type ListingMetrics = { views: number; favorites: number; phone: number; whatsapp: number; messages: number; appointments: number; recentViews: number; languages: Record<string, number> };
export type Insight = { code: string; tone: "good" | "warn" | "tip"; value?: number };
export type ListingStats = ListingMetrics & { id: string; title: string; city: string; photo: string | null; status: string; contacts: number; conversion: number; benchmark: number; score: number; insights: Insight[] };

const photosOf = (images: string) => { try { const list = JSON.parse(images); return Array.isArray(list) ? list.filter((item) => typeof item === "string") as string[] : []; } catch { return []; } };
const share = (part: number, whole: number) => whole > 0 ? Math.round(part / whole * 1000) / 10 : 0;

/**
 * Advice for one listing from its numbers (period of `days` days). Order: problems first, then tips, then good news.
 * `benchmark` = average views of published listings of the same city and type in the same period.
 */
export function listingInsights(listing: ListingRow, m: ListingMetrics, benchmark: number, days: number, at = new Date()): Insight[] {
  const out: Insight[] = [], contacts = m.phone + m.whatsapp + m.messages, photos = photosOf(listing.images).length;
  const age = (at.getTime() - Date.parse(listing.published_at || listing.created_at)) / 86400000;
  if (listing.status !== "published") return [{ code: "not_published", tone: "warn" }];
  if (benchmark >= 5 && m.views < benchmark * 0.5 && age >= 7) out.push({ code: "low_views", tone: "warn", value: Math.round(benchmark) });
  if (m.views >= 40 && contacts === 0) out.push({ code: "views_no_contact", tone: "warn", value: m.views });
  else if (m.views >= 100 && contacts / m.views < 0.01) out.push({ code: "low_conversion", tone: "warn", value: share(contacts, m.views) });
  if (m.favorites >= 3 && contacts === 0) out.push({ code: "favorites_no_contact", tone: "tip", value: m.favorites });
  if (age >= 60 && m.recentViews === 0) out.push({ code: "stale", tone: "warn", value: Math.floor(age) });
  if (photos < 6) out.push({ code: "few_photos", tone: "tip", value: photos });
  if ([...listing.description].length < 300) out.push({ code: "short_description", tone: "tip" });
  const foreign = Object.entries(m.languages).filter(([code]) => code && code !== "tr").reduce((sum, [, n]) => sum + n, 0);
  const counted = Object.values(m.languages).reduce((sum, n) => sum + n, 0);
  if (counted >= 20 && foreign / counted >= 0.3) out.push({ code: "foreign_interest", tone: "good", value: Math.round(foreign / counted * 100) });
  if (benchmark >= 5 && m.views >= benchmark * 2) out.push({ code: "top_views", tone: "good", value: Math.round(m.views / benchmark * 10) / 10 });
  if (m.views >= 20 && contacts / Math.max(1, m.views) >= 0.05) out.push({ code: "strong_conversion", tone: "good", value: share(contacts, m.views) });
  void days;
  return out;
}

/** 0–100: starts at 100, each warning costs 20 and each tip 8; good news adds 5 (capped). */
export const listingScore = (insights: Insight[]) => Math.max(0, Math.min(100, 100 - insights.reduce((sum, item) => sum + (item.tone === "warn" ? 20 : item.tone === "tip" ? 8 : -5), 0)));

const sinceDay = (days: number, at: Date) => new Date(at.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);

/** Everything the CRM statistics screen shows for one owner over the last `days` days, with the period before for trends. */
export async function crmStats(db: CrmDatabase, ownerId: string, days: number, at = new Date()) {
  await ensureCrm(db);
  const period = (CRM_PERIODS as readonly number[]).includes(days) ? days : 30;
  const since = sinceDay(period, at), before = sinceDay(period * 2, at), stamp = since + "T00:00:00.000Z", beforeStamp = before + "T00:00:00.000Z", recent = sinceDay(7, at);
  const listings = (await db.prepare("SELECT CAST(id AS TEXT) AS id,title,city,property_type,status,images,description,published_at,created_at FROM listings WHERE owner_id=? AND status IN ('published','pending','expired') ORDER BY updated_at DESC LIMIT 500").bind(ownerId).all<ListingRow>()).results || [];
  const ids = listings.map((row) => row.id);
  const empty = { days: period, totals: zeroTotals(), previous: zeroTotals(), series: [] as { day: string; views: number; contacts: number }[], languages: {} as Record<string, number>, listings: [] as ListingStats[], unanswered: 0 };
  if (!ids.length) return empty;
  const marks = ids.map(() => "?").join(",");
  const q = <T>(sql: string, ...values: (string | number)[]) => db.prepare(sql).bind(...values).all<T>().then((r) => r.results || []);
  const [views, oldViews, recentViews, favorites, oldFavorites, events, oldEvents, messages, oldMessages, appointments, oldAppointments, daily, dailyContacts] = await Promise.all([
    q<{ id: string; n: number }>(`SELECT listing_id AS id,COUNT(*) AS n FROM listing_view_daily WHERE listing_id IN (${marks}) AND day>=? GROUP BY listing_id`, ...ids, since),
    q<{ n: number }>(`SELECT COUNT(*) AS n FROM listing_view_daily WHERE listing_id IN (${marks}) AND day>=? AND day<?`, ...ids, before, since),
    q<{ id: string; n: number }>(`SELECT listing_id AS id,COUNT(*) AS n FROM listing_view_daily WHERE listing_id IN (${marks}) AND day>=? GROUP BY listing_id`, ...ids, recent),
    q<{ id: string; n: number }>(`SELECT listing_id AS id,COUNT(*) AS n FROM favorites WHERE listing_id IN (${marks}) AND created_at>=? GROUP BY listing_id`, ...ids, stamp),
    q<{ n: number }>(`SELECT COUNT(*) AS n FROM favorites WHERE listing_id IN (${marks}) AND created_at>=? AND created_at<?`, ...ids, beforeStamp, stamp),
    q<{ id: string; kind: string; locale: string; n: number }>(`SELECT listing_id AS id,kind,locale,COUNT(*) AS n FROM listing_event_daily WHERE listing_id IN (${marks}) AND day>=? GROUP BY listing_id,kind,locale`, ...ids, since),
    q<{ kind: string; n: number }>(`SELECT kind,COUNT(*) AS n FROM listing_event_daily WHERE listing_id IN (${marks}) AND day>=? AND day<? GROUP BY kind`, ...ids, before, since),
    // One contact per person and listing: repeated messages in a conversation count once.
    q<{ id: string; n: number }>(`SELECT listing_id AS id,COUNT(DISTINCT CAST(sender_id AS TEXT)) AS n FROM messages WHERE listing_id IN (${marks}) AND CAST(recipient_id AS TEXT)=? AND CAST(sender_id AS TEXT)<>? AND created_at>=? GROUP BY listing_id`, ...ids, ownerId, ownerId, stamp),
    q<{ n: number }>(`SELECT COUNT(DISTINCT listing_id || ':' || CAST(sender_id AS TEXT)) AS n FROM messages WHERE listing_id IN (${marks}) AND CAST(recipient_id AS TEXT)=? AND CAST(sender_id AS TEXT)<>? AND created_at>=? AND created_at<?`, ...ids, ownerId, ownerId, beforeStamp, stamp),
    q<{ id: string; n: number }>(`SELECT CAST(listing_id AS TEXT) AS id,COUNT(*) AS n FROM appointments WHERE CAST(listing_id AS TEXT) IN (${marks}) AND created_at>=? GROUP BY listing_id`, ...ids, stamp).catch(() => []),
    q<{ n: number }>(`SELECT COUNT(*) AS n FROM appointments WHERE CAST(listing_id AS TEXT) IN (${marks}) AND created_at>=? AND created_at<?`, ...ids, beforeStamp, stamp).catch(() => [{ n: 0 }]),
    q<{ day: string; n: number }>(`SELECT day,COUNT(*) AS n FROM listing_view_daily WHERE listing_id IN (${marks}) AND day>=? GROUP BY day`, ...ids, since),
    q<{ day: string; n: number }>(`SELECT day,COUNT(*) AS n FROM listing_event_daily WHERE listing_id IN (${marks}) AND day>=? AND kind<>'view' GROUP BY day`, ...ids, since),
  ]);
  // Similar listings: average views per published listing of the same city and type (site-wide, this period).
  const pairs = [...new Set(listings.map((row) => `${row.city}\u0000${row.property_type}`))];
  const benchmarks = new Map<string, number>();
  for (const pair of pairs) {
    const [city, type] = pair.split("\u0000");
    const row = await db.prepare("SELECT COUNT(v.visitor_hash) AS views,COUNT(DISTINCT CAST(l.id AS TEXT)) AS listings FROM listings l LEFT JOIN listing_view_daily v ON v.listing_id=CAST(l.id AS TEXT) AND v.day>=? WHERE l.status='published' AND l.city=? AND l.property_type=?").bind(since, city, type).first<{ views: number; listings: number }>();
    benchmarks.set(pair, Number(row?.listings) >= 3 ? Number(row!.views) / Number(row!.listings) : 0);
  }
  const by = (rows: { id: string; n: number }[]) => new Map(rows.map((row) => [String(row.id), Number(row.n)]));
  const viewMap = by(views), recentMap = by(recentViews), favMap = by(favorites), msgMap = by(messages), apptMap = by(appointments);
  const languages: Record<string, number> = {};
  const result: ListingStats[] = listings.map((listing) => {
    const own = events.filter((row) => String(row.id) === listing.id);
    const count = (kind: string) => own.filter((row) => row.kind === kind).reduce((sum, row) => sum + Number(row.n), 0);
    const langs: Record<string, number> = {};
    for (const row of own) if (row.kind === "view" && row.locale) { langs[row.locale] = (langs[row.locale] || 0) + Number(row.n); languages[row.locale] = (languages[row.locale] || 0) + Number(row.n); }
    const metrics: ListingMetrics = { views: viewMap.get(listing.id) || 0, favorites: favMap.get(listing.id) || 0, phone: count("phone"), whatsapp: count("whatsapp"), messages: msgMap.get(listing.id) || 0, appointments: apptMap.get(listing.id) || 0, recentViews: recentMap.get(listing.id) || 0, languages: langs };
    const benchmark = benchmarks.get(`${listing.city}\u0000${listing.property_type}`) || 0, insights = listingInsights(listing, metrics, benchmark, period, at);
    const contacts = metrics.phone + metrics.whatsapp + metrics.messages;
    return { ...metrics, id: listing.id, title: listing.title, city: listing.city, status: listing.status, photo: photosOf(listing.images)[0] || null, contacts, conversion: share(contacts, metrics.views), benchmark: Math.round(benchmark * 10) / 10, score: listingScore(insights), insights };
  });
  const sum = (key: keyof ListingMetrics | "contacts") => result.reduce((total, row) => total + Number(row[key] || 0), 0);
  const totals = { views: sum("views"), favorites: sum("favorites"), phone: sum("phone"), whatsapp: sum("whatsapp"), messages: sum("messages"), appointments: sum("appointments"), contacts: sum("contacts"), conversion: 0 };
  totals.conversion = share(totals.contacts, totals.views);
  const oldKind = (kind: string) => Number(oldEvents.find((row) => row.kind === kind)?.n || 0);
  const previous = { views: Number(oldViews[0]?.n || 0), favorites: Number(oldFavorites[0]?.n || 0), phone: oldKind("phone"), whatsapp: oldKind("whatsapp"), messages: Number(oldMessages[0]?.n || 0), appointments: Number(oldAppointments[0]?.n || 0), contacts: 0, conversion: 0 };
  previous.contacts = previous.phone + previous.whatsapp + previous.messages; previous.conversion = share(previous.contacts, previous.views);
  const dayViews = new Map(daily.map((row) => [String(row.day), Number(row.n)])), dayContacts = new Map(dailyContacts.map((row) => [String(row.day), Number(row.n)]));
  const series = Array.from({ length: period }, (_, index) => { const day = new Date(Date.parse(since + "T00:00:00Z") + index * 86400000).toISOString().slice(0, 10); return { day, views: dayViews.get(day) || 0, contacts: dayContacts.get(day) || 0 }; });
  // Waiting customers: a conversation whose last message is from the contact and older than a day.
  const unanswered = await db.prepare(`SELECT COUNT(*) AS n FROM (SELECT m.listing_id,CAST(m.sender_id AS TEXT) AS contact,MAX(m.created_at) AS last_in FROM messages m WHERE m.listing_id IN (${marks}) AND CAST(m.recipient_id AS TEXT)=? AND CAST(m.sender_id AS TEXT)<>? GROUP BY m.listing_id,CAST(m.sender_id AS TEXT)) t WHERE t.last_in<? AND NOT EXISTS (SELECT 1 FROM messages r WHERE r.listing_id=t.listing_id AND CAST(r.sender_id AS TEXT)=? AND CAST(r.recipient_id AS TEXT)=t.contact AND r.created_at>t.last_in)`)
    .bind(...ids, ownerId, ownerId, new Date(at.getTime() - 86400000).toISOString(), ownerId).first<{ n: number }>().catch(() => null);
  result.sort((a, b) => a.score - b.score || b.views - a.views);
  return { days: period, totals, previous, series, languages, listings: result, unanswered: Number(unanswered?.n || 0) };
}
function zeroTotals() { return { views: 0, favorites: 0, phone: 0, whatsapp: 0, messages: 0, appointments: 0, contacts: 0, conversion: 0 }; }
export type CrmStats = Awaited<ReturnType<typeof crmStats>>;
