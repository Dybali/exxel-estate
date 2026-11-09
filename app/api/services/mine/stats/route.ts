import { ok } from "@/lib/server";
import { firmStats } from "@/lib/service-extras";
import { memberFirm, privateHeaders } from "@/lib/service-api";
import { servicesDB } from "@/lib/services-server";

// Profile statistics of the member's firm: ?gun=7|30|90 (default 30).
export async function GET(request: Request) {
  const found = await memberFirm(request);
  if ("response" in found) return found.response;
  const requested = Number(new URL(request.url).searchParams.get("gun"));
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  return ok({ stats: await firmStats(servicesDB(), found.firm.id, days) }, privateHeaders);
}
