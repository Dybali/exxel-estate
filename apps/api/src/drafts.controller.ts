import {Body,Controller,Get,Header,HttpCode,HttpException,Post,Req,ForbiddenException} from '@nestjs/common';
import {AuthService} from './auth.service';
import {PrismaService} from './prisma.service';
import {assertOrigin,AuthRequest,requireUser} from './common';
import {DraftDatabase,DraftError,readDraft,writeDraft} from './shared/listing-drafts';
@Controller('listing-draft')
export class DraftsController {
 private readonly database:DraftDatabase;
 constructor(prisma:PrismaService,private readonly auth:AuthService){this.database={prepare:source=>({bind:(...values)=>{let n=0;const parameterized=source.replace(/\?/g,()=>{const index=n++;return typeof values[index]==='string'&&/^[a-f0-9-]{36}$/i.test(String(values[index]))?`CAST($${index+1} AS uuid)`:`$${index+1}`;});return {first:async<T>()=>(await prisma.$queryRawUnsafe<T[]>(parameterized,...values))[0]||null};}})};}
 @Get() @Header('Cache-Control','private, no-store') async get(@Req() request:AuthRequest){const user=await this.auth.current(request);requireUser(user);return {draft:await readDraft(this.database,user.id)};}
 @Post() @HttpCode(200) @Header('Cache-Control','private, no-store') async post(@Req() request:AuthRequest,@Body() data:Record<string,unknown>){assertOrigin(request);const user=await this.auth.current(request);requireUser(user);if(!['individual','agent','admin'].includes(user.role))throw new ForbiddenException('İlan veren hesabı gerekli.');try{return await writeDraft(this.database,user.id,data);}catch(e){if(e instanceof DraftError)throw new HttpException(e.message,e.status);throw e;}}
}
