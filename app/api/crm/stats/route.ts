import { currentUser, db, error, ok } from "@/lib/server";
import { crmStats, type CrmDatabase } from "@/lib/crm-stats";

// CRM › İstatistikler: the signed-in member's own listings only (lib/crm-stats.ts). ?days=7|30|90.
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user?.email_verified) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  const days = Number(new URL(request.url).searchParams.get("days")) || 30;
  return ok(await crmStats(db() as unknown as CrmDatabase, String(user.id), days), { headers: { "Cache-Control": "private, no-store" } });
}
