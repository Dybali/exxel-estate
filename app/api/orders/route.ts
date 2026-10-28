import { env } from "cloudflare:workers";
import { body, currentUser, db, error, ok, sameOrigin } from "@/lib/server";
import { CATALOG, cancelOrder, createOrder, OrderError, userOrders, type OrderDatabase } from "@/lib/orders";
import { bankTransfer, type PaymentSettings } from "@/lib/payment-providers";

const headers = { headers: { "Cache-Control": "private, no-store" } };
const database = () => db() as unknown as OrderDatabase;

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  return ok({ orders: await userOrders(database(), user.id), catalog: CATALOG, bank: bankTransfer(env as unknown as PaymentSettings) }, headers);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!user?.email_verified) return error("Sipariş için doğrulanmış bir hesapla giriş yapın.", 401);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  try {
    if (data.action === "cancel") { await cancelOrder(database(), { id: user.id, admin: false }, String(data.id || "")); return ok({ cancelled: true }, headers); }
    const bank = bankTransfer(env as unknown as PaymentSettings);
    if (!bank) return error("Ödeme alma henüz etkin değil.", 503);
    return ok({ order: await createOrder(database(), user, data, bank.provider), bank }, { status: 201, ...headers });
  } catch (cause) {
    if (cause instanceof OrderError) return error(cause.message, cause.status);
    throw cause;
  }
}
