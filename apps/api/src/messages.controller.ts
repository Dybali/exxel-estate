import { Body, Controller, Get, HttpException, Post, Query, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { assertOrigin, AuthRequest, requireUser } from "./common";
import { PrismaService } from "./prisma.service";
import { chatGet, chatPost, ChatDatabase, ChatStatement, ChatError } from "./shared/messaging-service";

@Controller("messages")
export class MessagesController {
  private readonly database: ChatDatabase;
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {
    this.database = { prepare: (source: string, uuidParameters: number[] = []) => {
      let index = 0; const sql = source.replace(/\?/g, () => { const position = index++; return uuidParameters.includes(position) ? `CAST($${position+1} AS uuid)` : `$${position+1}`; });
      let values: (string | number | null)[] = [];
      const statement: ChatStatement = {
        bind: (...args) => { values = args; return statement; },
        all: async <T>() => ({ results: await this.prisma.$queryRawUnsafe<T[]>(sql, ...values) }),
        first: async <T>() => (await this.prisma.$queryRawUnsafe<T[]>(sql, ...values))[0] || null,
        run: () => this.prisma.$executeRawUnsafe(sql, ...values),
      }; return statement;
    }};
  }
  @Get() async list(@Query() query: Record<string,string>, @Req() request: AuthRequest, @Res({passthrough:true}) response: Response) {
    const user = await this.auth.current(request); requireUser(user);
    response.setHeader("Cache-Control", "no-store");
    try { return await chatGet(this.database, { id: user.id, admin: this.auth.isAdmin(user) }, new URLSearchParams(query)); }
    catch (cause) { if (cause instanceof ChatError) throw new HttpException(cause.message, cause.status); throw cause; }
  }
  @Post() async send(@Body() data: Record<string,unknown>, @Req() request: AuthRequest, @Res({passthrough:true}) response: Response) {
    assertOrigin(request);
    const user = await this.auth.current(request); requireUser(user);
    response.setHeader("Cache-Control", "no-store"); response.status(data.action === "read" ? 200 : 201);
    try { return await chatPost(this.database, { id: user.id, admin: this.auth.isAdmin(user) }, data); }
    catch (cause) { if (cause instanceof ChatError) throw new HttpException(cause.message, cause.status); throw cause; }
  }
}

