import {body,currentUser,db,error,now,ok,sameOrigin,sessionCookie,sha256} from '@/lib/server';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){const user=await currentUser(request);if(!user)return error('Giriş gerekli.',401);const row=await db().prepare('SELECT count(*) AS count FROM sessions WHERE user_id=? AND expires_at>?').bind(user.id,now()).first<{count:number}>();return ok({activeSessions:Number(row?.count||0)},{headers});}
export async function POST(request:Request){
 if(!sameOrigin(request))return error('Geçersiz kaynak.',403);
 const user=await currentUser(request);if(!user)return error('Giriş gerekli.',401);
 let data:Record<string,unknown>;try{data=await body(request);}catch{return error('Geçersiz istek.');}
 if(data.action==='logout_others'){const token=(request.headers.get('cookie')||'').match(/(?:^|;\s*)excell_session=([^;]+)/)?.[1];if(!token)return error('Giriş gerekli.',401);await db().prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(user.id,await sha256(token)).run();return ok({success:true},{headers});}
 if(data.action==='logout_all'){await db().prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run();return ok({success:true},{headers:{...headers,'Set-Cookie':sessionCookie('',true)}});}
 return error('Geçersiz işlem.');
}
