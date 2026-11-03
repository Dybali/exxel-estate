// Runs a scheduled job of the site (app/api/cron/[job]) from inside the container, for Mittwald
// container cronjobs (they run a command in the container; URL cronjobs cannot send the bearer
// token). Usage: node scripts/cron-call.mjs health|daily
// Uses CRON_SECRET and PORT from the container environment; exit code 0 only when the job succeeded.
const job = process.argv[2];
if (!["health", "daily"].includes(job)) { console.error("usage: node scripts/cron-call.mjs health|daily"); process.exit(2); }
const secret = process.env.CRON_SECRET;
if (!secret) { console.error("CRON_SECRET is not set"); process.exit(2); }
try {
  const response = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/cron/${job}`, {
    method: "POST", headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(15 * 60_000),
  });
  console.log(`cron ${job}: ${response.status} ${await response.text()}`);
  process.exit(response.ok ? 0 : 1);
} catch (cause) {
  console.error(`cron ${job} failed: ${cause?.message || cause}`);
  process.exit(1);
}
