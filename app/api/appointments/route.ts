import {body,currentUser,db,error,ok,sameOrigin} from '@/lib/server';
import {AppointmentError,appointmentsFor,mutateAppointment} from '@/lib/appointments';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){const user=await currentUser(request);if(!user)return error('Giriş gerekli.',401);return ok(await appointmentsFor(db(),user.id),{headers});}
export async function POST(request:Request){if(!sameOrigin(request))return error('Geçersiz kaynak.',403);const user=await currentUser(request);if(!user)return error('Giriş gerekli.',401);let data:Record<string,unknown>;try{data=await body(request);}catch{return error('Geçersiz istek.');}try{return ok(await mutateAppointment(db(),user.id,data),{headers});}catch(e){if(e instanceof AppointmentError)return error(e.message,e.status);throw e;}}
