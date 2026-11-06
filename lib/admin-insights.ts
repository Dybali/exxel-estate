// Admin "Genel bakış / Raporlar" dashboard: period KPIs with comparison to the previous period,
// a daily series and top lists, read from existing tables only (no schema changes).
// All times are UTC; text timestamps are ISO strings, so range filters compare as text and
// substr(created_at,1,10) is the UTC day bucket in both PostgreSQL and SQLite.
// Demo and sample listings live in code (ids "ex-…" and "sample-…"), never in the database; the
// id filters below make sure that, should one ever be stored, it is still never counted.
// Tables that are created on first use (views, orders, projects, service firms, reports, office documents,
// contact messages) are optional: if one is missing or fails, its metric is null and listed
// in `unavailable` instead of failing the whole report.

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type InsightsDatabase = { prepare(sql: string): Statement };

export const INSIGHT_PERIODS = { today: 1, "7d": 7, "30d": 30, "90d": 90 } as const;
export type InsightPeriod = keyof typeof INSIGHT_PERIODS;
const DAY = 86400000;

export function parseInsightPeriod(value: unknown): InsightPeriod | null {
  if (value === null || value === undefined || value === "") return "7d";
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(INSIGHT_PERIODS, value) ? value as InsightPeriod : null;
}

export type InsightWindow = { days: number; start: string; end: string; previousStart: string; previousEnd: string; startDay: string; endDay: string; previousStartDay: string; previousEndDay: string; buckets: string[] };

// Current period: from UTC midnight (days-1) days ago until now. Previous period: the same
// length of time directly before it, ending exactly `days` days before now, so a half-finished
// today is compared with the same part of the earlier day. Views are only stored per day, so
// they compare whole day buckets (previous period = the `days` full days before startDay).
export function insightWindow(period: InsightPeriod, at = new Date()): InsightWindow {
  const days = INSIGHT_PERIODS[period], now = at.getTime();
  const midnight = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  const start = midnight - (days - 1) * DAY, iso = (ms: number) => new Date(ms).toISOString();
  return {
    days, start: iso(start), end: iso(now), previousStart: iso(start - days * DAY), previousEnd: iso(now - days * DAY),
    startDay: iso(start).slice(0, 10), endDay: iso(now).slice(0, 10),
    previousStartDay: iso(start - days * DAY).slice(0, 10), previousEndDay: iso(start - DAY).slice(0, 10),
    buckets: Array.from({ length: days }, (_, index) => iso(start + index * DAY).slice(0, 10)),
  };
}

export type Metric = { current: number; previous: number; change: number | null };
// Percentage change rounded to one decimal. null means "new": nothing in the previous period.
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
export const metric = (current: unknown, previous: unknown): Metric => {
  const c = Number(current) || 0, p = Number(previous) || 0;
  return { current: c, previous: p, change: percentChange(c, p) };
};

const notDemo = (column: string) => `${column} NOT LIKE 'ex-%' AND ${column} NOT LIKE 'sample-%'`;
const LISTING_ID = "CAST(l.id AS TEXT)";
// Live = published and not past its publication period (the database adapter applies the same
// cutoff to `status='published'`; IN (...) keeps this query explicit and identical in tests).
const LIVE = "l.status IN ('published') AND (l.expires_at IS NULL OR l.expires_at>?)";
const ACCOUNT_KIND = "CASE WHEN u.role='agent' AND EXISTS(SELECT 1 FROM agencies a WHERE a.owner_id=u.id AND a.category='developer') THEN 'developer' WHEN u.role IN ('agent','individual','admin') THEN u.role ELSE 'buyer' END";
// cur/prev sums over one scan of [previousStart, end).
const split = (column: string) => `SUM(CASE WHEN ${column}>=? AND ${column}<? THEN 1 ELSE 0 END) AS current,SUM(CASE WHEN ${column}>=? AND ${column}<? THEN 1 ELSE 0 END) AS previous`;

export const ROLE_KINDS = ["individual", "agent", "developer", "buyer"] as const;
export type RoleKind = typeof ROLE_KINDS[number];
export const PENDING_KINDS = ["listings", "suspicious", "officeDocuments", "companyApplications", "projects", "services", "reports", "contact", "orders"] as const;
export type PendingKind = typeof PENDING_KINDS[number];
export const PENDING_LINKS: Record<PendingKind, string> = {
  listings: "/yonetim?view=listings", suspicious: "/yonetim?view=suspicious", officeDocuments: "/yonetim?view=applications", companyApplications: "/yonetim?view=applications",
  projects: "/yonetim?view=projects", services: "/yonetim?view=services", reports: "/yonetim?view=reports", contact: "/yonetim?view=contact", orders: "/yonetim?view=orders",
};

export type AdminInsights = {
  period: InsightPeriod; generatedAt: string; window: Omit<InsightWindow, "buckets">;
  kpis: {
    users: Metric & { byRole: Record<RoleKind, Metric> };
    listings: Metric & { published: Metric; pending: Metric };
    activeListings: number; expiredListings: Metric; messages: Metric; conversations: Metric; leads: Metric;
    views: Metric | null; reservations: Metric | null;
    orders: { created: Metric; fulfilled: Metric; revenue: Metric; currency: "TRY" } | null;
  };
  pending: { kind: PendingKind; count: number | null; href: string }[];
  series: { day: string; listings: number; users: number; messages: number }[];
  top: {
    viewed: { id: string; title: string; city: string; district: string; live: boolean; views: number }[] | null;
    advertisers: { id: string; name: string; company: string; kind: RoleKind | "admin"; listings: number; active: number }[];
    cities: { city: string; listings: number }[];
  };
  unavailable: string[];
};

type Row = Record<string, unknown>;

export async function adminInsights(db: InsightsDatabase, period: InsightPeriod, at = new Date()): Promise<AdminInsights> {
  const w = insightWindow(period, at), unavailable: string[] = [];
  const range = [w.start, w.end, w.previousStart, w.previousEnd, w.previousStart, w.end];
  const dayRange = [w.startDay, w.endDay, w.previousStartDay, w.previousEndDay];
  const all = (sql: string, ...values: (string | number)[]) => db.prepare(sql).bind(...values).all<Row>().then((r) => r.results || []);
  const first = (sql: string, ...values: (string | number)[]) => db.prepare(sql).bind(...values).first<Row>().then((r) => r || {});
  // Optional sources: a missing lazily-created table must not hide the rest of the report.
  const optional = async <T>(name: string, run: () => Promise<T>): Promise<T | null> => {
    try { return await run(); } catch { unavailable.push(name); return null; }
  };
  // First message of a thread (same listing, same two people, either direction) inside the window.
  const firstOfThread = "NOT EXISTS(SELECT 1 FROM messages p WHERE p.listing_id=m.listing_id AND ((p.sender_id=m.sender_id AND p.recipient_id=m.recipient_id) OR (p.sender_id=m.recipient_id AND p.recipient_id=m.sender_id)) AND (p.created_at<m.created_at OR (p.created_at=m.created_at AND p.id<m.id)))";
  // First enquiry from one person to the listing owner (one lead per listing and contact, as lib/leads.ts).
  const firstEnquiry = "NOT EXISTS(SELECT 1 FROM messages p WHERE p.listing_id=m.listing_id AND p.sender_id=m.sender_id AND p.recipient_id=m.recipient_id AND (p.created_at<m.created_at OR (p.created_at=m.created_at AND p.id<m.id)))";
  const pendingCount = (kind: PendingKind, sql: string) => optional("pending." + kind, async () => Number((await first(sql)).n) || 0).then((count) => ({ kind, count, href: PENDING_LINKS[kind] }));

  const [users, listings, active, expired, messages, conversations, leads, views, reservations, orders, pending, seriesListings, seriesUsers, seriesMessages, viewed, advertisers, cities] = await Promise.all([
    all(`SELECT ${ACCOUNT_KIND} AS kind,${split("u.created_at")} FROM users u WHERE u.created_at>=? AND u.created_at<? GROUP BY 1`, ...range),
    all(`SELECT l.status AS status,${split("l.created_at")} FROM listings l WHERE l.created_at>=? AND l.created_at<? AND ${notDemo(LISTING_ID)} GROUP BY l.status`, ...range),
    first(`SELECT COUNT(*) AS n FROM listings l WHERE ${LIVE} AND ${notDemo(LISTING_ID)}`, w.end),
    first(`SELECT ${split("l.expires_at")} FROM listings l WHERE l.status IN ('published') AND l.expires_at>=? AND l.expires_at<? AND ${notDemo(LISTING_ID)}`, ...range),
    first(`SELECT ${split("m.created_at")} FROM messages m WHERE m.created_at>=? AND m.created_at<? AND ${notDemo("m.listing_id")}`, ...range),
    first(`SELECT ${split("m.created_at")} FROM messages m WHERE m.created_at>=? AND m.created_at<? AND m.recipient_id IS NOT NULL AND ${notDemo("m.listing_id")} AND ${firstOfThread}`, ...range),
    first(`SELECT ${split("m.created_at")} FROM messages m JOIN listings l ON ${LISTING_ID}=m.listing_id WHERE m.created_at>=? AND m.created_at<? AND m.recipient_id=l.owner_id AND m.sender_id<>l.owner_id AND ${notDemo("m.listing_id")} AND ${firstEnquiry}`, ...range),
    optional("views", () => first(`SELECT SUM(CASE WHEN v.day>=? AND v.day<=? THEN 1 ELSE 0 END) AS current,SUM(CASE WHEN v.day>=? AND v.day<=? THEN 1 ELSE 0 END) AS previous FROM listing_view_daily v WHERE v.day>=? AND v.day<=? AND ${notDemo("v.listing_id")}`, ...dayRange, w.previousStartDay, w.endDay)),
    optional("reservations", () => first(`SELECT ${split("r.created_at")} FROM project_reservations r JOIN projects p ON p.id=r.project_id WHERE r.created_at>=? AND r.created_at<? AND ${notDemo("r.project_id")}`, ...range)),
    optional("orders", () => first(`SELECT ${split("o.created_at")},SUM(CASE WHEN o.status='fulfilled' AND o.fulfilled_at>=? AND o.fulfilled_at<? THEN 1 ELSE 0 END) AS fulfilled_current,SUM(CASE WHEN o.status='fulfilled' AND o.fulfilled_at>=? AND o.fulfilled_at<? THEN 1 ELSE 0 END) AS fulfilled_previous,SUM(CASE WHEN o.status='fulfilled' AND o.currency='TRY' AND o.fulfilled_at>=? AND o.fulfilled_at<? THEN o.amount ELSE 0 END) AS revenue_current,SUM(CASE WHEN o.status='fulfilled' AND o.currency='TRY' AND o.fulfilled_at>=? AND o.fulfilled_at<? THEN o.amount ELSE 0 END) AS revenue_previous FROM orders o WHERE (o.created_at>=? AND o.created_at<?) OR (o.fulfilled_at>=? AND o.fulfilled_at<?)`, ...range.slice(0, 4), w.start, w.end, w.previousStart, w.previousEnd, w.start, w.end, w.previousStart, w.previousEnd, w.previousStart, w.end, w.previousStart, w.end)),
    Promise.all([
      pendingCount("listings", `SELECT COUNT(*) AS n FROM listings l WHERE l.status='pending' AND ${notDemo(LISTING_ID)}`),
      // Open fraud/duplicate flags (lib/listing-risk-server.ts) on live or waiting listings.
      pendingCount("suspicious", `SELECT COUNT(*) AS n FROM listings l WHERE json_extract(l.presentation,'$.riskFlag') IS NOT NULL AND l.status IN ('published','pending') AND ${notDemo(LISTING_ID)}`),
      pendingCount("officeDocuments", "SELECT COUNT(*) AS n FROM office_verifications WHERE state='pending'"),
      pendingCount("companyApplications", "SELECT COUNT(*) AS n FROM users WHERE role='agent' AND agent_status='pending'"),
      pendingCount("projects", "SELECT COUNT(*) AS n FROM projects WHERE moderation='pending'"),
      pendingCount("services", "SELECT COUNT(*) AS n FROM service_firms WHERE status='pending'"),
      pendingCount("reports", `SELECT COUNT(*) AS n FROM listing_reports WHERE state IN ('open','reviewing') AND ${notDemo("listing_id")}`),
      pendingCount("contact", "SELECT COUNT(*) AS n FROM contact_messages WHERE status='new'"),
      pendingCount("orders", "SELECT COUNT(*) AS n FROM orders WHERE status='awaiting_payment'"),
    ]),
    all(`SELECT substr(l.created_at,1,10) AS day,COUNT(*) AS n FROM listings l WHERE l.created_at>=? AND l.created_at<? AND ${notDemo(LISTING_ID)} GROUP BY 1`, w.start, w.end),
    all(`SELECT substr(u.created_at,1,10) AS day,COUNT(*) AS n FROM users u WHERE u.created_at>=? AND u.created_at<? AND u.role<>'admin' GROUP BY 1`, w.start, w.end),
    all(`SELECT substr(m.created_at,1,10) AS day,COUNT(*) AS n FROM messages m WHERE m.created_at>=? AND m.created_at<? AND ${notDemo("m.listing_id")} GROUP BY 1`, w.start, w.end),
    optional("topViewed", () => all(`SELECT v.listing_id AS id,l.title AS title,l.city AS city,l.district AS district,l.status AS status,l.expires_at AS expires_at,COUNT(*) AS views FROM listing_view_daily v JOIN listings l ON ${LISTING_ID}=v.listing_id WHERE v.day>=? AND v.day<=? AND ${notDemo("v.listing_id")} GROUP BY v.listing_id,l.title,l.city,l.district,l.status,l.expires_at ORDER BY views DESC,v.listing_id LIMIT 10`, w.startDay, w.endDay)),
    all(`SELECT CAST(u.id AS TEXT) AS id,u.name AS name,u.company AS company,${ACCOUNT_KIND} AS kind,COUNT(*) AS listing_count,SUM(CASE WHEN ${LIVE} THEN 1 ELSE 0 END) AS active FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.created_at>=? AND l.created_at<? AND ${notDemo(LISTING_ID)} GROUP BY u.id,u.name,u.company,u.role ORDER BY listing_count DESC,u.name LIMIT 10`, w.end, w.start, w.end),
    all(`SELECT l.city AS city,COUNT(*) AS n FROM listings l WHERE ${LIVE} AND ${notDemo(LISTING_ID)} GROUP BY l.city ORDER BY n DESC,l.city LIMIT 10`, w.end),
  ]);

  const byRole = Object.fromEntries(ROLE_KINDS.map((kind) => {
    const row = users.find((r) => r.kind === kind);
    return [kind, metric(row?.current, row?.previous)];
  })) as Record<RoleKind, Metric>;
  const people = users.filter((r) => r.kind !== "admin");
  const sum = (rows: Row[], key: string) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const status = (name: string) => listings.filter((r) => r.status === name);
  const daily = (rows: Row[]) => new Map(rows.map((r) => [String(r.day), Number(r.n) || 0]));
  const [dl, du, dm] = [daily(seriesListings), daily(seriesUsers), daily(seriesMessages)];

  return {
    period, generatedAt: w.end,
    window: { days: w.days, start: w.start, end: w.end, previousStart: w.previousStart, previousEnd: w.previousEnd, startDay: w.startDay, endDay: w.endDay, previousStartDay: w.previousStartDay, previousEndDay: w.previousEndDay },
    kpis: {
      users: { ...metric(sum(people, "current"), sum(people, "previous")), byRole },
      listings: { ...metric(sum(listings, "current"), sum(listings, "previous")), published: metric(sum(status("published"), "current"), sum(status("published"), "previous")), pending: metric(sum(status("pending"), "current"), sum(status("pending"), "previous")) },
      activeListings: Number(active.n) || 0,
      expiredListings: metric(expired.current, expired.previous),
      messages: metric(messages.current, messages.previous),
      conversations: metric(conversations.current, conversations.previous),
      leads: metric(leads.current, leads.previous),
      views: views && metric(views.current, views.previous),
      reservations: reservations && metric(reservations.current, reservations.previous),
      orders: orders && { created: metric(orders.current, orders.previous), fulfilled: metric(orders.fulfilled_current, orders.fulfilled_previous), revenue: metric(orders.revenue_current, orders.revenue_previous), currency: "TRY" },
    },
    pending,
    series: w.buckets.map((day) => ({ day, listings: dl.get(day) || 0, users: du.get(day) || 0, messages: dm.get(day) || 0 })),
    top: {
      viewed: viewed && viewed.map((r) => ({ id: String(r.id), title: String(r.title || ""), city: String(r.city || ""), district: String(r.district || ""), live: r.status === "published" && !(typeof r.expires_at === "string" && r.expires_at <= w.end), views: Number(r.views) || 0 })),
      advertisers: advertisers.map((r) => ({ id: String(r.id), name: String(r.name || ""), company: String(r.company || ""), kind: String(r.kind) as RoleKind | "admin", listings: Number(r.listing_count) || 0, active: Number(r.active) || 0 })),
      cities: cities.map((r) => ({ city: String(r.city || ""), listings: Number(r.n) || 0 })),
    },
    unavailable,
  };
}
