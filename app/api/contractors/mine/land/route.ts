import { body, error, ok, sameOrigin } from "@/lib/server";
import { privateHeaders, serviceLimited, serviceMember } from "@/lib/service-api";
import { waitUntil } from "@/lib/runtime";
import { notifyLandOffer } from "@/lib/contractor-emails";
import { ContractorError, contractorInbox, passLandRequest, sendLandOffer } from "@/lib/contractors";
import { firmPlanState } from "@/lib/firm-plans-server";
import { landCutoff } from "@/lib/firm-plans";
import { contractorEmailSettings, contractorNotifyDB, contractorsDB } from "@/lib/contractors-server";

const failure = (cause: unknown) => { if (cause instanceof ContractorError) return error(cause.message, cause.status); throw cause; };

// Land requests that reached the member's firm (contact details only once shared or accepted).
export async function GET(request: Request) {
  const user = await serviceMember(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  // The package decides which requests the firm sees (lib/firm-plans.ts): none, a day later or at once.
  const plan = await firmPlanState(user.id, "contractor"), cutoff = landCutoff(plan.limits);
  if (cutoff === null) return ok({ firmId: null, requests: [], locked: true }, privateHeaders);
  return ok({ ...await contractorInbox(contractorsDB(), user.id, new Date(), cutoff), delayHours: cutoff ? 24 : 0 }, privateHeaders);
}

// { action: "offer", requestId, ownerShare | priceMin + priceMax?, deliveryMonths, message } | { action: "pass", requestId }
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await serviceMember(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  const blocked = await serviceLimited("contractor-offer", user.id);
  if (blocked) return blocked;
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  const cutoff = landCutoff((await firmPlanState(user.id, "contractor")).limits);
  if (cutoff === null) return error("Müşteri taleplerini görmek için Plus veya Pro paket gerekir.", 403);
  try {
    if (data.action === "pass") return ok(await passLandRequest(contractorsDB(), user.id, data.requestId, new Date(), cutoff), privateHeaders);
    if (data.action !== "offer") return error("Geçersiz işlem.");
    const offer = await sendLandOffer(contractorsDB(), user.id, data.requestId, data, new Date(), cutoff);
    waitUntil(notifyLandOffer(contractorNotifyDB(), contractorEmailSettings(), { userId: offer.requestUserId, firmName: offer.firmName, kind: offer.kind, ownerShare: offer.ownerShare, priceMin: offer.priceMin, priceMax: offer.priceMax, deliveryMonths: offer.deliveryMonths }).catch(() => {}));
    return ok({ id: offer.id }, { status: 201, ...privateHeaders });
  } catch (cause) { return failure(cause); }
}
