import { body, currentUser, db, error, ok, sameOrigin } from "@/lib/server";
import { publish, sseFrame, subscribe, typingAllowed, type LiveEvent } from "@/lib/live-events";

// Live messaging updates (lib/live-events.ts). GET: the signed-in account's event stream (Server-Sent Events).
// POST { action: "typing", listingId, peerId }: tells the other person of an existing thread that this account is
// typing. Events carry ids only; the page loads messages through /api/messages.
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A comment line keeps proxies from closing a quiet connection.
const PING_MS = 25_000;

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  const encoder = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const send = (text: string) => { if (!open) return; try { controller.enqueue(encoder.encode(text)); } catch { stop(); } };
      const unsubscribe = subscribe(String(user.id), (event: LiveEvent) => send(sseFrame(event.type, event)), () => stop());
      const ping = setInterval(() => send(": ping\n\n"), PING_MS);
      stop = () => { if (!open) return; open = false; clearInterval(ping); unsubscribe(); try { controller.close(); } catch { /* already closed */ } };
      request.signal.addEventListener("abort", () => stop());
      // retry: how long the browser waits before reconnecting after a drop.
      send("retry: 5000\n\n"); send(sseFrame("ready", { ok: true }));
    },
    cancel() { stop(); },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "Connection": "keep-alive",
    // Mittwald's proxy (nginx) must pass events through at once instead of buffering them.
    "X-Accel-Buffering": "no",
  } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  const listingId = typeof data.listingId === "string" ? data.listingId.trim() : "", peerId = typeof data.peerId === "string" ? data.peerId.trim().toLowerCase() : "";
  if (data.action !== "typing" || !listingId || listingId.length > 80 || !UUID.test(peerId) || peerId === String(user.id)) return error("Geçersiz istek.");
  if (!typingAllowed(String(user.id), listingId, peerId)) return ok({ sent: false });
  // Only within a thread the two already share (at least one message between them on this listing).
  const thread = await db().prepare("SELECT id FROM messages WHERE listing_id=? AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)) LIMIT 1")
    .bind(listingId, String(user.id), peerId, peerId, String(user.id)).first().catch(() => null);
  if (!thread) return ok({ sent: false });
  publish([peerId], { type: "typing", listingId, peerId: String(user.id) });
  return ok({ sent: true }, { headers: { "Cache-Control": "no-store" } });
}
