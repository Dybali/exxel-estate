import {body,currentUser,db,error,ok,sameOrigin} from '@/lib/server';
import {AppointmentError,appointmentsFor,mutateAppointment} from '@/lib/appointments';
import {env,waitUntil} from '@/lib/runtime';
import {siteUrl} from '@/lib/request-context';
import {notifyAppointment,type NotificationDatabase} from '@/lib/email-notifications';
import type {EmailSettings} from '@/lib/email';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){const user=await currentUser(request);if(!user)return error('Giriş gerekli.',401);return ok(await appointmentsFor(db(),user.id),{headers});}
export async function POST(request:Request){
 if(!sameOrigin(request))return error('Geçersiz kaynak.',403);
 const user=await currentUser(request);if(!user)return error('Giriş gerekli.',401);
 let data:Record<string,unknown>;try{data=await body(request);}catch{return error('Geçersiz istek.');}
 try{
  const result=await mutateAppointment(db(),user.id,data) as {id?:string};
  // E-mail the other person about a new request or a status change, in the background (lib/email-notifications.ts).
  if(result?.id&&(data.action==='request'||typeof data.status==='string'))waitUntil(notifyAppointment(db() as unknown as NotificationDatabase,{...(env as unknown as EmailSettings),SITE_URL:siteUrl()},{appointmentId:String(result.id),actorId:String(user.id)}).catch(()=>{}));
  return ok(result,{headers});
 }catch(e){if(e instanceof AppointmentError)return error(e.message,e.status);throw e;}
}
