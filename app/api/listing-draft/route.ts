import {currentUser,db,body,error,ok,sameOrigin} from '@/lib/server';
import {DraftError,readDraft,writeDraft} from '@/lib/listing-drafts';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){const user=await currentUser(request);if(!user)return error('Giriş gerekli.',401);return ok({draft:await readDraft(db(),user.id)},{headers});}
export async function POST(request:Request){
 if(!sameOrigin(request))return error('Geçersiz kaynak.',403);
 const user=await currentUser(request);if(!user)return error('Giriş gerekli.',401);
 if(!['individual','agent','admin'].includes(user.role))return error('İlan veren hesabı gerekli.',403);
 let data:Record<string,unknown>;try{data=await body(request);}catch{return error('Taslak bilgileri geçersiz.');}
 try{return ok(await writeDraft(db(),user.id,data),{headers});}catch(e){if(e instanceof DraftError)return error(e.message,e.status);throw e;}
}
