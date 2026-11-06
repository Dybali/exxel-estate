import { RiskActionError, backfillQueue, clearRiskFlag, storeBackfill, suspiciousListings, type RiskDatabase } from "@/lib/listing-risk-server";
import { reportsDB } from "@/lib/reports-server";
import { body, currentUser, db, error, isAdmin, ok, sameOrigin, str } from "@/lib/server";

// "Şüpheli ilanlar" (fraud and duplicate check, lib/listing-risk.ts). Admin only; isAdmin is false while
// the second factor is pending. Nothing here deletes or rejects a listing: moderation stays in /api/admin.
const headers = { headers: { "Cache-Control": "private, no-store" } };
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

async function admin(request: Request) {
  const user = await currentUser(request);
  return user?.email_verified && isAdmin(user) ? user : null;
}

export async function GET(request: Request) {
  if (!await admin(request)) return error("Yönetici yetkisi gerekli.", 403);
  const database = db() as unknown as RiskDatabase;
  try {
    if (new URL(request.url).searchParams.get("backfill") === "1") return ok(await backfillQueue(database, 50), headers);
    return ok({ items: await suspiciousListings(database) }, headers);
  } catch (cause) {
    console.error("risk list failed", cause);
    return error("Şüpheli ilanlar şu anda alınamadı.", 503);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await admin(request);
  if (!user) return error("Yönetici yetkisi gerekli.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  const action = str(data.action, 20), id = str(data.id, 80);
  if (!ID.test(id)) return error("İlan bulunamadı.", 404);
  const database = db() as unknown as RiskDatabase;
  try {
    if (action === "clear") {
      await reportsDB(); // admin_audit
      await clearRiskFlag(database, id, { id: user.id, name: user.name });
      return ok({ success: true }, headers);
    }
    if (action === "fingerprints") {
      const hashes = data.hashes && typeof data.hashes === "object" && !Array.isArray(data.hashes) ? data.hashes as Record<string, unknown> : {};
      return ok(await storeBackfill(database, id, hashes), headers);
    }
  } catch (cause) {
    if (cause instanceof RiskActionError) return error(cause.message, cause.status);
    console.error("risk action failed", cause);
    return error("İşlem şu anda tamamlanamadı.", 503);
  }
  return error("Geçersiz yönetim işlemi.");
}
