import { DiscoveryController } from "./discovery.controller";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaService } from "./prisma.service";
import { AuthService } from "./auth.service";
import { AccountController } from "./account.controller";
import { ListingsController } from "./listings.controller";
import { MessagesController } from "./messages.controller";
import { MediaController, MediaService } from "./media.controller";
import { AdminController } from "./admin.controller";
import { LocationsController } from "./locations.controller";
import { FavoritesController } from "./favorites.controller";
import { MineController } from "./mine.controller";
import { GoogleController } from "./google.controller";
import { HealthController } from "./health.controller";
import { CityCountsController } from "./city-counts.controller";
import { CompaniesController } from "./companies.controller";

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { issuer: "exxel-estate", audience: "exxel-estate-web" } })],
  controllers: [DiscoveryController, AccountController, ListingsController, MessagesController, MediaController, AdminController, LocationsController, FavoritesController, MineController, GoogleController, HealthController, CityCountsController, CompaniesController],
  providers: [PrismaService, AuthService, MediaService],
})
export class AppModule {}
