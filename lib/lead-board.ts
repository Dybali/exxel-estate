// "Talep akışı": the open board of "Benim için bul" requests for estate agents (2026-11-19, owner's decision:
// a free market). Every approved agent sees every open request (summary, no contact details), filters it and
// decides alone which ones to answer; there is no matching by region or portfolio. An agent reaches the
// member with an offer (message plus up to three of their published listings) or by revealing the phone
// number; either puts the agent among the request's at most LEAD_LIMITS.perRequest agents, and only those
// see the member's name, e-mail and phone (the member agreed to this in the form). When the request is full,
// closed or expired, nobody else can reach it.
// Plans (switch LEAD_PLANS=1, off by default): without a Profesyonel or Prestij plan an agent sees the board
// but cannot reach anyone; Profesyonel reaches LEAD_LIMITS.professional requests a month, Prestij
// LEAD_LIMITS.prestige and sees new requests LEAD_LIMITS.prestigeHeadStartHours earlier.
// Agents follow provinces for e-mail alerts (default: the provinces of their published listings).
// Tables are created on first use and work on PostgreSQL and SQLite (docs/buyer-tools.md).
import { HOME_REQUEST_LIMITS, HOME_TYPES, type HomeRequest, type HomeRequestDetails } from "./home-requests";

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type LeadDatabase = { prepare(sql: string): Statement };
type Row = Record<string, unknown>;

export const LEAD_LIMITS = { perRequest: 4, professional: 20, prestige: 60, prestigeHeadStartHours: 24, offerMax: 1000, offerListings: 3, pageSize: 30, follows: 10, fastHours: 2, fastMinimum: 3 } as const;
export type LeadPlan = "prestige" | "professional" | null;

export const LEAD_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS home_request_offers(id TEXT PRIMARY KEY,request_id TEXT NOT NULL,agent_id TEXT NOT NULL,message TEXT NOT NULL,listing_ids TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS home_request_offers_request_idx ON home_request_offers(request_id,created_at)",
  "CREATE TABLE IF NOT EXISTS home_request_reveals(request_id TEXT NOT NULL,agent_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(request_id,agent_id))",
  "CREATE TABLE IF NOT EXISTS agent_lead_follows(user_id TEXT PRIMARY KEY,cities TEXT NOT NULL DEFAULT '[]',seen_at TEXT,updated_at TEXT NOT NULL)",
];
const ready = new WeakMap<object, Promise<unknown>>();
export async function ensureLeads(db: LeadDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = (async () => { for (const sql of LEAD_SCHEMA) await db.prepare(sql).run(); })(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}

export class LeadError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const leadPlansEnabled = (settings: Record<string, unknown>) => String(settings.LEAD_PLANS ?? "") === "1";

/** "Sıcak": buying or moving now, or the money is ready (cash, approved mortgage). */
export function isHot(details: HomeRequestDetails | null) {
  return Boolean(details && (details.timeline === "now" || details.payment === "cash" || details.payment === "approved"));
}

function parseDetails(value: unknown): HomeRequestDetails | null {
  if (typeof value !== "string" || !value || value === "{}") return null;
  try { return { types: [], districts: [], rooms: [], minArea: null, features: [], timeline: "", payment: "", foreign: false, citizenship: false, contact: "email", contactTime: "any", language: "tr", alert: false, ...JSON.parse(value) }; } catch { return null; }
}

/** The agent's active plan (agent_plan_grants, written by lib/orders.ts and the admin panel). */
export async function agentLeadPlan(db: LeadDatabase, agentId: string, at = new Date()): Promise<LeadPlan> {
  const stamp = at.toISOString();
  const row = await db.prepare("SELECT plan_id FROM agent_plan_grants WHERE CAST(user_id AS TEXT)=? AND revoked_at IS NULL AND starts_at<=? AND ends_at>? ORDER BY ends_at DESC LIMIT 1").bind(agentId, stamp, stamp).first<{ plan_id: string }>().catch(() => null);
  return row?.plan_id === "prestige" ? "prestige" : row?.plan_id === "professional" ? "professional" : null;
}

const monthStart = (at: Date) => new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1)).toISOString();
/** Requests the agent reached this calendar month (offer or phone, counted once per request). */
export async function leadsUsed(db: LeadDatabase, agentId: string, at = new Date()) {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM home_request_agents WHERE agent_id=? AND state='contacted' AND updated_at>=?").bind(agentId, monthStart(at)).first<{ n: number }>();
  return Number(row?.n) || 0;
}

export type LeadAccess = { plans: boolean; plan: LeadPlan; limit: number | null; used: number; canReach: boolean; headStart: boolean };
export async function leadAccess(db: LeadDatabase, agentId: string, plansOn: boolean, at = new Date()): Promise<LeadAccess> {
  await ensureLeads(db);
  const used = await leadsUsed(db, agentId, at);
  if (!plansOn) return { plans: false, plan: null, limit: null, used, canReach: true, headStart: true };
  const plan = await agentLeadPlan(db, agentId, at);
  const limit = plan === "prestige" ? LEAD_LIMITS.prestige : plan === "professional" ? LEAD_LIMITS.professional : 0;
  return { plans: true, plan, limit, used, canReach: used < limit, headStart: plan === "prestige" };
}

export type BoardFilters = { city?: string; district?: string; intent?: string; category?: string; hot?: boolean; foreign?: boolean; minBudget?: number | null; maxBudget?: number | null; mine?: boolean; page?: number };
export function boardFilters(params: URLSearchParams): BoardFilters {
  const text = (key: string) => (params.get(key) || "").trim().slice(0, 60);
  const money = (key: string) => { const n = Number((params.get(key) || "").replace(/\D/g, "")); return n > 0 ? n : null; };
  return { city: text("city"), district: text("district"), intent: ["buy", "rent"].includes(params.get("intent") || "") ? params.get("intent")! : "", category: ["konut", "arsa", "isyeri"].includes(params.get("category") || "") ? params.get("category")! : "", hot: params.get("hot") === "1", foreign: params.get("foreign") === "1", minBudget: money("minBudget"), maxBudget: money("maxBudget"), mine: params.get("mine") === "1", page: Math.max(1, Math.min(50, Number(params.get("page")) || 1)) };
}

export type BoardOffer = { message: string; listingIds: string[]; createdAt: string };
export type BoardItem = Omit<HomeRequest, "note" | "closeReason"> & {
  note: string; hot: boolean; reached: number; full: boolean; locked: boolean;
  mine: { offer: BoardOffer | null; revealed: boolean } | null;
  contact: { name: string; email: string; phone: string } | null;
};

/** Open requests on the board, newest first, with the agent's own engagement and (only then) the contact. */
export async function leadBoard(db: LeadDatabase, agentId: string, access: LeadAccess, filters: BoardFilters = {}, at = new Date()) {
  await ensureLeads(db);
  const stamp = at.toISOString(), where = ["r.status='open'", "r.expires_at>?", "r.user_id<>?"], values: (string | number)[] = [stamp, agentId];
  if (filters.city) { where.push("r.city=?"); values.push(filters.city); }
  if (filters.intent) { where.push("r.intent=?"); values.push(filters.intent); }
  if (filters.category) { where.push("r.category=?"); values.push(filters.category); }
  if (filters.minBudget) { where.push("(r.budget_max IS NULL OR r.budget_max>=?)"); values.push(filters.minBudget); }
  if (filters.maxBudget) { where.push("(r.budget_min IS NULL OR r.budget_min<=?)"); values.push(filters.maxBudget); }
  if (filters.mine) { where.push("EXISTS (SELECT 1 FROM home_request_agents m WHERE m.request_id=r.id AND m.agent_id=? AND m.state='contacted')"); values.push(agentId); }
  const rows = (await db.prepare(`SELECT r.*,d.data AS details,
    (SELECT COUNT(*) FROM home_request_agents a WHERE a.request_id=r.id AND a.state='contacted') AS reached,
    (SELECT COUNT(*) FROM home_request_agents a WHERE a.request_id=r.id AND a.agent_id=? AND a.state='contacted') AS mine_reached
    FROM home_requests r LEFT JOIN home_request_details d ON d.request_id=r.id WHERE ${where.join(" AND ")} ORDER BY r.created_at DESC LIMIT 400`).bind(agentId, ...values).all<Row>()).results || [];
  const headStart = new Date(at.getTime() - LEAD_LIMITS.prestigeHeadStartHours * 3600000).toISOString();
  const items: BoardItem[] = [];
  for (const row of rows) {
    const details = parseDetails(row.details), hot = isHot(details);
    if (filters.hot && !hot) continue;
    if (filters.foreign && !details?.foreign) continue;
    const districts = details?.districts.length ? details.districts : row.district ? [String(row.district)] : [];
    if (filters.district && !districts.includes(filters.district)) continue;
    const reached = Number(row.reached) || 0, engaged = Number(row.mine_reached) > 0;
    // Prestij sees requests first; the others see them after the head start (always shown, but locked).
    const early = access.plans && !access.headStart && String(row.created_at) > headStart;
    items.push({
      id: String(row.id), intent: row.intent === "rent" ? "rent" : "buy", city: String(row.city), district: String(row.district || ""), category: String(row.category), rooms: String(row.rooms || ""),
      budgetMin: row.budget_min == null ? null : Number(row.budget_min), budgetMax: row.budget_max == null ? null : Number(row.budget_max),
      note: engaged ? String(row.note || "") : "", status: "open", createdAt: String(row.created_at), expiresAt: String(row.expires_at), details,
      hot, reached, full: reached >= LEAD_LIMITS.perRequest, locked: !engaged && (early || !access.canReach),
      mine: null, contact: engaged ? { name: String(row.name), email: String(row.email), phone: String(row.phone || "") } : null,
    });
  }
  const pageSize = LEAD_LIMITS.pageSize, page = filters.page || 1, slice = items.slice((page - 1) * pageSize, page * pageSize);
  for (const item of slice) if (item.contact) {
    const offer = await db.prepare("SELECT message,listing_ids,created_at FROM home_request_offers WHERE request_id=? AND agent_id=? ORDER BY created_at DESC LIMIT 1").bind(item.id, agentId).first<Row>();
    const revealed = await db.prepare("SELECT request_id FROM home_request_reveals WHERE request_id=? AND agent_id=?").bind(item.id, agentId).first();
    item.mine = { offer: offer ? { message: String(offer.message), listingIds: JSON.parse(String(offer.listing_ids || "[]")), createdAt: String(offer.created_at) } : null, revealed: Boolean(revealed) };
    if (!item.mine.revealed) item.contact = { name: item.contact.name, email: "", phone: "" };
  }
  return { items: slice, total: items.length, page, pageSize };
}

async function reachable(db: LeadDatabase, agentId: string, requestId: unknown, access: LeadAccess, at: Date) {
  await ensureLeads(db);
  if (typeof requestId !== "string" || requestId.length > 60) throw new LeadError("Talep bulunamadı.", 404);
  const row = await db.prepare("SELECT * FROM home_requests WHERE id=?").bind(requestId).first<Row>();
  if (!row || String(row.user_id) === agentId) throw new LeadError("Talep bulunamadı.", 404);
  if (row.status === "closed" || String(row.expires_at) <= at.toISOString()) throw new LeadError("Bu talep kapandı.", 410);
  const already = await db.prepare("SELECT state FROM home_request_agents WHERE request_id=? AND agent_id=?").bind(requestId, agentId).first<{ state: string }>();
  if (already?.state === "contacted") return { row, first: false };
  if (access.plans && !access.headStart && String(row.created_at) > new Date(at.getTime() - LEAD_LIMITS.prestigeHeadStartHours * 3600000).toISOString())
    throw new LeadError("Yeni talepler ilk 24 saat Prestij paketindeki danışmanlara açıktır.", 403);
  if (!access.canReach) throw new LeadError(access.plans && !access.plan ? "Taleplere ulaşmak için Profesyonel veya Prestij paketi gerekir." : "Bu ayki talep hakkınız doldu.", 402);
  const reached = await db.prepare("SELECT COUNT(*) AS n FROM home_request_agents WHERE request_id=? AND state='contacted'").bind(requestId).first<{ n: number }>();
  if (Number(reached?.n) >= LEAD_LIMITS.perRequest) throw new LeadError("Bu talebe ulaşan danışman sayısı doldu.", 409);
  return { row, first: true };
}
async function markReached(db: LeadDatabase, requestId: string, agentId: string, stamp: string) {
  const existing = await db.prepare("SELECT state FROM home_request_agents WHERE request_id=? AND agent_id=?").bind(requestId, agentId).first();
  if (existing) await db.prepare("UPDATE home_request_agents SET state='contacted',updated_at=? WHERE request_id=? AND agent_id=?").bind(stamp, requestId, agentId).run();
  else await db.prepare("INSERT INTO home_request_agents(request_id,agent_id,state,updated_at) VALUES(?,?,'contacted',?)").bind(requestId, agentId, stamp).run();
}

/** Offer: a message and up to three of the agent's own published listings. Returns whether this was the first contact. */
export async function sendOffer(db: LeadDatabase, agentId: string, input: Record<string, unknown>, access: LeadAccess, at = new Date()) {
  const message = typeof input.message === "string" ? input.message.trim().slice(0, LEAD_LIMITS.offerMax) : "";
  if (message.length < 20) throw new LeadError("Teklifinizi en az 20 karakterle yazın.");
  const ids = [...new Set((Array.isArray(input.listingIds) ? input.listingIds : []).filter((id): id is string => typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id)))].slice(0, LEAD_LIMITS.offerListings);
  for (const id of ids) {
    const own = await db.prepare("SELECT id FROM listings WHERE CAST(id AS TEXT)=? AND CAST(owner_id AS TEXT)=? AND status='published'").bind(id, agentId).first();
    if (!own) throw new LeadError("Yalnızca kendi yayındaki ilanlarınızı önerebilirsiniz.");
  }
  const { row, first } = await reachable(db, agentId, input.id, access, at);
  const stamp = at.toISOString();
  await db.prepare("INSERT INTO home_request_offers(id,request_id,agent_id,message,listing_ids,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), String(row.id), agentId, message, JSON.stringify(ids), stamp).run();
  await markReached(db, String(row.id), agentId, stamp);
  return { first, requestId: String(row.id), memberId: String(row.user_id) };
}

/** Phone and e-mail of the member; the member sees who opened them. */
export async function revealContact(db: LeadDatabase, agentId: string, requestId: unknown, access: LeadAccess, at = new Date()) {
  const { row } = await reachable(db, agentId, requestId, access, at);
  const stamp = at.toISOString();
  const seen = await db.prepare("SELECT request_id FROM home_request_reveals WHERE request_id=? AND agent_id=?").bind(String(row.id), agentId).first();
  if (!seen) await db.prepare("INSERT INTO home_request_reveals(request_id,agent_id,created_at) VALUES(?,?,?)").bind(String(row.id), agentId, stamp).run();
  await markReached(db, String(row.id), agentId, stamp);
  return { name: String(row.name), email: String(row.email), phone: String(row.phone || "") };
}

/** Median hours from a request to the agent's first contact, over the last 90 days. */
export async function responseStats(db: LeadDatabase, agentId: string, at = new Date()) {
  await ensureLeads(db);
  const since = new Date(at.getTime() - 90 * 86400000).toISOString();
  const rows = (await db.prepare("SELECT r.created_at AS created,MIN(x.at) AS first FROM home_requests r JOIN (SELECT request_id,created_at AS at FROM home_request_offers WHERE agent_id=? UNION ALL SELECT request_id,created_at AS at FROM home_request_reveals WHERE agent_id=?) x ON x.request_id=r.id WHERE r.created_at>=? GROUP BY r.id,r.created_at").bind(agentId, agentId, since).all<Row>()).results || [];
  const hours = rows.map((row) => (Date.parse(String(row.first)) - Date.parse(String(row.created))) / 3600000).filter((value) => value >= 0).sort((a, b) => a - b);
  const median = hours.length ? hours[Math.floor((hours.length - 1) / 2)] : null;
  return { answered: hours.length, medianHours: median, fast: hours.length >= LEAD_LIMITS.fastMinimum && median != null && median <= LEAD_LIMITS.fastHours };
}

/** Provinces the agent follows for e-mail alerts; empty means "where my published listings are". */
export async function leadFollows(db: LeadDatabase, agentId: string) {
  await ensureLeads(db);
  const row = await db.prepare("SELECT cities,seen_at FROM agent_lead_follows WHERE user_id=?").bind(agentId).first<{ cities: string; seen_at: string | null }>();
  let cities: string[] = [];
  try { cities = JSON.parse(String(row?.cities || "[]")).filter((item: unknown) => typeof item === "string"); } catch { /* none */ }
  return { cities, seenAt: row?.seen_at || null };
}
export async function setLeadFollows(db: LeadDatabase, agentId: string, cities: unknown, at = new Date()) {
  await ensureLeads(db);
  const list = [...new Set((Array.isArray(cities) ? cities : []).filter((item): item is string => typeof item === "string" && item.length > 1 && item.length <= 60))];
  if (list.length > LEAD_LIMITS.follows) throw new LeadError("En fazla 10 il takip edebilirsiniz.");
  const stamp = at.toISOString();
  const existing = await db.prepare("SELECT user_id FROM agent_lead_follows WHERE user_id=?").bind(agentId).first();
  if (existing) await db.prepare("UPDATE agent_lead_follows SET cities=?,updated_at=? WHERE user_id=?").bind(JSON.stringify(list), stamp, agentId).run();
  else await db.prepare("INSERT INTO agent_lead_follows(user_id,cities,updated_at) VALUES(?,?,?)").bind(agentId, JSON.stringify(list), stamp).run();
  return list;
}
/** Marks the board as read and returns how many requests are new since the last visit. */
export async function boardUnseen(db: LeadDatabase, agentId: string, at = new Date(), markSeen = false) {
  const { seenAt } = await leadFollows(db, agentId);
  const since = seenAt || new Date(at.getTime() - 7 * 86400000).toISOString();
  const row = await db.prepare("SELECT COUNT(*) AS n FROM home_requests WHERE status='open' AND expires_at>? AND created_at>? AND user_id<>?").bind(at.toISOString(), since, agentId).first<{ n: number }>();
  if (markSeen) {
    const existing = await db.prepare("SELECT user_id FROM agent_lead_follows WHERE user_id=?").bind(agentId).first();
    if (existing) await db.prepare("UPDATE agent_lead_follows SET seen_at=? WHERE user_id=?").bind(at.toISOString(), agentId).run();
    else await db.prepare("INSERT INTO agent_lead_follows(user_id,cities,seen_at,updated_at) VALUES(?,'[]',?,?)").bind(agentId, at.toISOString(), at.toISOString()).run();
  }
  return Number(row?.n) || 0;
}

/** Approved agents to e-mail about a new request in a province: those who follow it, or who have published listings there and follow nothing. */
export async function agentsToAlert(db: LeadDatabase, city: string, excludeUser: string) {
  await ensureLeads(db);
  const follows = (await db.prepare("SELECT f.user_id,f.cities FROM agent_lead_follows f JOIN users u ON CAST(u.id AS TEXT)=f.user_id WHERE u.role='agent' AND u.agent_status='approved'").all<{ user_id: string; cities: string }>()).results || [];
  const explicit = new Set<string>(), following = new Set<string>();
  for (const row of follows) { let cities: string[] = []; try { cities = JSON.parse(row.cities || "[]"); } catch { /* none */ } if (cities.length) { explicit.add(String(row.user_id)); if (cities.includes(city)) following.add(String(row.user_id)); } }
  const local = (await db.prepare("SELECT DISTINCT CAST(u.id AS TEXT) AS id FROM users u JOIN listings l ON l.owner_id=u.id WHERE u.role='agent' AND u.agent_status='approved' AND l.status='published' AND l.city=?").bind(city).all<{ id: string }>()).results || [];
  for (const row of local) if (!explicit.has(String(row.id))) following.add(String(row.id));
  following.delete(excludeUser);
  return [...following].map((id) => ({ id }));
}

/** What the member sees: offers and phone reveals per request, with the agent's name, office and fast-reply badge. */
export type MemberOffer = { agentId: string; agentName: string; company: string; message: string; listings: { id: string; title: string }[]; createdAt: string; fast: boolean };
export async function memberLeadActivity(db: LeadDatabase, requestId: string, at = new Date()) {
  await ensureLeads(db);
  const offers = (await db.prepare("SELECT o.agent_id,o.message,o.listing_ids,o.created_at,u.name,u.company FROM home_request_offers o JOIN users u ON CAST(u.id AS TEXT)=o.agent_id WHERE o.request_id=? ORDER BY o.created_at DESC").bind(requestId).all<Row>()).results || [];
  const out: MemberOffer[] = [];
  for (const row of offers) {
    const ids: string[] = JSON.parse(String(row.listing_ids || "[]"));
    const listings: { id: string; title: string }[] = [];
    for (const id of ids) { const listing = await db.prepare("SELECT CAST(id AS TEXT) AS id,title FROM listings WHERE CAST(id AS TEXT)=? AND status='published'").bind(id).first<Row>(); if (listing) listings.push({ id: String(listing.id), title: String(listing.title) }); }
    out.push({ agentId: String(row.agent_id), agentName: String(row.name || ""), company: String(row.company || ""), message: String(row.message), listings, createdAt: String(row.created_at), fast: (await responseStats(db, String(row.agent_id), at)).fast });
  }
  const reveals = (await db.prepare("SELECT v.agent_id,v.created_at,u.name,u.company FROM home_request_reveals v JOIN users u ON CAST(u.id AS TEXT)=v.agent_id WHERE v.request_id=? ORDER BY v.created_at DESC").bind(requestId).all<Row>()).results || [];
  return { offers: out, reveals: reveals.map((row) => ({ agentId: String(row.agent_id), agentName: String(row.name || ""), company: String(row.company || ""), createdAt: String(row.created_at) })) };
}
