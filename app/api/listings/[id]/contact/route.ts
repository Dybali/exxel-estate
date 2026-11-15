import {listingExpired} from '@/lib/listing-policy';
import { clientIp, currentUser, db, error, isAdmin, ok, sha256 } from "@/lib/server";
import { consumeRateLimit, RecoveryError } from "@/lib/recovery-service";
// Phone numbers must not be harvested in bulk with a free account: per member 40 per hour and 150 per
// day, per address 120 per hour. A member's own listings and administrators are not counted.
const HOUR = 3600_000, LIMIT_MESSAGE = "Çok fazla görüntüleme isteği.";
export async function GET(request: Request, { params }: { params: Promise<{id:string}> }) {
  const user = await currentUser(request);
  if (!user) return error("İletişim bilgileri için giriş yapın.", 401);
  const { id } = await params;
  const seller = await db().prepare(`SELECT u.id,u.name,u.phone,u.whatsapp_enabled,u.company,u.role,u.agent_status,u.avatar_url,l.status,l.expires_at,l.owner_id
    FROM listings l JOIN users u ON u.id=l.owner_id WHERE CAST(l.id AS TEXT)=?`).bind(id).first<Record<string, unknown>>();
  if (!seller || (seller.status !== "published"||listingExpired(seller.expires_at)) && seller.owner_id !== user.id && !isAdmin(user)) return error("İlan bulunamadı.", 404);
  if (String(seller.owner_id) !== String(user.id) && !isAdmin(user)) {
    try {
      await consumeRateLimit(db(), await sha256(`contact-user-hour:${user.id}`), 40, HOUR, undefined, LIMIT_MESSAGE);
      await consumeRateLimit(db(), await sha256(`contact-user-day:${user.id}`), 150, 24 * HOUR, undefined, LIMIT_MESSAGE);
      await consumeRateLimit(db(), await sha256(`contact-ip:${clientIp(request)}`), 120, HOUR, undefined, LIMIT_MESSAGE);
    } catch (cause) { if (cause instanceof RecoveryError) return error(cause.message, cause.status); throw cause; }
  }
  return ok({ seller: { id:seller.id,name:seller.name,phone:seller.phone,whatsappEnabled:Boolean(Number(seller.whatsapp_enabled)),company:seller.company,role:seller.role,agentApproved:seller.role === "agent" && seller.agent_status === "approved",avatarUrl:seller.avatar_url } }, { headers:{"Cache-Control":"private, no-store"} });
}
