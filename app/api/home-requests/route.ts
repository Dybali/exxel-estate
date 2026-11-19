import { body, db, error, ok, sameOrigin } from "@/lib/server";
import { privateHeaders, serviceLimited, serviceMember } from "@/lib/service-api";
import { env, waitUntil } from "@/lib/runtime";
import { siteUrl } from "@/lib/request-context";
import type { EmailSettings } from "@/lib/email";
import type { NotificationDatabase } from "@/lib/email-notifications";
import { notifyHomeRequest } from "@/lib/home-request-emails";
import { mutateDiscovery, type DiscoveryDatabase } from "@/lib/discovery-service";
import { agentsToAlert, memberLeadActivity, type LeadDatabase } from "@/lib/lead-board";
import { closeHomeRequest, createHomeRequest, extendHomeRequest, homeRequestSearch, homeRequestSummary, HomeRequestError, myHomeRequests, type HomeRequestDatabase } from "@/lib/home-requests";

// "Benim için bul", member side (lib/home-requests.ts). GET: the member's requests with the offers and phone
// reveals of the agents who reached them. POST: new request (goes to the open board, lib/lead-board.ts, and
// e-mails the agents who follow the province) | { action: "close", id, reason, foundWith } | { action: "extend", id }.
// The agents' side is /api/lead-board.
let shared: HomeRequestDatabase | null = null;
const database = () => shared ??= db() as unknown as HomeRequestDatabase;
const failure = (cause: unknown) => { if (cause instanceof HomeRequestError) return error(cause.message, cause.status); throw cause; };

export async function GET(request: Request) {
  const user = await serviceMember(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  const requests = await myHomeRequests(database(), user.id);
  const withActivity = [];
  for (const item of requests) withActivity.push({ ...item, ...(item.reached ? await memberLeadActivity(database() as unknown as LeadDatabase, item.id) : { offers: [], reveals: [] }) });
  return ok({ requests: withActivity }, privateHeaders);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await serviceMember(request);
  if (!user) return error("Talep göndermek için giriş yapın ve e-postanızı doğrulayın.", 401);
  const blocked = await serviceLimited("home-request", user.id, 20);
  if (blocked) return blocked;
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Talep bilgilerini kontrol edin."); }
  try {
    if (data.action === "close") { await closeHomeRequest(database(), user.id, data.id, data.reason, new Date(), data.foundWith); return ok({ closed: true }, privateHeaders); }
    if (data.action === "extend") return ok({ expiresAt: await extendHomeRequest(database(), user.id, data.id) }, privateHeaders);
    const created = await createHomeRequest(database(), user.id, data);
    const r = created.request, summary = homeRequestSummary(r), search = homeRequestSearch({ ...r, details: r.details });
    waitUntil(agentsToAlert(database() as unknown as LeadDatabase, r.city, user.id)
      .then((agents) => notifyHomeRequest(db() as unknown as NotificationDatabase, { ...(env as unknown as EmailSettings), SITE_URL: siteUrl() }, agents, summary)).catch(() => {}));
    // "Yeni ilanlar için haber ver": the same search as a saved search (e-mail digest and Bildirimler).
    let alert = false;
    if (r.details.alert) alert = await mutateDiscovery(db() as unknown as DiscoveryDatabase, user.id, { action: "save", name: `Benim için bul: ${summary}`.slice(0, 70), query: search }).then(() => true, () => false);
    return ok({ id: created.id, search, alert }, { status: 201, ...privateHeaders });
  } catch (cause) { return failure(cause); }
}
