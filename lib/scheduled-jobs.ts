import { bucket, db } from "./server";
import { siteUrl } from "./site-url";
import { sendDailyDigests, type NotificationDatabase } from "./email-notifications";
import { expirePromotions, type OrderDatabase } from "./orders";
import { alertOnFailure, runHealthChecks } from "./health";
import { externalR2Ready, headExternalImage } from "./external-r2";
import type { EmailSettings } from "./email";
import { cleanupVideos, videoFeatureEnabled, videoStorageFromEnv } from "./listing-video-server";
import type { VideoDatabase } from "./listing-video-store";

// The scheduled jobs, shared by the Cloudflare cron triggers (build/sites-worker.ts scheduled())
// and the protected HTTP endpoint /api/cron/[job] that a Mittwald cronjob calls.
export type JobSettings = EmailSettings & { ALERT_EMAIL?: string; EXXEL_ADMIN_EMAIL?: string };
export const CRON_JOBS = ["health", "daily"] as const;
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
  return { checks, alert: await alertOnFailure(checks, withSiteUrl(settings)) };
}

// Daily 06:00 UTC: promotion expiry, the e-mail digest and (Mittwald container only) removal of
// listing videos never attached to a listing or failed. Independent tasks; one failing never stops
// the others.
export function dailyJobs(settings: JobSettings) {
  return {
    promotions: expirePromotions(db() as unknown as OrderDatabase).then(() => true, (cause) => { console.error("promotion_expiry_failed", String(cause)); return false; }),
    digest: sendDailyDigests(db() as unknown as NotificationDatabase, withSiteUrl(settings)).then(() => true, (cause) => { console.error("daily_digest_failed", String(cause)); return false; }),
    videos: videoFeatureEnabled()
      ? cleanupVideos(db() as unknown as VideoDatabase, videoStorageFromEnv()).then((result) => { if (result.removed || result.failed) console.info("video_cleanup", JSON.stringify(result)); return true; }, (cause) => { console.error("video_cleanup_failed", String(cause)); return false; })
      : Promise.resolve(true),
  };
}
