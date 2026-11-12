// Server side of lib/ai-limits.ts: the caps in force (cached for a minute per process, so the panel's changes
// apply within a minute without a restart), merged over the environment for the AI features, and the hourly
// snapshot with the 80 % / 100 % warning e-mail.
import { emailLayout, escapeHtml, sendEmail, type EmailSettings } from "./email";
import { env } from "./runtime";
import { serviceDB } from "./server";
import { siteUrl } from "./site-url";
import { aiLimits, dueAiAlerts, limitOverrides, snapshotAiUsage, type AiLimitId, type LimitsDatabase } from "./ai-limits";

const vars = () => env as unknown as Record<string, unknown>;
let cached: { until: number; values: Record<AiLimitId, string> } | null = null;
export const forgetAiLimits = () => { cached = null; };

/** The environment with the caps in force (panel value, environment variable or default, plus agent growth). */
export async function aiSettings<T = Record<string, string | undefined>>(): Promise<T> {
  const base = vars();
  if (!cached || cached.until < Date.now()) {
    const database = serviceDB() as unknown as LimitsDatabase | null;
    try { cached = database ? { until: Date.now() + 60_000, values: limitOverrides((await aiLimits(database, base)).limits) } : null; }
    catch (cause) { console.warn("ai_limits_unavailable", String(cause)); cached = null; }
  }
  return { ...base, ...(cached?.values || {}) } as T;
}

/** Hourly (health job): keeps the daily history and e-mails the admin once per limit, period and level. Never rejects. */
export async function aiUsageJob() {
  const database = serviceDB() as unknown as LimitsDatabase | null;
  if (!database) return null;
  try {
    const usage = await snapshotAiUsage(database);
    const { limits } = await aiLimits(database, vars());
    const due = await dueAiAlerts(database, limits, usage);
    const settings = { ...(vars() as EmailSettings & { ALERT_EMAIL?: string; EXXEL_ADMIN_EMAIL?: string }) };
    const to = settings.ALERT_EMAIL || settings.EXXEL_ADMIN_EMAIL;
    if (due.length && to) {
      const lines = due.map((item) => `<strong>${escapeHtml(item.label)}</strong>: ${item.used.toLocaleString("tr-TR")} / ${item.limit.toLocaleString("tr-TR")} (%${item.percent})`);
      lines.push(due.some((item) => item.level === 100) ? "Sınıra ulaşıldı: bu özellik dönem sonuna kadar duraklatıldı (çeviride asıl metin gösterilir). / A limit was reached; the feature pauses until the period ends." : "Sınırın %80'i kullanıldı. / 80 % of a limit is used.");
      await sendEmail(settings, {
        to, subject: `estatemarket24 yapay zekâ kotası / AI quota: ${due.map((item) => `%${item.percent}`).join(", ")}`,
        html: emailLayout({ title: "Yapay zekâ kotası uyarısı", titleEn: "AI quota warning", lines, action: { href: `${siteUrl()}/yonetim?view=ai-limits`, label: "Kotaları aç / Open quotas" } }),
        text: due.map((item) => `${item.label}: ${item.used} / ${item.limit} (${item.percent}%)`).join("\n"),
      }).catch(() => null);
    }
    return { alerts: due.length };
  } catch (cause) { console.warn("ai_usage_job_failed", String(cause)); return null; }
}
