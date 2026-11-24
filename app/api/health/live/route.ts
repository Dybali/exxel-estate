// Liveness for the container HEALTHCHECK and uptime probes: the server answers, nothing else is
// touched (no database, no storage), so a slow dependency never restarts the container.
// X-App-Commit names the running build (APP_COMMIT from the Docker image), so the deploy job can wait for the
// new container instead of being satisfied by the old one (2026-11-24).
export const dynamic = "force-dynamic";
const headers = () => ({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-App-Commit": (process.env.APP_COMMIT || "").slice(0, 40) });
export function GET() { return Response.json({ ok: true }, { headers: headers() }); }
export function HEAD() { return new Response(null, { headers: headers() }); }
