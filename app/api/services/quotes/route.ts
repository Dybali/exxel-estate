import { waitUntil } from "@/lib/runtime";
import { body, error, ok, sameOrigin } from "@/lib/server";
import { notifyOfferAccepted, notifyQuoteRequest } from "@/lib/service-emails";
import { acceptOffer, closeQuoteRequest, createQuoteRequest, myQuoteRequests, QUOTE_TIMINGS, quoteSummary } from "@/lib/service-extras";
import { privateHeaders, serviceFailure, serviceLimited, serviceMember } from "@/lib/service-api";
import { ensureServices } from "@/lib/services";
import { serviceEmailSettings, serviceNotifyDB, servicesDB } from "@/lib/services-server";

// "Teklif iste": a signed-in member's quote requests and the offers firms sent.
export async function GET(request: Request) {
  const user = await serviceMember(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  await ensureServices(servicesDB());
  return ok({ requests: await myQuoteRequests(servicesDB(), user.id) }, privateHeaders);
}

// New request: goes to matching firms (or to the one firm of ?firmId), which are e-mailed in the background.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await serviceMember(request);
  if (!user) return error("Teklif istemek için giriş yapın.", 401);
  const blocked = await serviceLimited("service-quote", user.id, 10);
  if (blocked) return blocked;
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Talep bilgilerini kontrol edin."); }
  try {
    await ensureServices(servicesDB());
    const saved = await createQuoteRequest(servicesDB(), user.id, data);
    waitUntil(notifyQuoteRequest(serviceNotifyDB(), serviceEmailSettings(), { summary: quoteSummary(saved.request), timing: QUOTE_TIMINGS[saved.request.timing], recipients: saved.recipients }).catch(() => {}));
    return ok({ id: saved.id, recipients: saved.recipients.length }, { status: 201, ...privateHeaders });
  } catch (cause) { return serviceFailure(cause); }
}

// { action: "close", id } or { action: "accept", offerId }.
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await serviceMember(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  try {
    await ensureServices(servicesDB());
    if (data.action === "close") return ok(await closeQuoteRequest(servicesDB(), user.id, data.id), privateHeaders);
    if (data.action === "accept") {
      const accepted = await acceptOffer(servicesDB(), user.id, data.offerId);
      waitUntil(notifyOfferAccepted(serviceNotifyDB(), serviceEmailSettings(), accepted).catch(() => {}));
      return ok({ requestId: accepted.requestId }, privateHeaders);
    }
    return error("Geçersiz işlem.");
  } catch (cause) { return serviceFailure(cause); }
}
