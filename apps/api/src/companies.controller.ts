import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { listingView } from "./listings.controller";

type CompanyRow = { id: string; name: string; category: string; listing_count: bigint; sale_count: bigint; rent_count: bigint };

@Controller("companies")
export class CompaniesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get() async list(@Query() query: Record<string, string>) {
    const category = ["agency", "developer"].includes(query.category) ? query.category : null;
    const page = Math.min(1000, Math.max(1, Number(query.page) || 1));
    const categoryClause = category ? Prisma.sql` AND a.category=${category}` : Prisma.empty;
    const [rows, total] = await Promise.all([
      this.prisma.$queryRaw<CompanyRow[]>(Prisma.sql`
        SELECT a.id, a.name, a.category,
          COUNT(l.id)::bigint AS listing_count,
          SUM(CASE WHEN l.purpose='satilik' THEN 1 ELSE 0 END)::bigint AS sale_count,
          SUM(CASE WHEN l.purpose='kiralik' THEN 1 ELSE 0 END)::bigint AS rent_count
        FROM agencies a JOIN users u ON u.id=a.owner_id
        LEFT JOIN listings l ON l.owner_id=a.owner_id AND l.status='published'
        WHERE a.status='approved' AND u.role='agent' AND u.agent_status='approved'${categoryClause}
        GROUP BY a.id, a.name, a.category ORDER BY listing_count DESC, a.name ASC
        LIMIT 24 OFFSET ${(page - 1) * 24}`),
      this.prisma.agencies.count({ where: { status: "approved", ...(category ? { category } : {}), users: { role: "agent", agent_status: "approved" } } }),
    ]);
    return { companies: rows.map((row) => ({ id: row.id, name: row.name, category: row.category, listingCount: Number(row.listing_count), saleCount: Number(row.sale_count), rentCount: Number(row.rent_count) })), total, page, pageSize: 24 };
  }

  @Get(":id") async detail(@Param("id") id: string, @Query("page") pageValue?: string) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new NotFoundException("Şirket bulunamadı.");
    const page = Math.min(1000, Math.max(1, Number(pageValue) || 1));
    const pageSize = 24;
    const company = await this.prisma.agencies.findFirst({ where: { id, status: "approved", users: { role: "agent", agent_status: "approved" } } });
    if (!company) throw new NotFoundException("Şirket bulunamadı.");
    const scope = { owner_id: company.owner_id, status: "published" };
    const [rows, listingCount, saleCount, rentCount] = await Promise.all([
      this.prisma.listings.findMany({ where: scope, include: { users_listings_owner_idTousers: { select: { name: true } } }, orderBy: { created_at: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.listings.count({ where: scope }),
      this.prisma.listings.count({ where: { ...scope, purpose: "satilik" } }),
      this.prisma.listings.count({ where: { ...scope, purpose: "kiralik" } }),
    ]);
    const listings = rows.map(listingView);
    return { company: { id: company.id, name: company.name, category: company.category, listingCount, saleCount, rentCount }, listings, page, pageSize };
  }
}
