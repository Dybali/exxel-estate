import { body, db, error, isAdmin, ok, sameOrigin } from "@/lib/server";
import { privateHeaders, serviceLimited, serviceMember } from "@/lib/service-api";
import { env, waitUntil } from "@/lib/runtime";
import { siteUrl } from "@/lib/request-context";
import type { EmailSettings } from "@/lib/email";
import type { NotificationDatabase } from "@/lib/email-notifications";
import { notifyHomeRequest } from "@/lib/home-request-emails";
import { agentHomeRequests, closeHomeRequest, createHomeRequest, HomeRequestError, myHomeRequests, newHomeRequestCount, setHomeRequestState, type HomeRequestDatabase } from "@/lib/home-requests";

// "Benim için bul" (lib/home-requests.ts). GET: the member's requests; ?agent=1: requests sent to an estate agent.
// POST: new request | { action: "close", id } | (agent) { action: "state", id, state: "contacted" | "passed" }.
let shared: HomeRequestDatabase | null = null;
const database = () => shared ??= db() as unknown as HomeRequestDatabase;
const failure = (cause: unknown) => { if (cause instanceof HomeRequestError) return error(cause.message, cause.status); throw cause; };
const agentOf = (user: { role: string; agent_status?: string }) => user.role === "agent" && user.agent_status === "approved";

export async function GET(request: Request) {
  const user = await serviceMember(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  const params = new URL(request.url).searchParams;
  if (params.get("agent") === "1") {
    if (!agentOf(user as never) && !isAdmin(user)) return error("Bu bölüm onaylı emlakçı hesapları içindir.", 403);
    if (params.get("count") === "1") return ok({ unseen: await newHomeRequestCount(database(), user.id) }, privateHeaders);
    return ok({ requests: await agentHomeRequests(database(), user.id) }, privateHeaders);
  }
  return ok({ requests: await myHomeRequests(database(), user.id) }, privateHeaders);
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
    if (data.action === "close") { await closeHomeRequest(database(), user.id, data.id); return ok({ closed: true }, privateHeaders); }
    if (data.action === "state") {
      if (!agentOf(user as never)) return error("Bu bölüm onaylı emlakçı hesapları içindir.", 403);
      await setHomeRequestState(database(), user.id, data.id, data.state); return ok({ saved: true }, privateHeaders);
    }
    const created = await createHomeRequest(database(), user.id, data);
    const r = created.request, summary = `${r.intent === "buy" ? "Satılık" : "Kiralık"} · ${r.district ? `${r.district}, ` : ""}${r.city}${r.rooms ? ` · ${r.rooms}` : ""}`;
    waitUntil(notifyHomeRequest(db() as unknown as NotificationDatabase, { ...(env as unknown as EmailSettings), SITE_URL: siteUrl() }, created.agents, summary).catch(() => {}));
    return ok({ id: created.id, agents: created.agents.length }, { status: 201, ...privateHeaders });
  } catch (cause) { return failure(cause); }
}
