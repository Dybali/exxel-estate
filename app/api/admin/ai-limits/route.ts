import { env } from "@/lib/runtime";
import { body, currentUser, db, error, isAdmin, ok, sameOrigin, serviceDB } from "@/lib/server";
import { reportsDB } from "@/lib/reports-server";
import { aiCost, aiHistory, aiLimits, aiUsageNow, AiLimitError, AI_PRICES, capCost, saveAiLimit, type LimitsDatabase } from "@/lib/ai-limits";
import { forgetAiLimits } from "@/lib/ai-limits-server";

// Yönetim › Yapay zekâ kotaları: the caps in force, today's and this month's usage, a 30-day history and
// estimated costs (GET); a new base value and per-agent growth for one cap (POST). Admins only.
const headers = { headers: { "Cache-Control": "private, no-store" } };
const limitsDB = () => serviceDB() as unknown as LimitsDatabase;
async function admin(request: Request) { const user = await currentUser(request); return user?.email_verified && isAdmin(user) ? user : null; }

export async function GET(request: Request) {
  if (!await admin(request)) return error("Yönetici yetkisi gerekli.", 403);
  const database = limitsDB(), vars = env as unknown as Record<string, unknown>;
  const [{ agents, limits }, usage, history] = await Promise.all([aiLimits(database, vars), aiUsageNow(database), aiHistory(database, 30)]);
  return ok({
    agents, prices: AI_PRICES, cost: aiCost(usage), tokens: usage.tokens, history, configured: Boolean(vars.GEMINI_API_KEY || vars.OPENAI_API_KEY),
    limits: limits.map((item) => ({ ...item, used: usage.used[item.id], percent: item.effective > 0 ? Math.round(usage.used[item.id] / item.effective * 100) : 0, capCost: capCost(item) })),
  }, headers);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await admin(request);
  if (!user) return error("Yönetici yetkisi gerekli.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  try {
    const saved = await saveAiLimit(limitsDB(), user.id, data);
    forgetAiLimits();
    try {
      await reportsDB();
      await db().prepare("INSERT INTO admin_audit(id,actor_id,actor_name,action,target_id,summary,created_at) VALUES(?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), user.id, user.name, "ai_limit", saved.id, `${saved.id}: ${saved.base ?? "varsayılan"} + ${saved.perAgent}/emlakçı`, new Date().toISOString()).run();
    } catch { /* The change stands even if the audit entry cannot be written. */ }
    return ok(saved, headers);
  } catch (cause) {
    if (cause instanceof AiLimitError) return error(cause.message, cause.status);
    throw cause;
  }
}
