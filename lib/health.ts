import { emailLayout, escapeHtml, sendEmail, type EmailSettings } from "./email";

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown> }
type HealthDatabase = { prepare(sql: string): Statement };
export type HealthCheck = { name: string; ok: boolean; detail?: string; ms: number };

async function timed(name: string, run: () => Promise<string | void>): Promise<HealthCheck> {
  const start = Date.now();
  try { const detail = await run(); return { name, ok: true, ms: Date.now() - start, ...(detail ? { detail } : {}) }; }
  catch (cause) { return { name, ok: false, ms: Date.now() - start, detail: String((cause as Error)?.message || cause).slice(0, 200) }; }
}

// Hourly self-check from the Worker cron: database, listing photo storage and private storage.
export async function runHealthChecks(db: HealthDatabase, deps: { imageStorageReady: () => boolean; listImages: () => Promise<unknown>; privateBucket?: { head(key: string): Promise<unknown> } }) {
  return Promise.all([
    timed("database", async () => { const row = await db.prepare("SELECT count(*) AS n FROM listings WHERE status='published'").first<{ n: number }>(); return `${Number(row?.n)} published`; }),
    timed("listing-photos", async () => { if (!deps.imageStorageReady()) throw new Error("R2 settings missing"); await deps.listImages(); }),
    timed("private-storage", async () => { if (!deps.privateBucket) throw new Error("BUCKET binding missing"); await deps.privateBucket.head("health-check"); }),
  ]);
}

// Email once per failing state change would need state; one email per failing hour is acceptable at this scale.
export async function alertOnFailure(checks: HealthCheck[], settings: EmailSettings & { SITE_URL: string; ALERT_EMAIL?: string; EXXEL_ADMIN_EMAIL?: string }) {
  const failed = checks.filter((check) => !check.ok);
  if (!failed.length) return "healthy";
  console.error("health_check_failed", JSON.stringify(failed));
  const to = settings.ALERT_EMAIL || settings.EXXEL_ADMIN_EMAIL;
  if (!to) return "no_recipient";
  const lines = failed.map((check) => `<strong>${escapeHtml(check.name)}</strong>: ${escapeHtml(check.detail || "error")}`);
  const result = await sendEmail(settings, {
    to, subject: `estatemarket24 sağlık uyarısı / health alert: ${failed.map((c) => c.name).join(", ")}`,
    html: emailLayout({ title: "Sistem kontrolü başarısız", titleEn: "Health check failed", lines, action: { href: `${settings.SITE_URL}/yonetim`, label: "Yönetim paneli / Admin" } }),
    text: failed.map((check) => `${check.name}: ${check.detail || "error"}`).join("\n"),
  }).catch(() => ({ sent: false as const }));
  return result.sent ? "alerted" : "alert_not_sent";
}
