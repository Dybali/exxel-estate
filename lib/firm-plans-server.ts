import { env } from "./runtime";
import { db } from "./server";
import { firmLimits, firmPlan, firmPlansEnabled, parseFirmThread, type FirmKind, type FirmLimits, type FirmPlanDatabase, type FirmTier } from "./firm-plans";
import { firmPath } from "./services";
import { contractorPath } from "./contractors";

// One database object per isolate so the table check in lib/firm-plans.ts runs once.
let shared: FirmPlanDatabase | null = null;
export const firmPlansDB = () => shared ??= db() as unknown as FirmPlanDatabase;
export const plansSwitchedOn = () => firmPlansEnabled(env as Record<string, unknown>);

export type FirmPlanState = { tier: FirmTier; endsAt: string | null; enabled: boolean; limits: FirmLimits };
/** The account's package and the limits that apply now (lib/firm-plans.ts). */
export async function firmPlanState(userId: string, kind: FirmKind): Promise<FirmPlanState> {
  const enabled = plansSwitchedOn();
  const plan = await firmPlan(firmPlansDB(), userId, kind).catch(() => ({ tier: "free" as const, endsAt: null }));
  return { ...plan, enabled, limits: firmLimits(kind, plan.tier, enabled) };
}

/** Message thread with a firm ("firm:service:<id>"): its name, page and whether its package allows messaging. */
export async function firmThreadInfo(key: string) {
  const parsed = parseFirmThread(key);
  if (!parsed) return null;
  const table = parsed.kind === "service" ? "service_firms" : "contractor_firms";
  const row = await (db() as unknown as FirmPlanDatabase).prepare(`SELECT owner_id,name,status FROM ${table} WHERE id=?`).bind(parsed.firmId).first<{ owner_id: string; name: string; status: string }>().catch(() => null);
  if (!row) return null;
  const { limits } = await firmPlanState(String(row.owner_id), parsed.kind);
  return { ...parsed, ownerId: String(row.owner_id), name: String(row.name), approved: row.status === "approved", messaging: limits.messaging,
    path: parsed.kind === "service" ? firmPath(parsed.firmId) : contractorPath(parsed.firmId) };
}

/** A save may keep what the firm already had, but may not add beyond the package limit. */
export const overLimit = (next: number, previous: number, limit: number) => next > limit && next > previous;
