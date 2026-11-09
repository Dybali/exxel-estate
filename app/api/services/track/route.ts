import { clientIp, error, sameOrigin, sha256 } from "@/lib/server";
import { trackFirm } from "@/lib/service-extras";
import { ensureServices } from "@/lib/services";
import { servicesDB } from "@/lib/services-server";

// Profile view and contact clicks of an approved firm, sent by the visitor's browser (navigator.sendBeacon).
// Only daily counts are stored. The same visitor, firm and kind counts once per 30 minutes; the key is
// a hash kept in this process's memory only, never in the database.
const WINDOW = 30 * 60_000, seen = new Map<string, number>();
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  let data: Record<string, unknown>;
  try { data = JSON.parse((await request.text()).slice(0, 500)) as Record<string, unknown>; } catch { return new Response(null, { status: 204 }); }
  const now = Date.now(), key = await sha256(`${clientIp(request)}|${String(data.firmId)}|${String(data.kind)}`);
  if ((seen.get(key) || 0) > now - WINDOW) return new Response(null, { status: 204 });
  if (seen.size > 50_000) for (const [item, at] of seen) if (at <= now - WINDOW) seen.delete(item);
  seen.set(key, now);
  await ensureServices(servicesDB());
  await trackFirm(servicesDB(), data.firmId, data.kind).catch(() => false);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
