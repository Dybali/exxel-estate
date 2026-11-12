import { bucket, db } from "./server";
import { siteUrl } from "./site-url";
import { sendDailyDigests, type NotificationDatabase } from "./email-notifications";
import { currentRates } from "./tcmb-server";
import { expirePromotions, type OrderDatabase } from "./orders";
import { alertOnFailure, runHealthChecks } from "./health";
import { externalR2Ready, headExternalImage } from "./external-r2";
import type { EmailSettings } from "./email";
import { cleanupVideos, videoFeatureEnabled, videoStorageFromEnv } from "./listing-video-server";
import type { VideoDatabase } from "./listing-video-store";
// Through the alias: in the Node build lib/db-backup-node.ts, on Cloudflare a null slot.
import { runDatabaseBackup, type BackupReport } from "@/lib/db-backup";
import { translationBatchJob, translationBatchPoll } from "./translation-runtime";
import { aiUsageJob } from "./ai-limits-server";

// The scheduled jobs, shared by the Cloudflare cron triggers (build/sites-worker.ts scheduled())
// and the protected HTTP endpoint /api/cron/[job] that a Mittwald cronjob calls.
export type JobSettings = EmailSettings & { ALERT_EMAIL?: string; EXXEL_ADMIN_EMAIL?: string };
export const CRON_JOBS = ["health", "daily", "backup"] as const;
export type CronJob = typeof CRON_JOBS[number];

const withSiteUrl = (settings: JobSettings) => ({ ...settings, SITE_URL: siteUrl() });

// Hourly: database, listing photo storage and private storage; e-mails the admin on failure.
export async function healthJob(settings: JobSettings) {
  let privateBucket: { head(key: string): Promise<unknown> } | undefined;
  try { privateBucket = bucket() ?? undefined; } catch (cause) { privateBucket = { head: async () => { throw cause; } }; }
  // Opening the database inside the check reports a missing configuration as a failed check.
  const database = { prepare: (sql: string) => db().prepare(sql) };
  const checks = await runHealthChecks(database as never, {
    imageStorageReady: externalR2Ready,
    listImages: () => headExternalImage("listings/00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000000.jpg"),
    privateBucket,
  });
  // Finished overnight translation jobs are collected within the hour (lib/translation-batch.ts).
  const translations = await translationBatchPoll().catch(() => null);
  // AI usage history and the 80 % / 100 % quota e-mail (Yönetim › Yapay zekâ kotaları).
  await aiUsageJob().catch(() => null);
  return { checks, alert: await alertOnFailure(checks, withSiteUrl(settings)), translations };
}

// Encrypted offsite database backup (Mittwald container only, docs/backups-monitoring.md). Never
// rejects; a failed backup e-mails the admin like a failed health check.
export async function backupJob(settings: JobSettings, run = runDatabaseBackup): Promise<BackupReport> {
  const started = Date.now();
  let report: BackupReport;
  try {
    report = run ? await run(settings as unknown as Record<string, string | undefined>) : { status: "skipped", reason: "not available in this build", ms: 0 };
  } catch (cause) {
    report = { status: "failed", error: String((cause as Error)?.message || cause).slice(0, 400), ms: Date.now() - started };
  }
  if (report.status === "failed") {
    const check = { name: "offsite-backup", ok: false, ms: report.ms, detail: `${report.stage ? `${report.stage}: ` : ""}${report.error || "failed"}`.slice(0, 200) };
    report.alert = await alertOnFailure([check], withSiteUrl(settings)).catch(() => "alert_not_sent");
  }
  return report;
}

// Daily: promotion expiry, the e-mail digest and (Mittwald container only) removal of listing videos
// never attached to a listing or failed, plus the offsite database backup. Independent tasks; one
// failing never stops the others.
export function dailyJobs(settings: JobSettings) {
  return {
    promotions: expirePromotions(db() as unknown as OrderDatabase).then(() => true, (cause) => { console.error("promotion_expiry_failed", String(cause)); return false; }),
    digest: currentRates().then((rates) => sendDailyDigests(db() as unknown as NotificationDatabase, withSiteUrl(settings), new Date(), 500, rates)).then(() => true, (cause) => { console.error("daily_digest_failed", String(cause)); return false; }),
    videos: videoFeatureEnabled()
      ? cleanupVideos(db() as unknown as VideoDatabase, videoStorageFromEnv()).then((result) => { if (result.removed || result.failed) console.info("video_cleanup", JSON.stringify(result)); return true; }, (cause) => { console.error("video_cleanup_failed", String(cause)); return false; })
      : Promise.resolve(true),
    backup: backupJob(settings),
    // XML-imported listings into every language at the Gemini batch price (lib/translation-batch.ts).
    translations: translationBatchJob(),
  };
}
