import { db, ok } from "@/lib/server";

type CompanyRow = { id: string; name: string; category: string; listing_count: number; sale_count: number; rent_count: number };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const category = params.get("category");
  const page = Math.min(1000, Math.max(1, Number(params.get("page")) || 1));
  const where = category === "agency" || category === "developer" ? " AND a.category=?" : "";
  const values = where ? [category!] : [];
  const query = `SELECT a.id, a.name, a.category,
      COUNT(l.id) AS listing_count,
      SUM(CASE WHEN l.purpose='satilik' THEN 1 ELSE 0 END) AS sale_count,
      SUM(CASE WHEN l.purpose='kiralik' THEN 1 ELSE 0 END) AS rent_count
    FROM agencies a JOIN users u ON u.id=a.owner_id
    LEFT JOIN listings l ON l.owner_id=a.owner_id AND l.status='published'
    WHERE a.status='approved' AND u.role='agent' AND u.agent_status='approved'${where}
    GROUP BY a.id, a.name, a.category
    ORDER BY listing_count DESC, a.name ASC LIMIT 24 OFFSET ?`;
  const [rows, total] = await Promise.all([
    db().prepare(query).bind(...values, (page - 1) * 24).all<CompanyRow>(),
    db().prepare(`SELECT COUNT(*) AS count FROM agencies a JOIN users u ON u.id=a.owner_id WHERE a.status='approved' AND u.role='agent' AND u.agent_status='approved'${where}`).bind(...values).first<{ count: number }>(),
  ]);
  return ok({ companies: (rows.results || []).map((row) => ({ id: row.id, name: row.name, category: row.category, listingCount: Number(row.listing_count), saleCount: Number(row.sale_count), rentCount: Number(row.rent_count) })), total: Number(total?.count || 0), page, pageSize: 24 }, {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=120" },
  });
}
