import { error, ok } from "@/lib/server";
import { contractorFirmStats, ownerContractor } from "@/lib/contractors";
import { contractorsDB } from "@/lib/contractors-server";
import { privateHeaders, serviceMember } from "@/lib/service-api";
import { firmPlanState } from "@/lib/firm-plans-server";

// Profile statistics of the member's contractor firm: ?gun=7|30|90 (default 30), lib/firm-stats.ts.
export async function GET(request: Request) {
  const user = await serviceMember(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  const firm = await ownerContractor(contractorsDB(), String(user.id));
  if (!firm) return error("Firma profili bulunamadı.", 404);
  const requested = Number(new URL(request.url).searchParams.get("gun"));
  // The package decides how far back (lib/firm-plans.ts).
  const { limits } = await firmPlanState(String(user.id), "contractor");
  const days = Math.min([7, 30, 90].includes(requested) ? requested : 30, limits.statsDays);
  return ok({ stats: await contractorFirmStats(contractorsDB(), firm.id, days) }, privateHeaders);
}
