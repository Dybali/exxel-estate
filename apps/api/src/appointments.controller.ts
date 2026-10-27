import {Body,Controller,Get,Header,HttpCode,HttpException,Post,Req} from '@nestjs/common';
import {AuthService} from './auth.service';
import {PrismaService} from './prisma.service';
import {assertOrigin,AuthRequest,requireUser} from './common';
import {AppointmentDatabase,AppointmentError,appointmentsFor,mutateAppointment} from './shared/appointments';
@Controller('appointments')
export class AppointmentsController {
 private readonly database:AppointmentDatabase;
 constructor(prisma:PrismaService,private readonly auth:AuthService){this.database={prepare:source=>({bind:(...values)=>{let n=0;const query=source.replace(/\?/g,()=>{const index=n++;return typeof values[index]==='string'&&/^[a-f0-9-]{36}$/i.test(String(values[index]))?`CAST($${index+1} AS uuid)`:`$${index+1}`;});return {first:async<T>()=>(await prisma.$queryRawUnsafe<T[]>(query,...values))[0]||null,all:async<T>()=>({results:await prisma.$queryRawUnsafe<T[]>(query,...values)})};}})};}
 @Get() @Header('Cache-Control','private, no-store') async get(@Req() request:AuthRequest){const user=await this.auth.current(request);requireUser(user);return appointmentsFor(this.database,user.id);}
 @Post() @HttpCode(200) @Header('Cache-Control','private, no-store') async post(@Req() request:AuthRequest,@Body() data:Record<string,unknown>){assertOrigin(request);const user=await this.auth.current(request);requireUser(user);try{return await mutateAppointment(this.database,user.id,data);}catch(e){if(e instanceof AppointmentError)throw new HttpException(e.message,e.status);throw e;}}
}
