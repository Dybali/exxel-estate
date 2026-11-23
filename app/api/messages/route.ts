import { body, currentUser, db, error, isAdmin, ok, sameOrigin, serviceDB } from "@/lib/server";
import { chatGet, chatPost, ChatError, type ChatDatabase } from "@/lib/messaging-service";
import { env, waitUntil } from "@/lib/runtime";
import { notifyNewMessage, type NotificationDatabase } from "@/lib/email-notifications";
import { siteUrl } from "@/lib/request-context";
import type { EmailSettings } from "@/lib/email";
import { MessageTranslationError, translateMessages } from "@/lib/message-translations";
import { translationSettings } from "@/lib/translation-runtime";
import { aiSettings } from "@/lib/ai-limits-server";
import { firmThreadInfo } from "@/lib/firm-plans-server";
import { publish } from "@/lib/live-events";
let database: ChatDatabase;
const connection = () => { if (!database) { const raw = db(); database = { prepare: (source) => raw.prepare(source) as unknown as import("@/lib/messaging-service").ChatStatement }; } return database; };
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  try {
    const result = await chatGet(connection(), { id: user.id, admin: isAdmin(user) }, new URL(request.url).searchParams);
    // Firm threads (lib/firm-plans.ts) carry the firm's name and page instead of a listing.
    if ("conversations" in result) for (const row of result.conversations as Record<string, unknown>[]) {
      const firm = typeof row.listing_id === "string" && row.listing_id.startsWith("firm:") ? await firmThreadInfo(row.listing_id) : null;
      if (firm) Object.assign(row, { listing_title: firm.name, listing_status: "firm", firm_path: firm.path, firm_messaging: firm.messaging });
      else if (typeof row.listing_id === "string" && row.listing_id.startsWith("firm:")) Object.assign(row, { listing_title: "Firma artık mevcut değil", listing_status: null });
    }
    return ok(result, { headers: { "Cache-Control": "no-store" } });
  }
  catch (cause) { if (cause instanceof ChatError) return error(cause.message, cause.status); throw cause; }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  if (data.action === "translate") {
    try { return ok(await translateMessages(db() as never, (serviceDB() ?? undefined) as never, await aiSettings(), user.id, data.ids, data.locale), { headers: { "Cache-Control": "no-store" } }); }
    catch (cause) { if (cause instanceof MessageTranslationError) return error(cause.message, cause.status); throw cause; }
  }
  if(data.action!=='read'&&!user.email_verified)return error('Mesaj göndermek için önce e-posta adresinizi doğrulayın. Hesabım bölümünden doğrulayabilirsiniz.',403);
  // Messaging with a firm needs the firm's Plus or Pro package (lib/firm-plans.ts), in both directions.
  if(data.action!=='read'&&typeof data.listingId==='string'&&data.listingId.startsWith('firm:')&&!isAdmin(user)){const firm=await firmThreadInfo(data.listingId);if(!firm)return error('Firma bulunamadı.',404);if(!firm.messaging)return error('Bu firma site üzerinden mesaj almıyor. Telefon veya WhatsApp ile ulaşabilirsiniz.',403);}
  try {
    const result = await chatPost(connection(), { id: user.id, admin: isAdmin(user) }, data);
    // Email the recipient in the background; failures never affect sending the message.
    if (data.action !== "read" && "peerId" in result && result.peerId) waitUntil(notifyNewMessage(db() as unknown as NotificationDatabase, { ...(env as unknown as EmailSettings), SITE_URL: siteUrl() }, { listingId: result.listingId, senderId: user.id, recipientId: result.peerId }).catch(() => {}));
    // Live update (lib/live-events.ts): the recipient sees the message at once, the sender's other tabs too; a read
    // receipt reaches the sender. Ids only, the pages fetch the messages themselves.
    if (data.action === "read") { const peer = typeof data.peerId === "string" ? data.peerId.toLowerCase() : ""; if (typeof data.listingId === "string" && /^[0-9a-f-]{36}$/.test(peer)) publish([peer], { type: "read", listingId: data.listingId, peerId: String(user.id) }); }
    else if ("peerId" in result && result.peerId && "listingId" in result && result.listingId) { publish([String(result.peerId)], { type: "message", listingId: String(result.listingId), peerId: String(user.id) }); publish([String(user.id)], { type: "message", listingId: String(result.listingId), peerId: String(result.peerId) }); }
    return ok(result, { status: data.action === "read" ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  }
  catch (cause) { if (cause instanceof ChatError) return error(cause.message, cause.status); throw cause; }
}

