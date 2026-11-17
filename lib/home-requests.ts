// "Benim için bul" (/benim-icin-bul): a member describes the home they want to buy or rent; the request goes to
// up to HOME_REQUEST_LIMITS.agents approved estate agents with published listings of that kind in that place,
// most listings first (district, then the whole province). The member agrees that these agents see the name,
// e-mail and phone; agents answer by phone, WhatsApp or e-mail outside the site. Tables are created on first use
// and work on PostgreSQL and SQLite (docs/home-requests.md).
interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type HomeRequestDatabase = { prepare(sql: string): Statement };

export const HOME_REQUEST_LIMITS = { perDay: 3, agents: 8, days: 30, noteMax: 1000 } as const;
export const HOME_INTENTS = ["buy", "rent"] as const;
export type HomeIntent = typeof HOME_INTENTS[number];
export const HOME_CATEGORIES = ["konut", "arsa", "isyeri"] as const;
export const HOME_ROOMS = ["1+0", "1+1", "2+1", "3+1", "4+1", "5+1 ve üzeri"] as const;
export const HOME_REQUEST_STATES = ["new", "seen", "contacted", "passed"] as const;

export const HOME_REQUEST_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS home_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,intent TEXT NOT NULL,city TEXT NOT NULL,district TEXT NOT NULL DEFAULT '',category TEXT NOT NULL,rooms TEXT NOT NULL DEFAULT '',budget_min INTEGER,budget_max INTEGER,note TEXT NOT NULL DEFAULT '',name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL,expires_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS home_requests_user_idx ON home_requests(user_id,created_at)",
  "CREATE TABLE IF NOT EXISTS home_request_agents(request_id TEXT NOT NULL,agent_id TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'new',updated_at TEXT NOT NULL,PRIMARY KEY(request_id,agent_id))",
  "CREATE INDEX IF NOT EXISTS home_request_agents_agent_idx ON home_request_agents(agent_id,state)",
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

export type HomeRequestInput = { intent: HomeIntent; city: string; district: string; category: string; rooms: string; budgetMin: number | null; budgetMax: number | null; note: string; name: string; email: string; phone: string };
export function validateHomeRequest(input: Record<string, unknown>): HomeRequestInput {
  const intent = HOME_INTENTS.find((item) => item === input.intent);
  if (!intent) throw new HomeRequestError("Satın almak mı, kiralamak mı istediğinizi seçin.");
  const city = text(input.city, 60), district = text(input.district, 60);
  if (!city) throw new HomeRequestError("İl seçin.");
  const category = HOME_CATEGORIES.find((item) => item === input.category) || "konut";
  const rooms = category === "konut" ? (HOME_ROOMS.find((item) => item === input.rooms) || "") : "";
  const budgetMin = budget(input.budgetMin), budgetMax = budget(input.budgetMax);
  if (budgetMin && budgetMax && budgetMin > budgetMax) throw new HomeRequestError("En düşük bütçe en yüksek bütçeden büyük olamaz.");
  const note = typeof input.note === "string" ? input.note.trim().slice(0, HOME_REQUEST_LIMITS.noteMax) : "";
  const name = text(input.name, 100), email = text(input.email, 160).toLowerCase(), phone = text(input.phone, 30);
  if (name.length < 2) throw new HomeRequestError("Adınızı yazın.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HomeRequestError("Geçerli bir e-posta adresi girin.");
  if (phone && !/^\+?[\d\s()-]{7,20}$/.test(phone)) throw new HomeRequestError("Telefon numarasını kontrol edin.");
  if (input.consent !== true) throw new HomeRequestError("Bilgilerinizin seçilen danışmanlarla paylaşılmasını onaylayın.");
  return { intent, city, district, category, rooms, budgetMin, budgetMax, note, name, email, phone };
}

/** Approved estate agents with published listings of this kind in the place: the district first, then the province. */
export async function matchingAgents(db: HomeRequestDatabase, request: Pick<HomeRequestInput, "intent" | "city" | "district" | "category">, excludeUser: string, limit: number = HOME_REQUEST_LIMITS.agents) {
  const types = CATEGORY_TYPES[request.category] || CATEGORY_TYPES.konut, marks = types.map(() => "?").join(",");
  const query = (district: boolean) => db.prepare(`SELECT CAST(u.id AS TEXT) AS id,u.name,COUNT(l.id) AS listings FROM users u JOIN listings l ON l.owner_id=u.id
    WHERE u.role='agent' AND u.agent_status='approved' AND CAST(u.id AS TEXT)<>? AND l.status='published' AND l.purpose=? AND l.city=?${district ? " AND l.district=?" : ""} AND l.property_type IN (${marks})
    GROUP BY u.id,u.name ORDER BY COUNT(l.id) DESC,u.name ASC LIMIT ?`)
    .bind(excludeUser, purposeOf(request.intent), request.city, ...(district ? [request.district] : []), ...types, limit).all<{ id: string; name: string; listings: number }>();
  const found = request.district ? ((await query(true)).results || []) : [];
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
  for (const agent of agents) await db.prepare("INSERT INTO home_request_agents(request_id,agent_id,state,updated_at) VALUES(?,?,'new',?)").bind(id, agent.id, stamp).run();
  return { id, agents, request };
}

export type HomeRequest = { id: string; intent: HomeIntent; city: string; district: string; category: string; rooms: string; budgetMin: number | null; budgetMax: number | null; note: string; status: "open" | "closed" | "expired"; createdAt: string; expiresAt: string };
type Row = Record<string, unknown>;
const toRequest = (row: Row, at: Date): HomeRequest => ({
  id: String(row.id), intent: row.intent === "rent" ? "rent" : "buy", city: String(row.city), district: String(row.district || ""), category: String(row.category), rooms: String(row.rooms || ""),
  budgetMin: row.budget_min == null ? null : Number(row.budget_min), budgetMax: row.budget_max == null ? null : Number(row.budget_max), note: String(row.note || ""),
  status: row.status === "closed" ? "closed" : String(row.expires_at) <= at.toISOString() ? "expired" : "open", createdAt: String(row.created_at), expiresAt: String(row.expires_at),
});

/** The member's own requests with how many agents received them. */
export async function myHomeRequests(db: HomeRequestDatabase, userId: string, at = new Date()) {
  await ensure(db);
  const rows = (await db.prepare("SELECT r.*,(SELECT COUNT(*) FROM home_request_agents a WHERE a.request_id=r.id) AS agents FROM home_requests r WHERE r.user_id=? ORDER BY r.created_at DESC LIMIT 50").bind(userId).all<Row>()).results || [];
  return rows.map((row) => ({ ...toRequest(row, at), agents: Number(row.agents) || 0 }));
}
export async function closeHomeRequest(db: HomeRequestDatabase, userId: string, id: unknown) {
  await ensure(db);
  if (typeof id !== "string" || id.length > 60) throw new HomeRequestError("Talep bulunamadı.", 404);
  const row = await db.prepare("SELECT id FROM home_requests WHERE id=? AND user_id=?").bind(id, userId).first();
  if (!row) throw new HomeRequestError("Talep bulunamadı.", 404);
  await db.prepare("UPDATE home_requests SET status='closed' WHERE id=?").bind(id).run();
}

export type AgentHomeRequest = HomeRequest & { state: string; name: string; email: string; phone: string };
/** Requests sent to an agent, newest first; open ones carry the member's contact details (shared with consent). */
export async function agentHomeRequests(db: HomeRequestDatabase, agentId: string, at = new Date()): Promise<AgentHomeRequest[]> {
  await ensure(db);
  const rows = (await db.prepare("SELECT r.*,a.state FROM home_request_agents a JOIN home_requests r ON r.id=a.request_id WHERE a.agent_id=? ORDER BY r.created_at DESC LIMIT 100").bind(agentId).all<Row>()).results || [];
  await db.prepare("UPDATE home_request_agents SET state='seen',updated_at=? WHERE agent_id=? AND state='new'").bind(at.toISOString(), agentId).run();
  return rows.map((row) => { const request = toRequest(row, at), open = request.status === "open"; return { ...request, state: String(row.state), name: String(row.name), email: open ? String(row.email) : "", phone: open ? String(row.phone || "") : "" }; });
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
