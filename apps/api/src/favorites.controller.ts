import { Body, Controller, Delete, Get, Post, Query, Req } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { assertOrigin, AuthRequest, now, requireUser, str } from "./common";
import { PrismaService } from "./prisma.service";

@Controller("favorites")
export class FavoritesController {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}
  @Get() async get(@Req() request: AuthRequest) { const user = await this.auth.current(request); requireUser(user); const rows = await this.prisma.favorites.findMany({ where: { user_id: user.id }, select: { listing_id: true } }); return { ids: rows.map((row) => row.listing_id) }; }
  @Post() async add(@Body() body: Record<string,unknown>, @Req() request: AuthRequest) {
    assertOrigin(request); const user = await this.auth.current(request); requireUser(user);
    const id = str(body.id, 80); if (!id) return { success: false };
    await this.prisma.favorites.upsert({ where: { user_id_listing_id: { user_id: user.id, listing_id: id } }, create: { user_id: user.id, listing_id: id, created_at: now() }, update: {} });
    return { success: true };
  }
  @Delete() async remove(@Query("id") id: string, @Req() request: AuthRequest) { assertOrigin(request); const user = await this.auth.current(request); requireUser(user); await this.prisma.favorites.deleteMany({ where: { user_id: user.id, listing_id: str(id, 80) } }); return { success: true }; }
}
