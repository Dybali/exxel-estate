// Monthly packages for service firms and contractors (owner's decision 2026-11-16, docs/firm-plans.md).
// No fee per offer or per job: a firm registers for free and pays a fixed monthly price for more photos,
// messaging with customers (machine translated, lib/message-translations.ts) and, for Pro, a higher place in
// lists. Bought through the order flow (lib/orders.ts, CATALOG "service-plus" …), stored per account in
// firm_plans (created on first use). The limits only apply while FIRM_PLANS=1 is set on the server; until
// then every firm keeps the Pro limits (without the featured place) so nothing changes for existing firms.
interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type FirmPlanDatabase = { prepare(sql: string): Statement };

export type FirmKind = "service" | "contractor";
export type FirmTier = "free" | "plus" | "pro";
export const FIRM_TIERS: readonly FirmTier[] = ["free", "plus", "pro"];
export type FirmLimits = {
  /** Work photos (service firm) or completed projects (contractor). */
  photos: number; projects: number; projectPhotos: number;
  messaging: boolean; statsDays: 7 | 30 | 90; featured: boolean;
  /** Land requests (contractors): none, after LAND_DELAY_HOURS, or at once. */
  land: "none" | "delayed" | "first";
};
export const LAND_DELAY_HOURS = 24;

const base = { photos: 0, projects: 0, projectPhotos: 0, land: "none" } as const;
export const FIRM_LIMITS: Record<FirmKind, Record<FirmTier, FirmLimits>> = {
  service: {
    free: { ...base, photos: 1, messaging: false, statsDays: 7, featured: false },
    plus: { ...base, photos: 5, messaging: true, statsDays: 30, featured: false },
    pro: { ...base, photos: 20, messaging: true, statsDays: 90, featured: true },
  },
  contractor: {
    free: { ...base, projects: 1, projectPhotos: 1, messaging: false, statsDays: 7, featured: false, land: "none" },
    plus: { ...base, projects: 10, projectPhotos: 5, messaging: true, statsDays: 30, featured: false, land: "delayed" },
    pro: { ...base, projects: 30, projectPhotos: 20, messaging: true, statsDays: 90, featured: true, land: "first" },
  },
};
/** Monthly prices in TRY, VAT excluded; a year costs ten months. */
export const FIRM_PRICES: Record<FirmKind, Record<Exclude<FirmTier, "free">, number>> = { service: { plus: 490, pro: 990 }, contractor: { plus: 1000, pro: 4000 } };

export const firmPlansEnabled = (settings: { FIRM_PLANS?: unknown } | null | undefined) => String(settings?.FIRM_PLANS ?? "") === "1";
/** Limits that apply now: the real tier when packages are switched on, otherwise Pro without the featured place. */
export function firmLimits(kind: FirmKind, tier: FirmTier, enabled: boolean): FirmLimits {
  return enabled ? FIRM_LIMITS[kind][tier] : { ...FIRM_LIMITS[kind].pro, featured: false };
}

/** Land requests a contractor may see: undefined = all, a time = created up to then, null = none. */
export function landCutoff(limits: FirmLimits, at = new Date()): string | undefined | null {
  if (limits.land === "first") return undefined;
  return limits.land === "delayed" ? new Date(at.getTime() - LAND_DELAY_HOURS * 3600_000).toISOString() : null;
}

export const FIRM_PLAN_SCHEMA = "CREATE TABLE IF NOT EXISTS firm_plans(user_id TEXT PRIMARY KEY,plan TEXT NOT NULL,ends_at TEXT NOT NULL,order_id TEXT,updated_at TEXT NOT NULL)";
const ready = new WeakMap<object, Promise<unknown>>();
export async function ensureFirmPlans(db: FirmPlanDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = db.prepare(FIRM_PLAN_SCHEMA).run(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}

const planId = (kind: FirmKind, tier: FirmTier) => `${kind}-${tier}`;
export const parsePlanId = (value: unknown): { kind: FirmKind; tier: Exclude<FirmTier, "free"> } | null => {
  const match = typeof value === "string" ? /^(service|contractor)-(plus|pro)$/.exec(value) : null;
  return match ? { kind: match[1] as FirmKind, tier: match[2] as "plus" | "pro" } : null;
};
const firmTable = (kind: FirmKind) => kind === "service" ? "service_firms" : "contractor_firms";

export type FirmPlan = { tier: FirmTier; endsAt: string | null };
/** The account's active package for this kind of firm; "free" without one. */
export async function firmPlan(db: FirmPlanDatabase, userId: string, kind: FirmKind, at = new Date()): Promise<FirmPlan> {
  await ensureFirmPlans(db);
  const row = await db.prepare("SELECT plan,ends_at FROM firm_plans WHERE user_id=? AND ends_at>?").bind(userId, at.toISOString()).first<{ plan: string; ends_at: string }>();
  const parsed = parsePlanId(row?.plan);
  return parsed && parsed.kind === kind ? { tier: parsed.tier, endsAt: row!.ends_at } : { tier: "free", endsAt: null };
}

/** Paid order: the same package is extended from its end, another one starts now and replaces it. */
export async function grantFirmPlan(db: FirmPlanDatabase, userId: string, plan: string, days: number, orderId: string, at = new Date()) {
  const parsed = parsePlanId(plan);
  if (!parsed) throw new Error("Unknown firm plan");
  await ensureFirmPlans(db);
  const stamp = at.toISOString();
  const current = await db.prepare("SELECT plan,ends_at FROM firm_plans WHERE user_id=?").bind(userId).first<{ plan: string; ends_at: string }>();
  const start = current && current.plan === plan && current.ends_at > stamp ? current.ends_at : stamp;
  const ends = new Date(Date.parse(start) + days * 86400000).toISOString();
  await db.prepare("INSERT INTO firm_plans(user_id,plan,ends_at,order_id,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,ends_at=excluded.ends_at,order_id=excluded.order_id,updated_at=excluded.updated_at")
    .bind(userId, planId(parsed.kind, parsed.tier), ends, orderId, stamp).run();
  if (parsed.tier === "pro") await db.prepare(`UPDATE ${firmTable(parsed.kind)} SET featured=1 WHERE owner_id=?`).bind(userId).run().catch(() => {});
  else if (current && parsePlanId(current.plan)?.tier === "pro") await db.prepare(`UPDATE ${firmTable(parsed.kind)} SET featured=0 WHERE owner_id=?`).bind(userId).run().catch(() => {});
  return { plan: planId(parsed.kind, parsed.tier), endsAt: ends };
}

/** Daily (with the featured-listing expiry): ended packages are removed and Pro firms lose the featured place. */
export async function expireFirmPlans(db: FirmPlanDatabase, at = new Date()) {
  await ensureFirmPlans(db);
  const stamp = at.toISOString();
  for (const kind of ["service", "contractor"] as const)
    await db.prepare(`UPDATE ${firmTable(kind)} SET featured=0 WHERE owner_id IN (SELECT user_id FROM firm_plans WHERE plan=? AND ends_at<=?)`).bind(planId(kind, "pro"), stamp).run().catch(() => {});
  await db.prepare("DELETE FROM firm_plans WHERE ends_at<=?").bind(stamp).run();
}

/** Message threads with a firm use the key "firm:service:<id>" or "firm:contractor:<id>" (lib/messaging-service.ts). */
export const firmThreadKey = (kind: FirmKind, firmId: string) => `firm:${kind}:${firmId}`;
export const parseFirmThread = (key: unknown): { kind: FirmKind; firmId: string } | null => {
  const match = typeof key === "string" ? /^firm:(service|contractor):([A-Za-z0-9-]{1,60})$/.exec(key) : null;
  return match ? { kind: match[1] as FirmKind, firmId: match[2] } : null;
};
