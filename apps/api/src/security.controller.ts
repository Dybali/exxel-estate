import {Body,Controller,Get,Header,HttpCode,Post,Req,Res,BadRequestException} from '@nestjs/common';
import type {Response} from 'express';
import {AuthService} from './auth.service';
import {PrismaService} from './prisma.service';
import {assertOrigin,AuthRequest,now,requireUser} from './common';
@Controller('account-security')
export class SecurityController {
 constructor(private readonly prisma:PrismaService,private readonly auth:AuthService){}
 @Get() @Header('Cache-Control','private, no-store') async get(@Req() request:AuthRequest){const user=await this.auth.current(request);requireUser(user);return {activeSessions:await this.prisma.sessions.count({where:{user_id:user.id,expires_at:{gt:now()}}})};}
 @Post() @HttpCode(200) @Header('Cache-Control','private, no-store') async post(@Req() request:AuthRequest,@Body() data:Record<string,unknown>,@Res({passthrough:true}) response:Response){assertOrigin(request);const user=await this.auth.current(request);requireUser(user);if(data.action==='logout_others'){const key=await this.auth.currentSessionKey(request,user.id);if(!key)throw new BadRequestException('Giriş gerekli.');await this.prisma.sessions.deleteMany({where:{user_id:user.id,token_hash:{not:key}}});return {success:true};}if(data.action==='logout_all'){await this.prisma.sessions.deleteMany({where:{user_id:user.id}});await this.auth.logout(request,response);return {success:true};}throw new BadRequestException('Geçersiz işlem.');}
}
