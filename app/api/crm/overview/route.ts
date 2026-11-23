import { currentUser, db, error, isAdmin, ok } from "@/lib/server";
import { agentOverview } from "@/lib/agent-overview";
import type { CrmDatabase } from "@/lib/crm-stats";
import { boardUnseen, type LeadDatabase } from "@/lib/lead-board";

// Hesabım › Genel Bakış for estate agents (lib/agent-overview.ts): the signed-in account's own listings, appointments
// and customers only. ?days=7|30|90.
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user?.email_verified) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  const days = Number(new URL(request.url).searchParams.get("days")) || 30;
  const database = db();
  // New buyer requests on the request board since the agent last opened it (approved agents only).
  const leads = user.role === "agent" && user.agent_status === "approved" || isAdmin(user);
  const overview = await agentOverview(database as unknown as CrmDatabase, String(user.id), days, new Date(), {
    newRequests: leads ? () => boardUnseen(database as unknown as LeadDatabase, String(user.id)) : undefined,
  });
  return ok(overview, { headers: { "Cache-Control": "private, no-store" } });
}
