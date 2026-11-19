// "Benim için bul" (/benim-icin-bul): a member describes the home they want to buy or rent; the request goes to
// up to HOME_REQUEST_LIMITS.agents approved estate agents with published listings of that kind in that place,
// most listings first (the chosen districts, then the whole province). The member agrees that these agents see
// the name, e-mail and phone. Since 2026-11-19 the request also carries the search in detail (types, up to three
// districts, rooms, size, must-haves, timing, payment, buyer profile, contact preference) in home_request_details,
// the member follows it in Hesabım (who saw it, who got in touch, matching listings) and can close it with a
// reason, extend or reopen it. Tables are created on first use and work on PostgreSQL and SQLite
// (docs/buyer-tools.md).
interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type HomeRequestDatabase = { prepare(sql: string): Statement };

export const HOME_REQUEST_LIMITS = { perDay: 3, agents: 8, days: 30, noteMax: 1000, districts: 3, rooms: 3, features: 10, maxDays: 90 } as const;
export const HOME_INTENTS = ["buy", "rent"] as const;
export type HomeIntent = typeof HOME_INTENTS[number];
export const HOME_CATEGORIES = ["konut", "arsa", "isyeri"] as const;
export const HOME_ROOMS = ["1+0", "1+1", "2+1", "3+1", "4+1", "5+1 ve üzeri"] as const;
export const HOME_REQUEST_STATES = ["new", "seen", "contacted", "passed"] as const;
/** Property types per category, with the labels the site already uses (lib/listings.ts PROPERTY_TYPES). */
export const HOME_TYPES: Record<string, { value: string; label: string }[]> = {
  konut: [{ value: "daire", label: "Daire" }, { value: "rezidans", label: "Rezidans" }, { value: "mustakil", label: "Müstakil Ev" }, { value: "villa", label: "Villa" }, { value: "yazlik", label: "Yazlık" }, { value: "ciftlik-evi", label: "Çiftlik Evi" }, { value: "yali-dairesi", label: "Yalı Dairesi" }, { value: "kooperatif", label: "Kooperatif" }],
  arsa: [{ value: "arsa", label: "Arsa" }],
  isyeri: [{ value: "ticari", label: "İş yeri" }],
};
/** Must-haves: listing amenities plus what agents check by hand. */
export const HOME_FEATURES = ["Deniz manzarası", "Bahçe", "Balkon", "Teras", "Havuz", "Otopark", "Asansör", "Güvenlik", "Site içinde", "Eşyalı", "Okula yakın", "Toplu taşımaya yakın", "Krediye uygun", "Yeni bina", "Evcil hayvan kabul"] as const;
export const HOME_TIMELINES = { now: "Hemen", soon: "1–3 ay içinde", later: "3–6 ay içinde", browsing: "Sadece bakıyorum" } as const;
export const HOME_PAYMENTS = { cash: "Nakit", approved: "Kredi onaylı", mortgage: "Kredi kullanacağım", swap: "Takas olabilir" } as const;
export const HOME_CONTACT = { phone: "Telefon", whatsapp: "WhatsApp", email: "E-posta" } as const;
export const HOME_CONTACT_TIMES = { any: "Fark etmez", morning: "Sabah (09–12)", afternoon: "Öğleden sonra (12–18)", evening: "Akşam (18–21)" } as const;
export const HOME_CLOSE_REASONS = { found_here: "Buldum, bu site üzerinden", found_elsewhere: "Buldum, başka bir yerden", paused: "Aramayı erteledim", other: "Diğer" } as const;
const LANGS = ["tr", "de", "fr", "en", "ar", "fa", "ru", "nl"] as const;

export const HOME_REQUEST_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS home_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,intent TEXT NOT NULL,city TEXT NOT NULL,district TEXT NOT NULL DEFAULT '',category TEXT NOT NULL,rooms TEXT NOT NULL DEFAULT '',budget_min INTEGER,budget_max INTEGER,note TEXT NOT NULL DEFAULT '',name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL,expires_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS home_requests_user_idx ON home_requests(user_id,created_at)",
  "CREATE TABLE IF NOT EXISTS home_request_agents(request_id TEXT NOT NULL,agent_id TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'new',updated_at TEXT NOT NULL,PRIMARY KEY(request_id,agent_id))",
  "CREATE INDEX IF NOT EXISTS home_request_agents_agent_idx ON home_request_agents(agent_id,state)",
  // The detailed search and the closing reason (2026-11-19); older requests simply have no row.
  "CREATE TABLE IF NOT EXISTS home_request_details(request_id TEXT PRIMARY KEY,data TEXT NOT NULL DEFAULT '{}',close_reason TEXT NOT NULL DEFAULT '',closed_at TEXT)",
];
const ready = new WeakMap<object, Promise<unknown>>();
async function ensure(db: HomeRequestDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = (async () => { for (const sql of HOME_REQUEST_SCHEMA) await db.prepare(sql).run(); })(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}

export class HomeRequestError extends Error { constructor(message: string, public status = 400) { super(message); } }
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
const budget = (value: unknown) => { const n = Number(String(value ?? "").replace(/\D/g, "")); return Number.isFinite(n) && n > 0 && n < 1e12 ? n : null; };
const purposeOf = (intent: HomeIntent) => intent === "buy" ? "satilik" : "kiralik";
const CATEGORY_TYPES: Record<string, string[]> = { konut: ["daire", "rezidans", "mustakil", "villa", "ciftlik-evi", "kosk-konak", "yali", "yali-dairesi", "yazlik", "kooperatif"], arsa: ["arsa"], isyeri: ["ticari"] };
const list = (value: unknown) => Array.isArray(value) ? value : typeof value === "string" && value ? value.split(",") : [];
const pick = <T extends string>(value: unknown, allowed: readonly T[]) => allowed.find((item) => item === value);

/** Detailed search, stored as JSON in home_request_details. */
export type HomeRequestDetails = {
  types: string[]; districts: string[]; rooms: string[]; minArea: number | null; features: string[];
  timeline: keyof typeof HOME_TIMELINES | ""; payment: keyof typeof HOME_PAYMENTS | ""; foreign: boolean; citizenship: boolean;
  contact: keyof typeof HOME_CONTACT; contactTime: keyof typeof HOME_CONTACT_TIMES; language: typeof LANGS[number]; alert: boolean;
};
export type HomeRequestInput = { intent: HomeIntent; city: string; district: string; category: string; rooms: string; budgetMin: number | null; budgetMax: number | null; note: string; name: string; email: string; phone: string; details: HomeRequestDetails };

export function validateHomeRequest(input: Record<string, unknown>): HomeRequestInput {
  const intent = HOME_INTENTS.find((item) => item === input.intent);
  if (!intent) throw new HomeRequestError("Satın almak mı, kiralamak mı istediğinizi seçin.");
  const city = text(input.city, 60);
  if (!city) throw new HomeRequestError("İl seçin.");
  // Up to three districts; the old single "district" field still works.
  const districts = [...new Set([...list(input.districts), input.district].map((item) => text(item, 60)).filter(Boolean))];
  if (districts.length > HOME_REQUEST_LIMITS.districts) throw new HomeRequestError("En fazla 3 ilçe seçebilirsiniz.");
  const category = HOME_CATEGORIES.find((item) => item === input.category) || "konut";
  const allowedTypes = HOME_TYPES[category].map((item) => item.value);
  const types = [...new Set(list(input.types).filter((item): item is string => typeof item === "string" && allowedTypes.includes(item)))];
  const rooms = category === "konut" ? [...new Set([...list(input.roomsList), input.rooms].filter((item): item is string => typeof item === "string" && (HOME_ROOMS as readonly string[]).includes(item)))] : [];
  if (rooms.length > HOME_REQUEST_LIMITS.rooms) throw new HomeRequestError("En fazla 3 oda seçeneği seçebilirsiniz.");
  const budgetMin = budget(input.budgetMin), budgetMax = budget(input.budgetMax);
  if (budgetMin && budgetMax && budgetMin > budgetMax) throw new HomeRequestError("En düşük bütçe en yüksek bütçeden büyük olamaz.");
  const minArea = budget(input.minArea);
  if (minArea != null && minArea > 100000) throw new HomeRequestError("En az metrekareyi kontrol edin.");
  const features = [...new Set(list(input.features).filter((item): item is string => typeof item === "string" && (HOME_FEATURES as readonly string[]).includes(item)))].slice(0, HOME_REQUEST_LIMITS.features);
  const note = typeof input.note === "string" ? input.note.trim().slice(0, HOME_REQUEST_LIMITS.noteMax) : "";
  const name = text(input.name, 100), email = text(input.email, 160).toLowerCase(), phone = text(input.phone, 30);
  if (name.length < 2) throw new HomeRequestError("Adınızı yazın.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HomeRequestError("Geçerli bir e-posta adresi girin.");
  if (phone && !/^\+?[\d\s()-]{7,20}$/.test(phone)) throw new HomeRequestError("Telefon numarasını kontrol edin.");
  const contact = pick(input.contact, Object.keys(HOME_CONTACT) as (keyof typeof HOME_CONTACT)[]) || (phone ? "phone" : "email");
  if (contact !== "email" && !phone) throw new HomeRequestError("Telefon veya WhatsApp ile aranmak için telefon numaranızı yazın.");
  if (input.consent !== true) throw new HomeRequestError("Bilgilerinizin seçilen danışmanlarla paylaşılmasını onaylayın.");
  const foreign = input.foreign === true;
  const details: HomeRequestDetails = {
    types, districts, rooms, minArea, features,
    timeline: pick(input.timeline, Object.keys(HOME_TIMELINES) as (keyof typeof HOME_TIMELINES)[]) || "",
    payment: intent === "buy" ? pick(input.payment, Object.keys(HOME_PAYMENTS) as (keyof typeof HOME_PAYMENTS)[]) || "" : "",
    foreign, citizenship: intent === "buy" && foreign && input.citizenship === true,
    contact, contactTime: pick(input.contactTime, Object.keys(HOME_CONTACT_TIMES) as (keyof typeof HOME_CONTACT_TIMES)[]) || "any",
    language: pick(input.language, LANGS) || "tr", alert: input.alert !== false,
  };
  return { intent, city, district: districts[0] || "", category, rooms: rooms.join(", "), budgetMin, budgetMax, note, name, email, phone, details };
}

/** Approved estate agents with published listings of this kind in the place: the chosen districts first, then the province. */
export async function matchingAgents(db: HomeRequestDatabase, request: Pick<HomeRequestInput, "intent" | "city" | "district" | "category"> & { details?: Pick<HomeRequestDetails, "types" | "districts"> }, excludeUser: string, limit: number = HOME_REQUEST_LIMITS.agents) {
  const types = request.details?.types.length ? request.details.types : CATEGORY_TYPES[request.category] || CATEGORY_TYPES.konut, marks = types.map(() => "?").join(",");
  const districts = request.details?.districts.length ? request.details.districts : request.district ? [request.district] : [];
  const query = (inDistricts: boolean) => db.prepare(`SELECT CAST(u.id AS TEXT) AS id,u.name,COUNT(l.id) AS listings FROM users u JOIN listings l ON l.owner_id=u.id
    WHERE u.role='agent' AND u.agent_status='approved' AND CAST(u.id AS TEXT)<>? AND l.status='published' AND l.purpose=? AND l.city=?${inDistricts ? ` AND l.district IN (${districts.map(() => "?").join(",")})` : ""} AND l.property_type IN (${marks})
    GROUP BY u.id,u.name ORDER BY COUNT(l.id) DESC,u.name ASC LIMIT ?`)
    .bind(excludeUser, purposeOf(request.intent), request.city, ...(inDistricts ? districts : []), ...types, limit).all<{ id: string; name: string; listings: number }>();
  const found = districts.length ? ((await query(true)).results || []) : [];
  if (found.length < limit) for (const row of (await query(false)).results || []) if (found.length < limit && !found.some((item) => item.id === row.id)) found.push(row);
  return found.map((row) => ({ id: String(row.id), name: String(row.name || ""), listings: Number(row.listings) || 0 }));
}

export async function createHomeRequest(db: HomeRequestDatabase, userId: string, input: Record<string, unknown>, at = new Date()) {
  const request = validateHomeRequest(input);
  await ensure(db);
  const since = new Date(at.getTime() - 86400000).toISOString();
  const today = await db.prepare("SELECT COUNT(*) AS n FROM home_requests WHERE user_id=? AND created_at>?").bind(userId, since).first<{ n: number }>();
  if (Number(today?.n) >= HOME_REQUEST_LIMITS.perDay) throw new HomeRequestError("Bugün en fazla 3 talep gönderebilirsiniz. Yarın tekrar deneyin.", 429);
  const agents = await matchingAgents(db, request, userId);
  if (!agents.length) throw new HomeRequestError("Bu bölgede şu an uygun danışman bulunamadı. İli genişleterek tekrar deneyin.", 404);
  const id = crypto.randomUUID(), stamp = at.toISOString(), expires = new Date(at.getTime() + HOME_REQUEST_LIMITS.days * 86400000).toISOString();
  await db.prepare("INSERT INTO home_requests(id,user_id,intent,city,district,category,rooms,budget_min,budget_max,note,name,email,phone,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'open',?,?)")
    .bind(id, userId, request.intent, request.city, request.district, request.category, request.rooms, request.budgetMin, request.budgetMax, request.note, request.name, request.email, request.phone, stamp, expires).run();
  await db.prepare("INSERT INTO home_request_details(request_id,data) VALUES(?,?)").bind(id, JSON.stringify(request.details)).run();
  for (const agent of agents) await db.prepare("INSERT INTO home_request_agents(request_id,agent_id,state,updated_at) VALUES(?,?,'new',?)").bind(id, agent.id, stamp).run();
  return { id, agents, request };
}

export type HomeRequest = { id: string; intent: HomeIntent; city: string; district: string; category: string; rooms: string; budgetMin: number | null; budgetMax: number | null; note: string; status: "open" | "closed" | "expired"; createdAt: string; expiresAt: string; details: HomeRequestDetails | null; closeReason: string };
type Row = Record<string, unknown>;
function parseDetails(value: unknown): HomeRequestDetails | null {
  if (typeof value !== "string" || !value || value === "{}") return null;
  try { const data = JSON.parse(value) as Partial<HomeRequestDetails>; return { types: [], districts: [], rooms: [], minArea: null, features: [], timeline: "", payment: "", foreign: false, citizenship: false, contact: "email", contactTime: "any", language: "tr", alert: false, ...data }; } catch { return null; }
}
const toRequest = (row: Row, at: Date): HomeRequest => ({
  id: String(row.id), intent: row.intent === "rent" ? "rent" : "buy", city: String(row.city), district: String(row.district || ""), category: String(row.category), rooms: String(row.rooms || ""),
  budgetMin: row.budget_min == null ? null : Number(row.budget_min), budgetMax: row.budget_max == null ? null : Number(row.budget_max), note: String(row.note || ""),
  status: row.status === "closed" ? "closed" : String(row.expires_at) <= at.toISOString() ? "expired" : "open", createdAt: String(row.created_at), expiresAt: String(row.expires_at),
  details: parseDetails(row.details), closeReason: String(row.close_reason || ""),
});
const WITH_DETAILS = "LEFT JOIN home_request_details d ON d.request_id=r.id";

/** Listing search for a request (/ilanlar and /api/listings): the parts the search can express exactly. */
export function homeRequestSearch(request: Pick<HomeRequest, "intent" | "city" | "district" | "category" | "budgetMin" | "budgetMax" | "details">) {
  const params = new URLSearchParams({ purpose: purposeOf(request.intent), city: request.city });
  const districts = request.details?.districts.length ? request.details.districts : request.district ? [request.district] : [];
  if (districts.length === 1) params.set("district", districts[0]);
  const types = request.details?.types || [];
  if (types.length === 1) params.set("type", types[0]); else params.set("category", request.category);
  const rooms = request.details?.rooms || [];
  if (rooms.length === 1 && rooms[0] !== "5+1 ve üzeri") params.set("rooms", rooms[0]);
  if (request.budgetMin) params.set("minPrice", String(request.budgetMin));
  if (request.budgetMax) params.set("maxPrice", String(request.budgetMax));
  if (request.details?.minArea) params.set("minArea", String(request.details.minArea));
  return params.toString();
}

export type AgentContact = { id: string; name: string; company: string; state: string };
export type MyHomeRequest = HomeRequest & { agents: number; seen: number; contacted: number; contactedAgents: AgentContact[]; search: string };
/** The member's own requests: how many agents received, saw and answered them, and who got in touch. */
export async function myHomeRequests(db: HomeRequestDatabase, userId: string, at = new Date()): Promise<MyHomeRequest[]> {
  await ensure(db);
  const rows = (await db.prepare(`SELECT r.*,d.data AS details,d.close_reason,
    (SELECT COUNT(*) FROM home_request_agents a WHERE a.request_id=r.id) AS agents,
    (SELECT COUNT(*) FROM home_request_agents a WHERE a.request_id=r.id AND a.state<>'new') AS seen,
    (SELECT COUNT(*) FROM home_request_agents a WHERE a.request_id=r.id AND a.state='contacted') AS contacted
    FROM home_requests r ${WITH_DETAILS} WHERE r.user_id=? ORDER BY r.created_at DESC LIMIT 50`).bind(userId).all<Row>()).results || [];
  const out: MyHomeRequest[] = [];
  for (const row of rows) {
    const request = toRequest(row, at);
    const contactedAgents = Number(row.contacted) ? ((await db.prepare("SELECT CAST(u.id AS TEXT) AS id,u.name,u.company,a.state FROM home_request_agents a JOIN users u ON CAST(u.id AS TEXT)=a.agent_id WHERE a.request_id=? AND a.state='contacted' ORDER BY a.updated_at").bind(request.id).all<Row>()).results || [])
      .map((agent) => ({ id: String(agent.id), name: String(agent.name || ""), company: String(agent.company || ""), state: String(agent.state) })) : [];
    out.push({ ...request, agents: Number(row.agents) || 0, seen: Number(row.seen) || 0, contacted: Number(row.contacted) || 0, contactedAgents, search: homeRequestSearch(request) });
  }
  return out;
}

async function ownRequest(db: HomeRequestDatabase, userId: string, id: unknown) {
  await ensure(db);
  if (typeof id !== "string" || id.length > 60) throw new HomeRequestError("Talep bulunamadı.", 404);
  const row = await db.prepare("SELECT * FROM home_requests WHERE id=? AND user_id=?").bind(id, userId).first<Row>();
  if (!row) throw new HomeRequestError("Talep bulunamadı.", 404);
  return row;
}
async function saveDetailsRow(db: HomeRequestDatabase, id: string, reason: string, closedAt: string | null) {
  const existing = await db.prepare("SELECT request_id FROM home_request_details WHERE request_id=?").bind(id).first();
  if (existing) await db.prepare("UPDATE home_request_details SET close_reason=?,closed_at=? WHERE request_id=?").bind(reason, closedAt, id).run();
  else await db.prepare("INSERT INTO home_request_details(request_id,data,close_reason,closed_at) VALUES(?,'{}',?,?)").bind(id, reason, closedAt).run();
}
/** Closing tells the agents the search is over (their copy loses the contact details). */
export async function closeHomeRequest(db: HomeRequestDatabase, userId: string, id: unknown, reason: unknown = "other", at = new Date()) {
  await ownRequest(db, userId, id);
  const why = pick(reason, Object.keys(HOME_CLOSE_REASONS)) || "other";
  await db.prepare("UPDATE home_requests SET status='closed' WHERE id=?").bind(String(id)).run();
  await saveDetailsRow(db, String(id), why, at.toISOString());
}
/** Another 30 days for an open or expired request (also reopens a closed one), at most 90 days from now. */
export async function extendHomeRequest(db: HomeRequestDatabase, userId: string, id: unknown, at = new Date()) {
  const row = await ownRequest(db, userId, id);
  const from = Math.max(at.getTime(), Date.parse(String(row.expires_at)) || 0);
  const until = Math.min(from + HOME_REQUEST_LIMITS.days * 86400000, at.getTime() + HOME_REQUEST_LIMITS.maxDays * 86400000);
  await db.prepare("UPDATE home_requests SET status='open',expires_at=? WHERE id=?").bind(new Date(until).toISOString(), String(id)).run();
  if (row.status === "closed") await saveDetailsRow(db, String(id), "", null);
  return new Date(until).toISOString();
}

export type AgentHomeRequest = HomeRequest & { state: string; name: string; email: string; phone: string };
/** Requests sent to an agent, newest first; open ones carry the member's contact details (shared with consent). */
export async function agentHomeRequests(db: HomeRequestDatabase, agentId: string, at = new Date()): Promise<AgentHomeRequest[]> {
  await ensure(db);
  const rows = (await db.prepare(`SELECT r.*,a.state,d.data AS details,d.close_reason FROM home_request_agents a JOIN home_requests r ON r.id=a.request_id ${WITH_DETAILS} WHERE a.agent_id=? ORDER BY r.created_at DESC LIMIT 100`).bind(agentId).all<Row>()).results || [];
  await db.prepare("UPDATE home_request_agents SET state='seen',updated_at=? WHERE agent_id=? AND state='new'").bind(at.toISOString(), agentId).run();
  return rows.map((row) => { const request = toRequest(row, at), open = request.status === "open"; return { ...request, closeReason: "", state: String(row.state), name: String(row.name), email: open ? String(row.email) : "", phone: open ? String(row.phone || "") : "" }; });
}
export async function newHomeRequestCount(db: HomeRequestDatabase, agentId: string, at = new Date()) {
  await ensure(db);
  const row = await db.prepare("SELECT COUNT(*) AS n FROM home_request_agents a JOIN home_requests r ON r.id=a.request_id WHERE a.agent_id=? AND a.state='new' AND r.status='open' AND r.expires_at>?").bind(agentId, at.toISOString()).first<{ n: number }>();
  return Number(row?.n) || 0;
}
export async function setHomeRequestState(db: HomeRequestDatabase, agentId: string, id: unknown, state: unknown, at = new Date()) {
  await ensure(db);
  if (typeof id !== "string" || !["contacted", "passed"].includes(String(state))) throw new HomeRequestError("Geçersiz işlem.");
  const row = await db.prepare("SELECT request_id FROM home_request_agents WHERE request_id=? AND agent_id=?").bind(id, agentId).first();
  if (!row) throw new HomeRequestError("Talep bulunamadı.", 404);
  await db.prepare("UPDATE home_request_agents SET state=?,updated_at=? WHERE request_id=? AND agent_id=?").bind(String(state), at.toISOString(), id, agentId).run();
}

/** Short summary for e-mails and saved-search names: "Satılık · Karşıyaka, Bornova, İzmir · Daire · 3+1". */
export function homeRequestSummary(request: Pick<HomeRequestInput, "intent" | "city" | "district" | "rooms" | "category"> & { details?: HomeRequestDetails | null }) {
  const districts = request.details?.districts.length ? request.details.districts.join(", ") : request.district;
  const types = (request.details?.types || []).map((value) => HOME_TYPES[request.category]?.find((item) => item.value === value)?.label || value).join(", ");
  return [request.intent === "buy" ? "Satılık" : "Kiralık", `${districts ? `${districts}, ` : ""}${request.city}`, types, request.rooms].filter(Boolean).join(" · ");
}
