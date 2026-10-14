import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { assertOrigin, AuthRequest, requireUser } from "./common";

@Controller("account")
export class AccountController {
  constructor(private readonly auth: AuthService) {}
  @Get() async account(@Req() request: AuthRequest) {
    const user = await this.auth.current(request);
    return { user: user ? this.auth.publicUser(user) : null };
  }
  @Post() async action(@Body() data: Record<string, unknown>, @Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    assertOrigin(request);
    if (data?.action === "logout") { await this.auth.logout(request, response); return { success: true }; }
    if (data?.action === "register") { response.status(201); return { user: await this.auth.register(data, response) }; }
    if (data?.action === "login") return { user: await this.auth.login(data, request, response) };
    if (data?.action === "request_seller_role") {
      const user = await this.auth.current(request); requireUser(user);
      return this.auth.requestSellerRole(user, data);
    }
    return { error: "Geçersiz işlem." };
  }
}
