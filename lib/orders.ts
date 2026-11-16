// Provider-independent orders for paid features. Today they are paid by bank transfer and
// confirmed by an administrator; a card provider can later confirm the same orders.
import { expireFirmPlans, grantFirmPlan, parsePlanId } from "./firm-plans";

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type OrderDatabase = { prepare(sql: string): Statement };

// Prices mirror the sample prices on /paketler; change them here before taking real payments.
export const CATALOG = {
  "featured-7": { kind: "featured", days: 7, amount: 250, currency: "TRY", label: "İlanı 7 gün öne çıkar" },
  "featured-30": { kind: "featured", days: 30, amount: 790, currency: "TRY", label: "İlanı 30 gün öne çıkar" },
  "plan-professional": { kind: "plan", plan: "professional", listingLimit: 5, days: 30, amount: 1490, currency: "TRY", label: "Profesyonel paket (30 gün)" },
  "plan-prestige": { kind: "plan", plan: "prestige", listingLimit: 20, days: 30, amount: 3990, currency: "TRY", label: "Prestij paket (30 gün)" },
  // Firm packages (lib/firm-plans.ts): a year costs ten months.
  "service-plus": { kind: "firm-plan", plan: "service-plus", days: 30, amount: 490, currency: "TRY", label: "Hizmet Plus (1 ay)" },
  "service-plus-year": { kind: "firm-plan", plan: "service-plus", days: 365, amount: 4900, currency: "TRY", label: "Hizmet Plus (1 yıl)" },
  "service-pro": { kind: "firm-plan", plan: "service-pro", days: 30, amount: 990, currency: "TRY", label: "Hizmet Pro (1 ay)" },
  "service-pro-year": { kind: "firm-plan", plan: "service-pro", days: 365, amount: 9900, currency: "TRY", label: "Hizmet Pro (1 yıl)" },
  "contractor-plus": { kind: "firm-plan", plan: "contractor-plus", days: 30, amount: 1000, currency: "TRY", label: "Müteahhit Plus (1 ay)" },
  "contractor-plus-year": { kind: "firm-plan", plan: "contractor-plus", days: 365, amount: 10000, currency: "TRY", label: "Müteahhit Plus (1 yıl)" },
  "contractor-pro": { kind: "firm-plan", plan: "contractor-pro", days: 30, amount: 4000, currency: "TRY", label: "Müteahhit Pro (1 ay)" },
  "contractor-pro-year": { kind: "firm-plan", plan: "contractor-pro", days: 365, amount: 40000, currency: "TRY", label: "Müteahhit Pro (1 yıl)" },
} as const;
export type CatalogItem = keyof typeof CATALOG;
export const ORDER_STATUSES = ["awaiting_payment", "fulfilled", "cancelled"] as const;

export const ORDER_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,item TEXT NOT NULL,listing_id TEXT,amount INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,provider TEXT NOT NULL,reference TEXT NOT NULL UNIQUE,admin_note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,fulfilled_at TEXT)",
  "CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id,created_at)",
  "CREATE TABLE IF NOT EXISTS listing_promotions(listing_id TEXT PRIMARY KEY,featured_until TEXT NOT NULL,order_id TEXT NOT NULL)",
];

export class OrderError extends Error { constructor(message: string, public status = 400) { super(message); } }

const ready = new WeakMap<object, Promise<unknown>>();
async function ensure(db: OrderDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = (async () => { for (const sql of ORDER_SCHEMA) await db.prepare(sql).run(); })(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const orderReference = () => "EM24-" + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHABET[b % ALPHABET.length]).join("");
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86400000).toISOString();

export type Order = { id: string; item: CatalogItem; listing_id: string | null; listing_title?: string | null; amount: number; currency: string; status: string; provider: string; reference: string; admin_note: string; created_at: string; fulfilled_at: string | null; user_name?: string; user_email?: string; featured_until?: string | null };

export async function createOrder(db: OrderDatabase, user: { id: string; role: string; accountKind?: string }, input: Record<string, unknown>, provider: string, at = new Date()) {
  const item = typeof input.item === "string" && input.item in CATALOG ? input.item as CatalogItem : null;
  if (!item) throw new OrderError("Geçersiz ürün.");
  const product = CATALOG[item];
  await ensure(db);
  let listingId: string | null = null;
  if (product.kind === "featured") {
    listingId = typeof input.listingId === "string" ? input.listingId : "";
    const listing = await db.prepare("SELECT CAST(owner_id AS TEXT) AS owner_id,status FROM listings WHERE CAST(id AS TEXT)=?").bind(listingId).first<{ owner_id: string; status: string }>();
    if (!listing || listing.owner_id !== user.id) throw new OrderError("İlan bulunamadı.", 404);
    if (listing.status !== "published") throw new OrderError("Yalnızca yayındaki ilanlar öne çıkarılabilir.");
  } else if (product.kind === "firm-plan") {
    if (parsePlanId(product.plan)?.kind !== user.accountKind) throw new OrderError(product.plan.startsWith("service") ? "Bu paket hizmet firması hesapları içindir." : "Bu paket müteahhit hesapları içindir.", 403);
  } else if (user.role !== "agent") throw new OrderError("Paketler emlakçı hesapları içindir.", 403);
  const open = await db.prepare("SELECT reference FROM orders WHERE user_id=? AND item=? AND COALESCE(listing_id,'')=? AND status='awaiting_payment'").bind(user.id, item, listingId || "").first<{ reference: string }>();
  if (open) throw new OrderError(`Bu ürün için bekleyen bir siparişiniz var: ${open.reference}`, 409);
  const id = crypto.randomUUID(), reference = orderReference(), stamp = at.toISOString();
  await db.prepare("INSERT INTO orders(id,user_id,item,listing_id,amount,currency,status,provider,reference,created_at,updated_at) VALUES(?,?,?,?,?,?,'awaiting_payment',?,?,?,?)")
    .bind(id, user.id, item, listingId, product.amount, product.currency, provider, reference, stamp, stamp).run();
  return { id, item, listingId, amount: product.amount, currency: product.currency, status: "awaiting_payment", provider, reference };
}

export async function userOrders(db: OrderDatabase, userId: string) {
  await ensure(db);
  return (await db.prepare("SELECT o.id,o.item,o.listing_id,l.title AS listing_title,o.amount,o.currency,o.status,o.provider,o.reference,o.admin_note,o.created_at,o.fulfilled_at,p.featured_until FROM orders o LEFT JOIN listings l ON CAST(l.id AS TEXT)=o.listing_id LEFT JOIN listing_promotions p ON p.listing_id=o.listing_id WHERE o.user_id=? ORDER BY o.created_at DESC LIMIT 100").bind(userId).all<Order>()).results;
}

export async function adminOrders(db: OrderDatabase, status: string) {
  await ensure(db);
  const filter = (ORDER_STATUSES as readonly string[]).includes(status) ? status : "awaiting_payment";
  return (await db.prepare("SELECT o.id,o.item,o.listing_id,l.title AS listing_title,o.amount,o.currency,o.status,o.provider,o.reference,o.admin_note,o.created_at,o.fulfilled_at,u.name AS user_name,u.email AS user_email FROM orders o JOIN users u ON CAST(u.id AS TEXT)=o.user_id LEFT JOIN listings l ON CAST(l.id AS TEXT)=o.listing_id WHERE o.status=? ORDER BY o.created_at DESC LIMIT 200").bind(filter).all<Order>()).results;
}

export async function cancelOrder(db: OrderDatabase, actor: { id: string; admin: boolean }, orderId: string, note = "", at = new Date()) {
  await ensure(db);
  const row = await db.prepare(`UPDATE orders SET status='cancelled',admin_note=?,updated_at=? WHERE id=? AND status='awaiting_payment'${actor.admin ? "" : " AND user_id=?"} RETURNING id`)
    .bind(...[note.slice(0, 500), at.toISOString(), orderId, ...(actor.admin ? [] : [actor.id])]).first();
  if (!row) throw new OrderError("Sipariş iptal edilemedi.", 409);
}

// Confirms payment and applies the product. Only one confirmation can win for an order.
export async function fulfillOrder(db: OrderDatabase, adminId: string, orderId: string, note = "", at = new Date()) {
  await ensure(db);
  const stamp = at.toISOString();
  const order = await db.prepare("UPDATE orders SET status='fulfilled',fulfilled_at=?,updated_at=?,admin_note=? WHERE id=? AND status='awaiting_payment' RETURNING id,user_id,item,listing_id,reference").bind(stamp, stamp, note.slice(0, 500), orderId).first<{ id: string; user_id: string; item: CatalogItem; listing_id: string | null; reference: string }>();
  if (!order) throw new OrderError("Sipariş bulunamadı veya zaten işlenmiş.", 409);
  const product = CATALOG[order.item];
  if (product.kind === "featured" && order.listing_id) {
    const current = await db.prepare("SELECT featured_until FROM listing_promotions WHERE listing_id=?").bind(order.listing_id).first<{ featured_until: string }>();
    const start = current && current.featured_until > stamp ? current.featured_until : stamp;
    const until = addDays(start, product.days);
    await db.prepare("INSERT INTO listing_promotions(listing_id,featured_until,order_id) VALUES(?,?,?) ON CONFLICT(listing_id) DO UPDATE SET featured_until=excluded.featured_until,order_id=excluded.order_id").bind(order.listing_id, until, order.id).run();
    await db.prepare("UPDATE listings SET featured=1 WHERE CAST(id AS TEXT)=?").bind(order.listing_id).run();
    return { reference: order.reference, featuredUntil: until };
  }
  if (product.kind === "plan") {
    const active = await db.prepare("SELECT id,ends_at FROM agent_plan_grants WHERE CAST(user_id AS TEXT)=? AND revoked_at IS NULL").bind(order.user_id).first<{ id: string; ends_at: string }>();
    const start = active && active.ends_at > stamp ? active.ends_at : stamp;
    if (active) await db.prepare("UPDATE agent_plan_grants SET revoked_at=? WHERE id=?").bind(stamp, active.id).run();
    const ends = addDays(start, product.days);
    await db.prepare("INSERT INTO agent_plan_grants(id,user_id,plan_id,listing_limit,starts_at,ends_at,note,granted_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), order.user_id, product.plan, product.listingLimit, stamp, ends, `Sipariş ${order.reference}`, adminId, stamp).run();
    return { reference: order.reference, planEndsAt: ends };
  }
  if (product.kind === "firm-plan") {
    const granted = await grantFirmPlan(db, order.user_id, product.plan, product.days, order.id, at);
    return { reference: order.reference, planEndsAt: granted.endsAt };
  }
  return { reference: order.reference };
}

// Daily: switch off featured flags whose paid period has ended.
export async function expirePromotions(db: OrderDatabase, at = new Date()) {
  await ensure(db);
  const stamp = at.toISOString();
  await db.prepare("UPDATE listings SET featured=0 WHERE CAST(id AS TEXT) IN (SELECT listing_id FROM listing_promotions WHERE featured_until<=?)").bind(stamp).run();
  await db.prepare("DELETE FROM listing_promotions WHERE featured_until<=?").bind(stamp).run();
  // Firm packages end the same way (lib/firm-plans.ts).
  await expireFirmPlans(db, at);
}
