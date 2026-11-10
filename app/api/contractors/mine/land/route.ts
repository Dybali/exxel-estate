import { body, error, ok, sameOrigin } from "@/lib/server";
import { privateHeaders, serviceLimited, serviceMember } from "@/lib/service-api";
import { waitUntil } from "@/lib/runtime";
import { notifyLandOffer } from "@/lib/contractor-emails";
import { ContractorError, contractorInbox, passLandRequest, sendLandOffer } from "@/lib/contractors";
import { contractorEmailSettings, contractorNotifyDB, contractorsDB } from "@/lib/contractors-server";

const failure = (cause: unknown) => { if (cause instanceof ContractorError) return error(cause.message, cause.status); throw cause; };

// Land requests that reached the member's firm (contact details only once shared or accepted).
export async function GET(request: Request) {
  const user = await serviceMember(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  return ok(await contractorInbox(contractorsDB(), user.id), privateHeaders);
}

// { action: "offer", requestId, ownerShare, deliveryMonths, message } | { action: "pass", requestId }
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await serviceMember(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  const blocked = await serviceLimited("contractor-offer", user.id);
  if (blocked) return blocked;
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  try {
    if (data.action === "pass") return ok(await passLandRequest(contractorsDB(), user.id, data.requestId), privateHeaders);
    if (data.action !== "offer") return error("Geçersiz işlem.");
    const offer = await sendLandOffer(contractorsDB(), user.id, data.requestId, data);
    waitUntil(notifyLandOffer(contractorNotifyDB(), contractorEmailSettings(), { userId: offer.requestUserId, firmName: offer.firmName, ownerShare: offer.ownerShare, deliveryMonths: offer.deliveryMonths }).catch(() => {}));
    return ok({ id: offer.id }, { status: 201, ...privateHeaders });
  } catch (cause) { return failure(cause); }
}
