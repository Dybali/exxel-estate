import {Body,Controller,Get,Header,HttpCode,HttpException,Post,Req} from "@nestjs/common";
import {AuthService} from "./auth.service";
import {PrismaService} from "./prisma.service";
import {assertOrigin,AuthRequest,requireUser} from "./common";
import {DiscoveryDatabase,DiscoveryError,discoveryFeed,mutateDiscovery} from "./shared/discovery-service";
@Controller("discovery")
export class DiscoveryController {
 private readonly database:DiscoveryDatabase;
 constructor(private readonly prisma:PrismaService,private readonly auth:AuthService){
  this.database={prepare:source=>({bind:(...values)=>{
   let index=0;const query=source.replace(/json_each\(l\.amenities\)/g,"jsonb_array_elements_text(l.amenities::jsonb)").replace(/\?/g,()=>{const i=index++;return typeof values[i]==="string"&&/^[a-f0-9-]{36}$/i.test(String(values[i]))?`CAST($${i+1} AS uuid)`:`$${i+1}`;});
   return {all:async<T>()=>({results:await prisma.$queryRawUnsafe<T[]>(query,...values)}),first:async<T>()=>(await prisma.$queryRawUnsafe<T[]>(query,...values))[0]||null,run:()=>prisma.$executeRawUnsafe(query,...values)};
  }})};
 }
 @Get() @Header("Cache-Control","private, no-store") async get(@Req() request:AuthRequest){const user=await this.auth.current(request);requireUser(user);return discoveryFeed(this.database,user.id);}
 @Post() @HttpCode(200) @Header("Cache-Control","private, no-store") async post(@Req() request:AuthRequest,@Body() data:Record<string,unknown>){assertOrigin(request);const user=await this.auth.current(request);requireUser(user);try{return await mutateDiscovery(this.database,user.id,data);}catch(e){if(e instanceof DiscoveryError)throw new HttpException(e.message,e.status);throw e;}}
}
