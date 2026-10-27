import {currentUser,isAdmin,error,ok} from '@/lib/server';
import {operationsReport} from '@/lib/operations-runtime';
export async function GET(request:Request){const user=await currentUser(request);if(!user?.email_verified||!isAdmin(user))return error('Yönetici yetkisi gerekli.',403);try{return ok(await operationsReport(),{headers:{'Cache-Control':'private, no-store'}});}catch{return error('İzleme verisi şu anda alınamadı.',503);}}
