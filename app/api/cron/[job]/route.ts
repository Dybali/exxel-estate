import { env } from "@/lib/runtime";
import { cronAuthorized, cronEnabled } from "@/lib/cron-auth";
import { CRON_JOBS, dailyJobs, healthJob, type JobSettings } from "@/lib/scheduled-jobs";

// Scheduled jobs over HTTP for hosts without Cloudflare cron triggers (Mittwald cronjobs):
//   /api/cron/health  hourly    database, photo and private storage checks (alert e-mail on failure)
//   /api/cron/daily   06:00 UTC promotion expiry and the daily e-mail digest
// Authorization: Bearer <CRON_SECRET>. Without CRON_SECRET the endpoint does not exist (404).
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export const dynamic = "force-dynamic";
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers });

async function run(request: Request, { params }: Context) {
  const settings = env as unknown as JobSettings & { CRON_SECRET?: string };
  const job = (await params).job;
  if (!cronEnabled(settings.CRON_SECRET) || !(CRON_JOBS as readonly string[]).includes(job)) return reply({ error: "Not found" }, 404);
  if (!await cronAuthorized(request.headers.get("authorization"), settings.CRON_SECRET)) return reply({ error: "Unauthorized" }, 401);
  if (job === "health") {
    const { checks, alert } = await healthJob(settings);
    const ok = checks.every((check) => check.ok);
    return reply({ job, ok, alert, checks }, ok ? 200 : 503);
  }
  const jobs = dailyJobs(settings);
  const [promotions, digest] = await Promise.all([jobs.promotions, jobs.digest]);
  return reply({ job, ok: promotions && digest, promotions, digest }, promotions && digest ? 200 : 500);
}

type Context = { params: Promise<{ job: string }> };
export async function GET(request: Request, context: Context) { return run(request, context); }
export async function POST(request: Request, context: Context) { return run(request, context); }
