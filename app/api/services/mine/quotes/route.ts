import { waitUntil } from "@/lib/runtime";
import { body, error, ok, sameOrigin } from "@/lib/server";
import { notifyQuoteOffer } from "@/lib/service-emails";
import { declineQuote, firmInbox, quoteSummary, sendOffer } from "@/lib/service-extras";
import { memberFirm, privateHeaders, serviceFailure, serviceLimited } from "@/lib/service-api";
import { serviceEmailSettings, serviceNotifyDB, servicesDB } from "@/lib/services-server";

// Quote requests the member's firm received ("Gelen talepler"); opening the list marks them as seen.
export async function GET(request: Request) {
  const found = await memberFirm(request);
  if ("response" in found) return found.response;
  return ok({ requests: await firmInbox(servicesDB(), found.firm.id) }, privateHeaders);
}

// Price offer for one request; the customer is e-mailed in the background.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const found = await memberFirm(request);
  if ("response" in found) return found.response;
  if (found.firm.status !== "approved") return error("Firmanız yayında değilken teklif veremezsiniz.", 403);
  const blocked = await serviceLimited("service-offer", found.user.id, 40);
  if (blocked) return blocked;
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Teklif bilgilerini kontrol edin."); }
  try {
    const offer = await sendOffer(servicesDB(), found.firm.id, data);
    const request = (await firmInbox(servicesDB(), found.firm.id)).find((item) => item.requestId === offer.requestId);
    waitUntil(notifyQuoteOffer(serviceNotifyDB(), serviceEmailSettings(), { userId: offer.userId, firmName: found.firm.name, summary: request ? quoteSummary(request) : found.firm.name }).catch(() => {}));
    return ok({ id: offer.id }, { status: 201, ...privateHeaders });
  } catch (cause) { return serviceFailure(cause); }
}

// { requestId, action: "decline" }: the firm passes on a request.
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const found = await memberFirm(request);
  if ("response" in found) return found.response;
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  if (data.action !== "decline") return error("Geçersiz işlem.");
  try { return ok(await declineQuote(servicesDB(), found.firm.id, data.requestId), privateHeaders); }
  catch (cause) { return serviceFailure(cause); }
}
