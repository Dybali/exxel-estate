import { body, currentUser, db, error, isAdmin, ok, sameOrigin } from "@/lib/server";
import { chatGet, chatPost, ChatError, type ChatDatabase } from "@/lib/messaging-service";
let database: ChatDatabase;
const connection = () => { if (!database) { const raw = db(); database = { prepare: (source) => raw.prepare(source) as unknown as import("@/lib/messaging-service").ChatStatement }; } return database; };
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  try { return ok(await chatGet(connection(), { id: user.id, admin: isAdmin(user) }, new URL(request.url).searchParams), { headers: { "Cache-Control": "no-store" } }); }
  catch (cause) { if (cause instanceof ChatError) return error(cause.message, cause.status); throw cause; }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  if(data.action!=='read'&&!user.email_verified)return error('Mesaj göndermek için önce e-posta adresinizi doğrulayın. Hesabım bölümünden doğrulayabilirsiniz.',403);
  try { return ok(await chatPost(connection(), { id: user.id, admin: isAdmin(user) }, data), { status: data.action === "read" ? 200 : 201, headers: { "Cache-Control": "no-store" } }); }
  catch (cause) { if (cause instanceof ChatError) return error(cause.message, cause.status); throw cause; }
}

