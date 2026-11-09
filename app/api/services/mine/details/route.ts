import { body, error, ok, sameOrigin } from "@/lib/server";
import { saveDetails } from "@/lib/service-extras";
import { memberFirm, privateHeaders, serviceFailure, serviceLimited } from "@/lib/service-api";
import { servicesDB } from "@/lib/services-server";

// "Çalışma bilgileri": hours, 7/24 emergency and price range. Saved at once (no new review).
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const found = await memberFirm(request);
  if ("response" in found) return found.response;
  const blocked = await serviceLimited("service-firm", found.user.id);
  if (blocked) return blocked;
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Çalışma bilgilerini kontrol edin."); }
  try { return ok({ details: await saveDetails(servicesDB(), found.firm.id, data) }, privateHeaders); }
  catch (cause) { return serviceFailure(cause); }
}
