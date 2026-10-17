import { currentUser, db, error, isAdmin, ok } from "@/lib/server";
export async function GET(request: Request, { params }: { params: Promise<{id:string}> }) {
  const user = await currentUser(request);
  if (!user) return error("İletişim bilgileri için giriş yapın.", 401);
  const { id } = await params;
  const seller = await db().prepare(`SELECT u.id,u.name,u.phone,u.whatsapp_enabled,u.company,u.role,u.agent_status,u.avatar_url,l.status,l.owner_id
    FROM listings l JOIN users u ON u.id=l.owner_id WHERE CAST(l.id AS TEXT)=?`).bind(id).first<Record<string, unknown>>();
  if (!seller || seller.status !== "published" && seller.owner_id !== user.id && !isAdmin(user)) return error("İlan bulunamadı.", 404);
  return ok({ seller: { id:seller.id,name:seller.name,phone:seller.phone,whatsappEnabled:Boolean(Number(seller.whatsapp_enabled)),company:seller.company,role:seller.role,agentApproved:seller.role === "agent" && seller.agent_status === "approved",avatarUrl:seller.avatar_url } }, { headers:{"Cache-Control":"private, no-store"} });
}
