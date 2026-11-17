import { body, db, error, ok, sameOrigin, currentUser } from "@/lib/server";
import { agentLanguages, agentPhone, setAgentLanguages, type AgentDirectoryDatabase } from "@/lib/agent-directory";

// GET ?phone=<id>: "Telefonu göster" on /danismanlar. GET ?languages=1 / POST { languages }: the signed-in
// agent's spoken languages (Hesabım › Profilim). lib/agent-directory.ts.
const database = () => db() as unknown as AgentDirectoryDatabase;
const privateHeaders = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("phone");
  if (id) {
    const phone = await agentPhone(database(), id);
    return phone ? ok({ phone }, privateHeaders) : error("Telefon numarası bulunamadı.", 404);
  }
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  return ok({ languages: await agentLanguages(database(), user.id) }, privateHeaders);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  if (user.role !== "agent") return error("Bu ayar emlakçı hesapları içindir.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  return ok({ languages: await setAgentLanguages(database(), user.id, data.languages) }, privateHeaders);
}
