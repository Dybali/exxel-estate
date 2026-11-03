// Liveness for the container HEALTHCHECK and uptime probes: the server answers, nothing else is
// touched (no database, no storage), so a slow dependency never restarts the container.
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export function GET() { return Response.json({ ok: true }, { headers }); }
export function HEAD() { return new Response(null, { headers }); }
