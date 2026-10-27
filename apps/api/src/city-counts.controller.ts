import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Controller("city-counts")
export class CityCountsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get() async get() {
    const rows = await this.prisma.listings.groupBy({
      by: ["city"],
      where: { status: "published" },
      _count: { _all: true },
      orderBy: { _count: { city: "desc" } },
    });
    return { cities: rows.map((row) => ({ city: row.city, count: row._count._all })) };
  }
}
