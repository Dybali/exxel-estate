import { body, db, error, isAdmin, ok, sameOrigin } from "@/lib/server";
import { privateHeaders, serviceLimited, serviceMember } from "@/lib/service-api";
import { env, waitUntil } from "@/lib/runtime";
import { siteUrl } from "@/lib/request-context";
import type { EmailSettings } from "@/lib/email";
import type { NotificationDatabase } from "@/lib/email-notifications";
import { notifyMemberOffer } from "@/lib/home-request-emails";
import { homeRequestSummary } from "@/lib/home-requests";
import { boardFilters, boardUnseen, leadAccess, leadBoard, LeadError, leadFollows, leadPlansEnabled, responseStats, revealContact, sendOffer, setLeadFollows, type LeadDatabase } from "@/lib/lead-board";

// "Talep akışı" for approved estate agents (lib/lead-board.ts): the open board of "Benim için bul" requests.
// GET: board with filters (?city, district, intent, category, hot, foreign, minBudget, maxBudget, mine, page),
// the agent's access (plan, monthly use), response stats, followed provinces; ?count=1: new requests since the
// last visit (header badge). POST: { action: "offer", id, message, listingIds } | { action: "reveal", id } |
// { action: "follow", cities }.
let shared: LeadDatabase | null = null;
const database = () => shared ??= db() as unknown as LeadDatabase;
const failure = (cause: unknown) => { if (cause instanceof LeadError) return error(cause.message, cause.status); throw cause; };
const plansOn = () => leadPlansEnabled(env as Record<string, unknown>);

// Admins may look at the board (read-only); only approved agents act on it.
async function agent(request: Request, read = false) {
  const user = await serviceMember(request);
  if (!user) return { failed: error("Giriş ve e-posta doğrulaması gerekli.", 401) };
  if (read && isAdmin(user)) return { user };
  if (user.role !== "agent" || user.agent_status !== "approved") return { failed: error("Talep akışı onaylı emlakçı hesapları içindir.", 403) };
  return { user };
}

export async function GET(request: Request) {
  const { user, failed } = await agent(request, true);
  if (!user) return failed;
  const params = new URL(request.url).searchParams;
  if (params.get("count") === "1") return ok({ unseen: await boardUnseen(database(), user.id) }, privateHeaders);
  const access = await leadAccess(database(), user.id, plansOn());
  const board = await leadBoard(database(), user.id, access, boardFilters(params));
  const [stats, follows] = await Promise.all([responseStats(database(), user.id), leadFollows(database(), user.id)]);
  await boardUnseen(database(), user.id, new Date(), true);
  return ok({ ...board, access, stats, follows: follows.cities }, privateHeaders);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const { user, failed } = await agent(request);
  if (!user) return failed;
  const blocked = await serviceLimited("lead-board", user.id, 40);
  if (blocked) return blocked;
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Bilgileri kontrol edin."); }
  try {
    if (data.action === "follow") return ok({ cities: await setLeadFollows(database(), user.id, data.cities) }, privateHeaders);
    const access = await leadAccess(database(), user.id, plansOn());
    if (data.action === "reveal") return ok({ contact: await revealContact(database(), user.id, data.id, access) }, privateHeaders);
    if (data.action === "offer") {
      const sent = await sendOffer(database(), user.id, data, access);
      const row = await database().prepare("SELECT r.*,d.data AS details FROM home_requests r LEFT JOIN home_request_details d ON d.request_id=r.id WHERE r.id=?").bind(sent.requestId).first<Record<string, unknown>>();
      let details = null; try { details = JSON.parse(String(row?.details || "null")); } catch { /* none */ }
      const summary = row ? homeRequestSummary({ intent: row.intent === "rent" ? "rent" : "buy", city: String(row.city), district: String(row.district || ""), rooms: String(row.rooms || ""), category: String(row.category), details }) : "";
      waitUntil(notifyMemberOffer(db() as unknown as NotificationDatabase, { ...(env as unknown as EmailSettings), SITE_URL: siteUrl() }, sent.memberId, user.name, summary).catch(() => {}));
      return ok({ sent: true }, { status: 201, ...privateHeaders });
    }
    return error("Geçersiz işlem.");
  } catch (cause) { return failure(cause); }
}
