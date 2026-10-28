import { body, currentUser, db, error, ok, sameOrigin } from "@/lib/server";
import { statisticsDB } from "@/lib/listing-statistics-server";
import { LeadError, ownerLeads, ownerPerformance, updateLead, type LeadDatabase } from "@/lib/leads";

const canOwnListings = (role: string) => ["agent", "individual", "admin"].includes(role);
const privateHeaders = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  if (!canOwnListings(user.role)) return error("Bu bölüm ilan veren hesaplar içindir.", 403);
  const database = db() as unknown as LeadDatabase;
  await statisticsDB();
  const [leads, performance] = await Promise.all([ownerLeads(database, user.id), ownerPerformance(database, user.id)]);
  return ok({ leads, performance }, privateHeaders);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  if (!canOwnListings(user.role)) return error("Bu bölüm ilan veren hesaplar içindir.", 403);
  try {
    return ok(await updateLead(db() as unknown as LeadDatabase, user.id, await body(request)), privateHeaders);
  } catch (cause) {
    if (cause instanceof LeadError) return error(cause.message, cause.status);
    return error("Müşteri notunu ve aşamasını kontrol edin.");
  }
}
