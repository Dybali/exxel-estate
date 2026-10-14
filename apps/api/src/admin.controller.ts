import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Post, Query, Req } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { assertOrigin, AuthRequest, now, str } from "./common";
import { PrismaService } from "./prisma.service";
import { listingView } from "./listings.controller";

@Controller("admin")
export class AdminController {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}
  private async admin(request: AuthRequest) {
    const user = await this.auth.current(request);
    if (!this.auth.isAdmin(user)) throw new ForbiddenException("Yönetici yetkisi gerekli.");
    return user!;
  }
  @Get() async get(@Query() query: Record<string,string>, @Req() request: AuthRequest) {
    await this.admin(request);
    const listingId = str(query.listingId, 80);
    if (listingId) {
      const row = await this.prisma.listings.findUnique({ where: { id: listingId }, include: { users_listings_owner_idTousers: true } });
      if (!row) throw new NotFoundException("İlan bulunamadı.");
      const owner = row.users_listings_owner_idTousers;
      return { listing: listingView(row), owner: { name: owner.name, email: owner.email, role: owner.role, company: owner.company } };
    }
    const page = Math.min(1000, Math.max(1, Number(query.page) || 1)), pageSize = 50;
    const [users, listings, listingTotal, pendingTotal, messages, countries] = await Promise.all([
      this.prisma.users.findMany({ select: { id:true,email:true,name:true,role:true,agent_status:true,company:true,created_at:true }, orderBy: {created_at:"desc"}, take:200 }),
      this.prisma.listings.findMany({ include: { users_listings_owner_idTousers: { select: { name:true } } }, orderBy: [{created_at:"desc"}], take:pageSize, skip:(page-1)*pageSize }),
      this.prisma.listings.count(), this.prisma.listings.count({ where: { status:"pending" } }),
      this.prisma.messages.findMany({ where: {recipient_id:null}, select:{id:true,listing_id:true,sender_id:true,body:true,created_at:true},orderBy:{created_at:"desc"},take:100 }),
      this.prisma.country_settings.findMany({orderBy:{country_code:"asc"}}),
    ]);
    listings.sort((a,b) => (a.status === "pending" ? 0 : a.status === "rejected" ? 1 : 2) - (b.status === "pending" ? 0 : b.status === "rejected" ? 1 : 2));
    return { users, listings: listings.map((row) => ({ id:row.id,title:row.title,city:row.city,district:row.district,neighborhood:row.neighborhood,price:Number(row.price),currency:row.currency,status:row.status,owner_id:row.owner_id,created_at:row.created_at,owner_name:row.users_listings_owner_idTousers.name })), listingTotal, pendingTotal, page, pageSize, messages, countries };
  }
  @Post() async mutate(@Body() data: Record<string,unknown>, @Req() request: AuthRequest) {
    assertOrigin(request);
    const user = await this.admin(request);
    const kind = str(data.kind, 20), id = str(data.id, 80), status = str(data.status, 20);
    if (kind === "listing" && ["published","rejected","pending"].includes(status)) {
      const note = str(data.note, 1000);
      if (status === "rejected" && note.length < 5) throw new BadRequestException("Ret nedeni en az 5 karakter olmalı.");
      const current = await this.prisma.listings.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("İlan bulunamadı.");
      if (current.status === status) throw new ConflictException("İlan zaten bu durumda.");
      await this.prisma.listings.update({ where: { id }, data: { status, review_note: status === "pending" ? null : note || null, reviewed_by: user.id, reviewed_at: now(), updated_at: now() } });
      return { success:true,status };
    }
    if (kind === "agent" && ["approved","rejected","pending"].includes(status)) {
      const agent = await this.prisma.users.findFirst({ where: { id, role:"agent" } });
      if (!agent) throw new NotFoundException("Emlakçı bulunamadı.");
      if (status === "approved" && !agent.company?.trim()) throw new BadRequestException("Ofis adı gerekli.");
      await this.prisma.$transaction([this.prisma.users.update({where:{id},data:{agent_status:status}}),this.prisma.agencies.updateMany({where:{owner_id:id},data:{status}})]);
      return { success:true };
    }
    if (kind === "country") {
      const countryCode = str(data.countryCode, 2).toUpperCase(), locale = str(data.locale, 10);
      if (!/^[A-Z]{2}$/.test(countryCode) || !/^[a-z]{2}(-[A-Z]{2})?$/.test(locale)) throw new BadRequestException("Ülke ve dil kodları geçersiz.");
      const values = { locale, legal_text:str(data.legalText,10000), payment_provider:str(data.paymentProvider,80)||null, enabled:data.enabled?1:0 };
      await this.prisma.country_settings.upsert({ where:{country_code:countryCode},create:{country_code:countryCode,...values},update:values });
      return {success:true};
    }
    throw new BadRequestException("Geçersiz yönetim işlemi.");
  }
}
