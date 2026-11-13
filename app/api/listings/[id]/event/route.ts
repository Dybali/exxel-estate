import { consumeRecoveryLimit, RecoveryError } from "@/lib/recovery-service";
import { clientIp, currentUser, db, error, ok, sameOrigin, sha256 } from "@/lib/server";
import { parseConsent } from "@/lib/cookie-consent";
import { recordListingEvent, type CrmDatabase } from "@/lib/crm-stats";

// Contact clicks on a listing (phone shown, WhatsApp opened) for the owner's CRM statistics (lib/crm-stats.ts).
// Counted once per visitor, listing, day and kind. A signed-in member is counted by account; a guest only with the
// analytics cookie consent (same viewer cookie as the view counter). Bots and the owner are never counted.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request) || request.headers.get("sec-fetch-site") === "cross-site") return error("Geçersiz kaynak.", 403);
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return error("İlan bulunamadı.", 404);
  const headers = { headers: { "Cache-Control": "private, no-store" } };
  if (/bot|crawler|spider|headless/i.test(request.headers.get("user-agent") || "")) return ok({ recorded: false }, headers);
  let data: { kind?: unknown; locale?: unknown };
  try { data = await request.json(); } catch { return error("Geçersiz istek."); }
  if (data.kind !== "phone" && data.kind !== "whatsapp") return error("Geçersiz istek.");
  try { await consumeRecoveryLimit(db(), await sha256("listing-events:" + clientIp(request)), 300); }
  catch (cause) { if (cause instanceof RecoveryError) return error("Çok fazla görüntüleme isteği.", 429); throw cause; }
  const user = await currentUser(request), cookieHeader = request.headers.get("cookie") || "";
  const viewer = parseConsent(cookieHeader)?.analytics ? cookieHeader.match(/(?:^|;\s*)em24_viewer=([a-f0-9-]{36})(?:;|$)/i)?.[1] : undefined;
  if (!user && !viewer) return ok({ recorded: false }, headers);
  const at = new Date(), actorHash = await sha256(`${id}:${at.toISOString().slice(0, 10)}:${data.kind}:${user ? "account:" + user.id : "browser:" + viewer}`);
  const recorded = await recordListingEvent(db() as unknown as CrmDatabase, id, data.kind, actorHash, user?.id || null, typeof data.locale === "string" ? data.locale : "", at);
  return ok({ recorded }, headers);
}
