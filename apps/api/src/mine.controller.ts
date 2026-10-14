import { Controller, Get, Req } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthRequest, requireUser } from "./common";
import { PrismaService } from "./prisma.service";
import { listingView } from "./listings.controller";

@Controller("mine")
export class MineController {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}
  @Get() async get(@Req() request: AuthRequest) {
    const user = await this.auth.current(request); requireUser(user);
    const listings = await this.prisma.listings.findMany({ where: { owner_id: user.id }, orderBy: { created_at: "desc" }, include: { users_listings_owner_idTousers: { select: { name: true } } }, take: 100 });
    return { listings: listings.map(listingView) };
  }
}
