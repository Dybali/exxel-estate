import { currentUser, db, error } from "@/lib/server";
import { exportAccount, type AccountDatabase } from "@/lib/account-deletion";

// "Verilerimi indir": the signed-in member's own data as a JSON file (KVKK art. 11, GDPR art. 15/20).
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  const data = await exportAccount(db() as unknown as AccountDatabase, String(user.id));
  return new Response(JSON.stringify(data, null, 2), { headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="estatemarket24-verilerim-${new Date().toISOString().slice(0, 10)}.json"`,
  } });
}
