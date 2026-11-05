import { currentUser, db, error, isAdmin, ok } from "@/lib/server";
import { adminInsights, parseInsightPeriod, type InsightsDatabase } from "@/lib/admin-insights";

const headers = { headers: { "Cache-Control": "private, no-store" } };

// Admin dashboard data (Genel bakış / Raporlar). isAdmin is false while an administrator's
// second factor is still pending, so 2FA is enforced exactly as for the other admin APIs.
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user?.email_verified || !isAdmin(user)) return error("Yönetici yetkisi gerekli.", 403);
  const period = parseInsightPeriod(new URL(request.url).searchParams.get("period"));
  if (!period) return error("Geçersiz rapor dönemi.");
  try {
    return ok(await adminInsights(db() as unknown as InsightsDatabase, period), headers);
  } catch {
    return error("Rapor verileri şu anda alınamadı.", 503);
  }
}
