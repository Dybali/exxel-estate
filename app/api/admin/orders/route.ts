import { body, currentUser, db, error, isAdmin, ok, sameOrigin } from "@/lib/server";
import { agentPlanDB } from "@/lib/agent-plan";
import { adminOrders, cancelOrder, fulfillOrder, OrderError, type OrderDatabase } from "@/lib/orders";

const headers = { headers: { "Cache-Control": "private, no-store" } };
const database = () => db() as unknown as OrderDatabase;

export async function GET(request: Request) {
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  return ok({ orders: await adminOrders(database(), new URL(request.url).searchParams.get("status") || "") }, headers);
}

// Confirm a received bank transfer (applies the product) or cancel an unpaid order.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  const id = String(data.id || ""), note = typeof data.note === "string" ? data.note : "";
  try {
    if (data.action === "fulfill") { await agentPlanDB(); return ok(await fulfillOrder(database(), admin.id, id, note), headers); }
    if (data.action === "cancel") { await cancelOrder(database(), { id: admin.id, admin: true }, id, note); return ok({ cancelled: true }, headers); }
    return error("Geçersiz işlem.");
  } catch (cause) {
    if (cause instanceof OrderError) return error(cause.message, cause.status);
    throw cause;
  }
}
