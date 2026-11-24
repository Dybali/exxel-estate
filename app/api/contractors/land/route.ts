import { body, error, ok, sameOrigin } from "@/lib/server";
import { privateHeaders, serviceLimited, serviceMember } from "@/lib/service-api";
import { waitUntil } from "@/lib/runtime";
import { notifyLandAccepted, notifyLandRequest } from "@/lib/contractor-emails";
import { firmPlanState } from "@/lib/firm-plans-server";
import { acceptLandOffer, closeLandRequest, ContractorError, createLandRequest, myLandRequests } from "@/lib/contractors";
import { contractorEmailSettings, contractorNotifyDB, contractorsDB } from "@/lib/contractors-server";

const failure = (cause: unknown) => { if (cause instanceof ContractorError) return error(cause.message, cause.status); throw cause; };

// The member's land-for-flats requests with their offers.
export async function GET(request: Request) {
  const user = await serviceMember(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  return ok({ requests: await myLandRequests(contractorsDB(), user.id) }, privateHeaders);
}

// New request: matched contractors are e-mailed in the background.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await serviceMember(request);
  if (!user) return error("Talep göndermek için giriş yapın ve e-postanızı doğrulayın.", 401);
  const blocked = await serviceLimited("land-request", user.id, 10);
  if (blocked) return blocked;
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Talep bilgilerini kontrol edin."); }
  try {
    const created = await createLandRequest(contractorsDB(), user.id, data);
    // Only firms whose package shows the request at once are e-mailed now (lib/firm-plans.ts).
    waitUntil((async () => {
      const now: typeof created.recipients = [];
      for (const firm of created.recipients) if ((await firmPlanState(firm.ownerId, "contractor")).limits.land === "first") now.push(firm);
      if (now.length) await notifyLandRequest(contractorNotifyDB(), contractorEmailSettings(), now, created.summary, created.kind);
    })().catch(() => {}));
    return ok({ id: created.id, recipients: created.recipients.length }, { status: 201, ...privateHeaders });
  } catch (cause) { return failure(cause); }
}

// { action: "accept", offerId } | { action: "close", requestId }
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await serviceMember(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  const blocked = await serviceLimited("land-request", user.id, 30);
  if (blocked) return blocked;
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  try {
    if (data.action === "close") return ok(await closeLandRequest(contractorsDB(), user.id, data.requestId), privateHeaders);
    if (data.action !== "accept") return error("Geçersiz işlem.");
    const accepted = await acceptLandOffer(contractorsDB(), user.id, data.offerId);
    waitUntil(notifyLandAccepted(contractorNotifyDB(), contractorEmailSettings(), accepted).catch(() => {}));
    return ok({ requestId: accepted.requestId }, privateHeaders);
  } catch (cause) { return failure(cause); }
}
