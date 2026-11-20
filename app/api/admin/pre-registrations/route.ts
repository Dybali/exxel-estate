import { currentUser, error, isAdmin, ok } from "@/lib/server";
import { listPreRegistrations, preRegistrationsCsv } from "@/lib/pre-registrations";
import { preRegistrationsDB } from "@/lib/pre-registrations-server";

// Administrators: list (JSON) or download (?format=csv) the pre-registrations, optionally by role and city.
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user?.email_verified || !isAdmin(user)) return error("Yönetici yetkisi gerekli.", 403);
  const q = new URL(request.url).searchParams, csv = q.get("format") === "csv";
  const result = await listPreRegistrations(preRegistrationsDB(), { role: q.get("role") || undefined, city: q.get("city") || undefined, limit: csv ? 20000 : 500 });
  if (csv) return new Response(preRegistrationsCsv(result.entries), { headers: {
    "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="on-kayitlar-${new Date().toISOString().slice(0, 10)}.csv"`,
  } });
  return ok(result, { headers: { "Cache-Control": "private, no-store" } });
}
