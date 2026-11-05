// Offsite database backup slot (docs/backups-monitoring.md). This file is what the Cloudflare
// (vinext) build sees: no backup, so pg_dump, child_process and the file encryption are never
// bundled for Workers. The Node build for the Mittwald container aliases "@/lib/db-backup" to
// lib/db-backup-node.ts (next.config.ts); lib/scheduled-jobs.ts runs it in the daily job and as
// the "backup" cron job.
export type PrivateMediaMissing = { table: string; id: string; state: string; keyHash: string };
export type PrivateMediaReport = { checked: number; missing: number; errors: number; sample: PrivateMediaMissing[]; note?: string };
export type BackupReport = {
  status: "ok" | "skipped" | "failed";
  reason?: string;
  error?: string;
  stage?: string;
  key?: string;
  manifest?: string;
  bytes?: number;
  encryptedBytes?: number;
  tables?: number;
  sha256?: string;
  retention?: { kept: number; deleted: number };
  privateMedia?: PrivateMediaReport;
  warnings?: string[];
  ms: number;
  alert?: string;
};

export const runDatabaseBackup: ((settings?: Record<string, string | undefined>) => Promise<BackupReport>) | null = null;
