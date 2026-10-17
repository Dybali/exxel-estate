import { Body, Controller, Delete, Get, Header, HttpCode, NotFoundException, Post, Query, Req } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { assertOrigin, AuthRequest, now, requireUser, str } from "./common";
import { PrismaService } from "./prisma.service";
import demoRows from "./data/demo-listings.json";
import { listingView } from "./listings.controller";

@Controller("favorites")
export class FavoritesController {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}
  @Get() @Header("Cache-Control","private, no-store") async get(@Req() request: AuthRequest) {
    const user=await this.auth.current(request);requireUser(user);
    const rows=await this.prisma.favorites.findMany({where:{user_id:user.id},select:{listing_id:true},orderBy:{created_at:"desc"},take:100});
    const ids=rows.map(row=>row.listing_id),realIds=ids.filter(id=>/^[a-f0-9-]{36}$/i.test(id));
    const real=await this.prisma.listings.findMany({where:{id:{in:realIds},status:"published"},include:{users_listings_owner_idTousers:{select:{name:true}}}});
    const byId=new Map<string,unknown>(demoRows.map(item=>[item.id,item]));for(const row of real)byId.set(row.id,listingView(row));
    return {ids,listings:ids.map(id=>byId.get(id)).filter(Boolean)};
  }
  @Post() @HttpCode(200) async add(@Body() body: Record<string,unknown>, @Req() request: AuthRequest) {
    assertOrigin(request); const user = await this.auth.current(request); requireUser(user);
    const id = str(body.id, 80);
    if(!demoRows.some(item=>item.id===id)&&(!/^[a-f0-9-]{36}$/i.test(id)||!await this.prisma.listings.findFirst({where:{id,status:"published"},select:{id:true}})))throw new NotFoundException("İlan bulunamadı.");
    await this.prisma.favorites.upsert({ where: { user_id_listing_id: { user_id: user.id, listing_id: id } }, create: { user_id: user.id, listing_id: id, created_at: now() }, update: {} });
    return { success: true };
  }
  @Delete() async remove(@Query("id") id: string, @Req() request: AuthRequest) { assertOrigin(request); const user = await this.auth.current(request); requireUser(user); await this.prisma.favorites.deleteMany({ where: { user_id: user.id, listing_id: str(id, 80) } }); return { success: true }; }
}
