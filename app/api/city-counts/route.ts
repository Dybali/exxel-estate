import { db, ok } from "@/lib/server";

export async function GET() {
  const rows = await db().prepare("SELECT city, COUNT(*) AS count FROM listings WHERE status='published' GROUP BY city ORDER BY count DESC, city ASC").all<{ city: string; count: number }>();
  return ok({ cities: (rows.results || []).map((row) => ({ city: row.city, count: Number(row.count) })) }, {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=120" },
  });
}
