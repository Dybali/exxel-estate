// Shared handler of the public tracking endpoints (app/api/services/track, app/api/contractors/track): a visitor's
// browser reports a profile view, a contact click, or the firms shown on a search results page ("search", up to 24
// ids at once). Only daily totals are stored. The same visitor, firm and kind counts once per 30 minutes; the key is
// a hash kept in this process's memory only, never in the database. Bots are ignored.
import { clientIp, error, sameOrigin, sha256 } from "./server";

const WINDOW = 30 * 60_000, seen = new Map<string, number>();
export async function handleFirmTrack(request: Request, scope: string, record: (firmId: string, kind: string) => Promise<unknown>) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const none = new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  if (/bot|crawler|spider|headless|preview/i.test(request.headers.get("user-agent") || "")) return none;
  let data: Record<string, unknown>;
  try { data = JSON.parse((await request.text()).slice(0, 4000)) as Record<string, unknown>; } catch { return none; }
  const kind = String(data.kind || "");
  const ids = kind === "search" && Array.isArray(data.firmIds) ? data.firmIds.slice(0, 24).map(String) : [String(data.firmId || "")];
  const now = Date.now(), ip = clientIp(request);
  if (seen.size > 50_000) for (const [item, at] of seen) if (at <= now - WINDOW) seen.delete(item);
  for (const firmId of new Set(ids)) {
    if (!firmId || firmId.length > 80) continue;
    const key = await sha256(`${scope}|${ip}|${firmId}|${kind}`);
    if ((seen.get(key) || 0) > now - WINDOW) continue;
    seen.set(key, now);
    await record(firmId, kind).catch(() => false);
  }
  return none;
}
